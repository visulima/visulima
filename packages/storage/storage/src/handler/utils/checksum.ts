/* eslint-disable no-bitwise -- CRC arithmetic */
import { createHash, getHashes } from "node:crypto";
import { Readable } from "node:stream";
import * as zlib from "node:zlib";

import createHttpError from "http-errors";

import { ERRORS, throwErrorCode } from "../../utils/errors";

/** Encodes a CRC as the base64 of its 4 big-endian bytes, the format `Upload-Checksum` uses. */
const encodeCrc = (crc: number): string => {
    const bytes = Buffer.alloc(4);

    bytes.writeUInt32BE(crc >>> 0);

    return bytes.toString("base64");
};

let crc32cTable: Uint32Array | undefined;

/**
 * CRC-32C (Castagnoli), which `node:crypto` and `node:zlib` don't provide.
 * @param bytes Data to checksum
 * @returns The CRC as an unsigned 32-bit integer
 */
const crc32c = (bytes: Uint8Array): number => {
    if (crc32cTable === undefined) {
        crc32cTable = new Uint32Array(256);

        for (let index = 0; index < 256; index += 1) {
            let value = index;

            for (let bit = 0; bit < 8; bit += 1) {
                value = value & 1 ? 0x82_f6_3b_78 ^ (value >>> 1) : value >>> 1;
            }

            crc32cTable[index] = value >>> 0;
        }
    }

    let crc = 0xff_ff_ff_ff;

    for (const byte of bytes) {
        crc = (crc32cTable[(crc ^ byte) & 0xff] as number) ^ (crc >>> 8);
    }

    return (crc ^ 0xff_ff_ff_ff) >>> 0;
};

/** `zlib.crc32` exists from Node.js 22.2 / 20.15; older runtimes simply don't offer crc32. */
const zlibCrc32 = (zlib as { crc32?: (data: Uint8Array) => number }).crc32;

const DIGESTS: Record<string, ((bytes: Uint8Array) => string) | undefined> = {
    crc32: zlibCrc32 === undefined ? undefined : (bytes) => encodeCrc(zlibCrc32(bytes)),
    crc32c: (bytes) => encodeCrc(crc32c(bytes)),
};

let handlerAlgorithms: string[] | undefined;

/**
 * Checksum algorithms the handlers can verify themselves when the storage can't.
 * @returns Lowercase algorithm names
 */
export const getHandlerChecksumAlgorithms = (): string[] => {
    if (handlerAlgorithms === undefined) {
        const hashes = new Set(getHashes());

        handlerAlgorithms = [
            ...["md5", "sha1", "sha256", "sha384", "sha512"].filter((algorithm) => hashes.has(algorithm)),
            ...Object.keys(DIGESTS).filter((algorithm) => DIGESTS[algorithm] !== undefined),
        ];
    }

    return handlerAlgorithms;
};

/**
 * Computes a checksum in the base64 form `Upload-Checksum` uses.
 * @param algorithm One of {@link getHandlerChecksumAlgorithms}
 * @param bytes Data to checksum
 * @returns The base64 digest
 */
export const computeChecksum = (algorithm: string, bytes: Uint8Array): string => {
    const digest = DIGESTS[algorithm];

    return digest === undefined ? createHash(algorithm).update(bytes).digest("base64") : digest(bytes);
};

/**
 * Reads a request body (Node.js Readable, Web ReadableStream or bytes) into memory, refusing to
 * read more than `limit` bytes.
 * @param body Request body
 * @param limit Maximum number of bytes to accept
 * @returns The body bytes
 * @throws {HttpError} 413 when the body is larger than `limit`
 */
export const readBoundedBody = async (body: unknown, limit: number): Promise<Buffer> => {
    if (body === undefined || body === null) {
        return Buffer.alloc(0);
    }

    if (body instanceof Uint8Array) {
        if (body.byteLength > limit) {
            throw createHttpError(413, "Request body is larger than its Content-Length");
        }

        return Buffer.from(body);
    }

    const chunks: Buffer[] = [];
    let received = 0;

    // Node.js Readables and Web ReadableStreams are both async iterable.
    for await (const chunk of body as AsyncIterable<Uint8Array | string>) {
        const buffer = typeof chunk === "string" ? Buffer.from(chunk) : Buffer.from(chunk);

        received += buffer.byteLength;

        // Unreachable for a Node request: callers pass its Content-Length as the limit, and Node's
        // parser ends the body there. It guards a body whose length nothing enforced.
        if (received > limit) {
            throw createHttpError(413, "Request body is larger than its Content-Length");
        }

        chunks.push(buffer);
    }

    return Buffer.concat(chunks);
};

/**
 * Largest chunk an `X-Chunk-Checksum` is verified for: it is checked before the chunk is written,
 * since a sequential-only provider (S3) can't take a stored part back.
 */
const MAX_CHECKSUM_CHUNK_SIZE = 64 * 1024 * 1024;

/** Hash algorithm of a bare hex `X-Chunk-Checksum`, by its length (the client sends SHA-1 to SHA-512). */
const CHECKSUM_ALGORITHM_BY_HEX_LENGTH: Record<number, string> = { 40: "sha1", 64: "sha256", 96: "sha384", 128: "sha512" };

/**
 * Reads a chunk and checks it against its `X-Chunk-Checksum`: a bare hex digest, or
 * `&lt;algorithm> &lt;hex or base64 digest>`.
 * @param body Chunk body
 * @param contentLength Chunk length
 * @param checksum Header value
 * @returns The verified chunk, as a stream to write
 * @throws {HttpError} 400 for an unknown algorithm, 413 for a chunk too large to verify
 * @throws {UploadError} CHECKSUM_MISMATCH (460) when the chunk doesn't match
 */
export const verifyChunk = async (body: unknown, contentLength: number, checksum: string): Promise<Readable> => {
    const [first = "", second] = checksum.trim().split(/\s+/u);
    const algorithm = second === undefined ? CHECKSUM_ALGORITHM_BY_HEX_LENGTH[first.length] : first.toLowerCase().replace("-", "");
    const expected = second ?? first;

    if (algorithm === undefined || !getHashes().includes(algorithm)) {
        throw createHttpError(400, "Unsupported X-Chunk-Checksum");
    }

    if (contentLength > MAX_CHECKSUM_CHUNK_SIZE) {
        throw createHttpError(413, `Chunks with X-Chunk-Checksum may be at most ${String(MAX_CHECKSUM_CHUNK_SIZE)} bytes`);
    }

    const bytes = await readBoundedBody(body, contentLength);
    const digest = computeChecksum(algorithm, bytes);

    if (expected.toLowerCase() !== Buffer.from(digest, "base64").toString("hex") && expected !== digest) {
        throwErrorCode(ERRORS.CHECKSUM_MISMATCH, "Chunk does not match X-Chunk-Checksum");
    }

    return Readable.from([bytes]);
};
