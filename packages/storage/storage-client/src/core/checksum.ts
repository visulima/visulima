/**
 * Chunk integrity helpers.
 *
 * The server-side `X-Chunk-Checksum` header (consumed by `patchChunk`) lets a
 * server verify each chunk's integrity. This module computes that value with the
 * Web Crypto API so adapters can opt in to per-chunk verification.
 */

/** Hash algorithm accepted by `computeChunkChecksum`. */
type ChecksumAlgorithm = "SHA-1" | "SHA-256" | "SHA-384" | "SHA-512";

/**
 * Converts an `ArrayBuffer` to a lowercase hex string.
 */
const toHex = (buffer: ArrayBuffer): string => {
    const bytes = new Uint8Array(buffer);
    let hex = "";

    for (const byte of bytes) {
        hex += byte.toString(16).padStart(2, "0");
    }

    return hex;
};

/**
 * Computes a cryptographic checksum for a chunk, returned as a hex string.
 *
 * Uses `crypto.subtle.digest`, which is available in browsers and modern Node
 * (>= 20). Returns `undefined` when Web Crypto is unavailable, so callers can
 * silently skip integrity headers instead of failing the upload.
 * @param chunk The chunk (Blob/File slice) to hash.
 * @param algorithm The hash algorithm (default `SHA-256`).
 * @returns A lowercase hex digest, or `undefined` if Web Crypto is unavailable.
 * @example
 * ```ts
 * const checksum = await computeChunkChecksum(file.slice(0, 1024));
 * await patchChunk(url, chunk, 0, checksum);
 * ```
 */
const computeChunkChecksum = async (chunk: Blob, algorithm: ChecksumAlgorithm = "SHA-256"): Promise<string | undefined> => {
    // `globalThis.crypto` is typed as always-present, but may be absent at
    // runtime (e.g. older/non-web runtimes), so probe it through a loose lookup.
    // The structural type avoids referencing the `SubtleCrypto` lib builtin
    // (which the Node-version lint rule flags as experimental).
    type SubtleLike = { digest: (algorithm: string, data: ArrayBuffer) => Promise<ArrayBuffer> };
    // eslint-disable-next-line n/no-unsupported-features/node-builtins -- `globalThis.crypto` is stable in Node >= 20 and all browsers; this is a guarded runtime probe
    const subtle = (globalThis as { crypto?: { subtle?: SubtleLike } }).crypto?.subtle;

    if (!subtle) {
        return undefined;
    }

    const buffer = await chunk.arrayBuffer();
    const digest = await subtle.digest(algorithm, buffer);

    return toHex(digest);
};

export type { ChecksumAlgorithm };
export { computeChunkChecksum };
