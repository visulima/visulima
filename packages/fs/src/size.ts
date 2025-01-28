import { existsSync, readFileSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";
import { Readable } from "node:stream";
import { URL } from "node:url";
import type { BrotliOptions, ZlibOptions } from "node:zlib";
import { brotliCompressSync, createBrotliCompress, createGzip, gzipSync } from "node:zlib";

import { toPath } from "@visulima/path/utils";

/**
 * Checks if a string is likely a file path.
 *
 * @param input - The string to check
 * @returns True if the string appears to be a file path
 */
const isFilePath = (input: string): boolean => {
    // If it's an absolute path, check if it exists
    if (isAbsolute(input)) {
        return existsSync(input);
    }

    // Try to resolve relative path and check if it exists
    try {
        return existsSync(resolve(input));
    } catch {
        return false;
    }
};

/**
 * Asynchronously gets the size of a stream.
 *
 * @param stream - The stream to calculate the size for
 * @returns Promise that resolves with the size in bytes of the stream
 */
const getStreamSize = async (stream: Readable): Promise<number> => {
    const chunks: Buffer[] = [];

    // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
    for await (const chunk of stream) {
        chunks.push(Buffer.from(chunk));
    }

    return Buffer.concat(chunks).length;
};

/**
 * Asynchronously calculates the compressed size of a stream.
 *
 * @param stream - The stream to calculate the compressed size for
 * @param createCompressor - A function that creates a compressor stream
 * @returns Promise that resolves with the compressed size in bytes of the stream
 */
const getCompressedStreamSize = async (stream: Readable, createCompressor: () => NodeJS.ReadWriteStream): Promise<number> => {
    const chunks: Buffer[] = [];
    const compressor = createCompressor();

    // eslint-disable-next-line @typescript-eslint/no-shadow,compat/compat
    return await new Promise((resolve, reject) => {
        compressor.on("data", (chunk) => chunks.push(chunk));
        compressor.on("end", () => resolve(Buffer.concat(chunks).length));
        compressor.on("error", reject);

        stream.on("error", reject);
        stream.pipe(compressor);
    });
};

/**
 * Handles input data and applies a processor function to it.
 *
 * @param input - The input data to handle
 * @param processor - A function that processes the input data
 * @returns Promise that resolves with the result of the processor function
 */
const handleInput = async (input: Buffer | Readable | URL | string, processor: (data: Buffer) => number): Promise<number> => {
    if (input instanceof URL || typeof input === "string") {
        const path = toPath(input);

        if (isFilePath(path)) {
            return processor(await readFile(path));
        }

        if (typeof input === "string") {
            return processor(Buffer.from(input));
        }
    }

    if (input instanceof Readable) {
        const chunks: Buffer[] = [];

        // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
        for await (const chunk of input) {
            chunks.push(Buffer.from(chunk));
        }

        return processor(Buffer.concat(chunks));
    }

    return processor(input as Buffer);
};

/**
 * Asynchronously calculates the gzipped size of the input.
 *
 * @param input - The input to calculate the gzipped size for:
 *                - string: Text content to compress
 *                - Buffer: Binary data to compress
 *                - Readable: Stream of data to compress
 *                - URL/string: File path to read and compress
 * @param options - Optional zlib options for compression customization
 * @returns Promise that resolves with the size in bytes of the gzipped input
 */
export const gzipSize = async (input: Buffer | Readable | URL | string, options?: ZlibOptions): Promise<number> => {
    if (input instanceof Readable) {
        return await getCompressedStreamSize(input, () => createGzip(options));
    }

    return await handleInput(input, (data) => gzipSync(data, options).length);
};

/**
 * Asynchronously calculates the Brotli compressed size of the input.
 *
 * @param input - The input to calculate the Brotli compressed size for:
 *                - string: Text content to compress
 *                - Buffer: Binary data to compress
 *                - Readable: Stream of data to compress
 *                - URL/string: File path to read and compress
 * @param options - Optional Brotli options for compression customization
 * @returns Promise that resolves with the size in bytes of the Brotli compressed input
 */
export const brotliSize = async (input: Buffer | Readable | URL | string, options?: BrotliOptions): Promise<number> => {
    if (input instanceof Readable) {
        return await getCompressedStreamSize(input, () => createBrotliCompress(options));
    }

    return await handleInput(input, (data) => brotliCompressSync(data, options).length);
};

/**
 * Asynchronously gets the raw size of the input without compression.
 *
 * @param input - The input to calculate the raw size for:
 *                - string: Text content to measure
 *                - Buffer: Binary data to measure
 *                - Readable: Stream of data to measure
 *                - URL/string: File path to measure
 * @returns Promise that resolves with the raw size in bytes of the input
 */
export const rawSize = async (input: Buffer | Readable | URL | string): Promise<number> => {
    if (input instanceof Readable) {
        return await getStreamSize(input);
    }

    return await handleInput(input, (data) => data.length);
};

/**
 * Synchronously calculates the gzipped size of the input.
 * Note: Does not support streams as they are inherently asynchronous.
 *
 * @param input - The input to calculate the gzipped size for:
 *                - string: Text content to compress
 *                - Buffer: Binary data to compress
 *                - URL/string: File path to read and compress
 * @param options - Optional zlib options for compression customization
 * @returns The size in bytes of the gzipped input
 */
export const gzipSizeSync = (input: Buffer | URL | string, options?: ZlibOptions): number => {
    if (input instanceof URL || typeof input === "string") {
        const path = toPath(input);

        if (isFilePath(path)) {
            return gzipSync(readFileSync(path), options).length;
        }

        if (typeof input === "string") {
            return gzipSync(Buffer.from(input), options).length;
        }
    }

    return gzipSync(input as Buffer, options).length;
};

/**
 * Synchronously calculates the Brotli compressed size of the input.
 * Note: Does not support streams as they are inherently asynchronous.
 *
 * @param input - The input to calculate the Brotli compressed size for:
 *                - string: Text content to compress
 *                - Buffer: Binary data to compress
 *                - URL/string: File path to read and compress
 * @param options - Optional Brotli options for compression customization
 * @returns The size in bytes of the Brotli compressed input
 */
export const brotliSizeSync = (input: Buffer | URL | string, options?: BrotliOptions): number => {
    if (input instanceof URL || typeof input === "string") {
        const path = toPath(input);

        if (isFilePath(path)) {
            return brotliCompressSync(readFileSync(path), options).length;
        }

        if (typeof input === "string") {
            return brotliCompressSync(Buffer.from(input), options).length;
        }
    }

    return brotliCompressSync(input as Buffer, options).length;
};

/**
 * Synchronously gets the raw size of the input without compression.
 * Note: Does not support streams as they are inherently asynchronous.
 *
 * @param input - The input to calculate the raw size for:
 *                - string: Text content to measure
 *                - Buffer: Binary data to measure
 *                - URL/string: File path to measure
 * @returns The raw size in bytes of the input
 */
export const rawSizeSync = (input: Buffer | URL | string): number => {
    if (input instanceof URL || typeof input === "string") {
        const path = toPath(input);

        if (isFilePath(path)) {
            return statSync(path).size;
        }

        if (typeof input === "string") {
            return Buffer.from(input).length;
        }
    }

    return (input as Buffer).length;
};
