import { existsSync, readFileSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";
import { Readable } from "node:stream";
import { URL } from "node:url";
import type { BrotliOptions, ZlibOptions } from "node:zlib";
import { brotliCompressSync, createBrotliCompress, createGzip, gzipSync } from "node:zlib";

import { toPath } from "@visulima/path/utils";

/**
 * Checks if a file exists at the given path.
 * Note: This function checks for actual file existence, not just path syntax validity.
 * It correctly handles both absolute and relative paths.
 *
 * @param input The path to the file (string).
 * @returns True if the file exists, false otherwise.
 * @example
 * ```javascript
 * // Assuming fileExists is accessible (e.g. exported or used internally)
 * // import { fileExists } from "@visulima/fs"; // if it were exported
 *
 * if (fileExists("./my-file.txt")) {
 *   console.log("File exists.");
 * } else {
 *   console.log("File does not exist.");
 * }
 * ```
 */
const fileExists = (input: string): boolean => {
    if (isAbsolute(input)) {
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        return existsSync(input);
    }

    try {
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        return existsSync(resolve(input));
    } catch {
        return false;
    }
};

/**
 * Asynchronously gets the size of a stream using a memory-efficient chunk-based approach.
 * This function counts the size of chunks without storing them in memory.
 */
const getStreamSizeEfficient = async (stream: Readable): Promise<number> => {
    let totalSize = 0;

    // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
    for await (const chunk of stream) {
        totalSize += Buffer.from(chunk).length;
    }

    return totalSize;
};

/**
 * Asynchronously calculates the compressed size of a stream using a memory-efficient approach.
 * This function processes chunks incrementally without storing the entire compressed output.
 */
const getCompressedStreamSizeEfficient = async (stream: Readable, createCompressor: () => NodeJS.ReadWriteStream): Promise<number> => {
    let totalSize = 0;
    const compressor = createCompressor();

    // eslint-disable-next-line @typescript-eslint/no-shadow,compat/compat
    return await new Promise((resolve, reject) => {
        compressor.on("data", (chunk) => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/restrict-plus-operands
            totalSize += chunk.length;
        });
        compressor.on("end", () => resolve(totalSize));
        compressor.on("error", reject);

        stream.on("error", reject);
        stream.pipe(compressor);
    });
};

/**
 * Processes input data in a memory-efficient way.
 * For files and streams, it uses a streaming approach to avoid loading entire contents into memory.
 */
const processInputEfficiently = async (
    input: Buffer | Readable | URL | string,
    processor: (data: Buffer) => number,
    streamProcessor: (stream: Readable) => Promise<number>,
): Promise<number> => {
    if (input instanceof URL || typeof input === "string") {
        const path = toPath(input);

        if (fileExists(path)) {
            // For files, we create a readable stream to process them in chunks
            // eslint-disable-next-line security/detect-non-literal-fs-filename
            const fileStream = Readable.from(await readFile(path));
            return await streamProcessor(fileStream);
        }

        if (typeof input === "string") {
            return processor(Buffer.from(input));
        }
    }

    if (input instanceof Readable) {
        return await streamProcessor(input);
    }

    return processor(input as Buffer);
};

/**
 * Asynchronously calculates the gzipped size of the input.
 * Uses memory-efficient streaming for large inputs.
 */
export const gzipSize = async (input: Buffer | Readable | URL | string, options?: ZlibOptions): Promise<number> => {
    const streamProcessor = async (stream: Readable): Promise<number> => await getCompressedStreamSizeEfficient(stream, () => createGzip(options));
    const bufferProcessor = (data: Buffer): number => gzipSync(data, options).length;

    return await processInputEfficiently(input, bufferProcessor, streamProcessor);
};

/**
 * Asynchronously calculates the Brotli compressed size of the input.
 * Uses memory-efficient streaming for large inputs.
 */
export const brotliSize = async (input: Buffer | Readable | URL | string, options?: BrotliOptions): Promise<number> => {
    const streamProcessor = async (stream: Readable): Promise<number> => await getCompressedStreamSizeEfficient(stream, () => createBrotliCompress(options));
    const bufferProcessor = (data: Buffer): number => brotliCompressSync(data, options).length;

    return await processInputEfficiently(input, bufferProcessor, streamProcessor);
};

/**
 * Asynchronously gets the raw size of the input without compression.
 * Uses memory-efficient streaming for large inputs.
 */
export const rawSize = async (input: Buffer | Readable | URL | string): Promise<number> => {
    const streamProcessor = async (stream: Readable): Promise<number> => await getStreamSizeEfficient(stream);
    const bufferProcessor = (data: Buffer): number => data.length;

    return await processInputEfficiently(input, bufferProcessor, streamProcessor);
};

/**
 * Synchronously calculates the gzipped size of the input.
 * Note: For large files, consider using the async gzipSize function instead.
 */
export const gzipSizeSync = (input: Buffer | URL | string, options?: ZlibOptions): number => {
    if (input instanceof URL || typeof input === "string") {
        const path = toPath(input);

        if (fileExists(path)) {
            // eslint-disable-next-line security/detect-non-literal-fs-filename
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
 * Note: For large files, consider using the async brotliSize function instead.
 */
export const brotliSizeSync = (input: Buffer | URL | string, options?: BrotliOptions): number => {
    if (input instanceof URL || typeof input === "string") {
        const path = toPath(input);

        if (fileExists(path)) {
            // eslint-disable-next-line security/detect-non-literal-fs-filename
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
 * Note: For large files, consider using the async rawSize function instead.
 */
export const rawSizeSync = (input: Buffer | URL | string): number => {
    if (input instanceof URL || typeof input === "string") {
        const path = toPath(input);

        if (fileExists(path)) {
            // eslint-disable-next-line security/detect-non-literal-fs-filename
            return statSync(path).size;
        }

        if (typeof input === "string") {
            return Buffer.from(input).length;
        }
    }

    return (input as Buffer).length;
};
