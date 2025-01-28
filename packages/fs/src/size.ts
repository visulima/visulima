import { createReadStream, existsSync, promises as fs, readFileSync, statSync } from "node:fs";
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
        const resolvedPath = resolve(input);
        return existsSync(resolvedPath);
    } catch {
        return false;
    }
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
 *
 * @example
 * // Get size of a string
 * const stringSize = await gzipSize("Hello, World!");
 * console.log(stringSize); // e.g., 33
 *
 * @example
 * // Get size of a file
 * const fileSize = await gzipSize("/path/to/file.txt");
 * console.log(fileSize); // e.g., 1024
 *
 * @example
 * // Get size of a stream
 * const stream = createReadStream("/path/to/file.txt");
 * const streamSize = await gzipSize(stream);
 * console.log(streamSize); // e.g., 2048
 *
 * @example
 * // With custom options
 * const customSize = await gzipSize("content", { level: 9 });
 * console.log(customSize); // e.g., 28
 */
export const gzipSize = async (input: Buffer | Readable | URL | string, options?: ZlibOptions): Promise<number> => {
    const getSizeFromStream = async (stream: Readable): Promise<number> => {
        return new Promise((resolve, reject) => {
            const gzip = createGzip(options);
            const chunks: Buffer[] = [];

            gzip.on("data", (chunk) => {
                chunks.push(chunk);
            });

            gzip.on("end", () => {
                resolve(Buffer.concat(chunks).length);
            });

            gzip.on("error", reject);
            stream.on("error", reject);

            stream.pipe(gzip);
            stream.on("end", () => {
                gzip.end();
            });
        });
    };

    if (input instanceof URL || typeof input === "string") {
        const path = toPath(input);

        if (isFilePath(path)) {
            const fileStream = createReadStream(path);
            return await getSizeFromStream(fileStream);
        }

        if (typeof input === "string") {
            return await getSizeFromStream(Readable.from(Buffer.from(input)));
        }
    }

    return await getSizeFromStream(Readable.from(input));
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
 *
 * @example
 * // Get size of a string
 * const stringSize = await brotliSize("Hello, World!");
 * console.log(stringSize); // e.g., 29
 *
 * @example
 * // Get size of a file
 * const fileSize = await brotliSize("/path/to/file.txt");
 * console.log(fileSize); // e.g., 956
 *
 * @example
 * // Get size of a stream
 * const stream = createReadStream("/path/to/file.txt");
 * const streamSize = await brotliSize(stream);
 * console.log(streamSize); // e.g., 1843
 *
 * @example
 * // With custom options
 * const customSize = await brotliSize("content", { quality: 11 });
 * console.log(customSize); // e.g., 25
 */
export const brotliSize = async (input: Buffer | Readable | URL | string, options?: BrotliOptions): Promise<number> => {
    const getSizeFromStream = async (stream: Readable): Promise<number> => {
        return new Promise((resolve, reject) => {
            const brotli = createBrotliCompress(options);
            const chunks: Buffer[] = [];

            brotli.on("data", (chunk) => {
                chunks.push(chunk);
            });

            brotli.on("end", () => {
                resolve(Buffer.concat(chunks).length);
            });

            brotli.on("error", reject);
            stream.on("error", reject);

            stream.pipe(brotli);
            stream.on("end", () => {
                brotli.end();
            });
        });
    };

    if (input instanceof URL || typeof input === "string") {
        const path = toPath(input);

        if (isFilePath(path)) {
            const fileStream = createReadStream(path);
            return await getSizeFromStream(fileStream);
        }

        if (typeof input === "string") {
            return await getSizeFromStream(Readable.from(Buffer.from(input)));
        }
    }

    return await getSizeFromStream(Readable.from(input));
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
 *
 * @example
 * // Get size of a string
 * const stringSize = await rawSize("Hello, World!");
 * console.log(stringSize); // 13
 *
 * @example
 * // Get size of a file
 * const fileSize = await rawSize("/path/to/file.txt");
 * console.log(fileSize); // e.g., 2048
 *
 * @example
 * // Get size of a stream
 * const stream = createReadStream("/path/to/file.txt");
 * const streamSize = await rawSize(stream);
 * console.log(streamSize); // e.g., 4096
 */
export const rawSize = async (input: Buffer | Readable | URL | string): Promise<number> => {
    if (input instanceof URL || typeof input === "string") {
        const path = toPath(input);

        if (isFilePath(path)) {
            const stats = await fs.stat(path);

            return stats.size;
        }

        if (typeof input === "string") {
            return Buffer.from(input).length;
        }
    }

    if (input instanceof Readable) {
        let size = 0;

        // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
        for await (const chunk of input) {
            // eslint-disable-next-line @typescript-eslint/restrict-plus-operands,@typescript-eslint/no-unsafe-member-access
            size += chunk.length;
        }

        return size;
    }

    return (input as Buffer).length;
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
 *
 * @example
 * // Get size of a string
 * const stringSize = gzipSizeSync("Hello, World!");
 * console.log(stringSize); // e.g., 33
 *
 * @example
 * // Get size of a file
 * const fileSize = gzipSizeSync("/path/to/file.txt");
 * console.log(fileSize); // e.g., 1024
 *
 * @example
 * // With custom options
 * const customSize = gzipSizeSync("content", { level: 9 });
 * console.log(customSize); // e.g., 28
 */
export const gzipSizeSync = (input: Buffer | URL | string, options?: ZlibOptions): number => {
    if (input instanceof URL || typeof input === "string") {
        const path = toPath(input);

        if (isFilePath(path)) {
            const fileContent = readFileSync(path);

            return gzipSync(fileContent, options).length;
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
 *
 * @example
 * // Get size of a string
 * const stringSize = brotliSizeSync("Hello, World!");
 * console.log(stringSize); // e.g., 29
 *
 * @example
 * // Get size of a file
 * const fileSize = brotliSizeSync("/path/to/file.txt");
 * console.log(fileSize); // e.g., 956
 *
 * @example
 * // With custom options
 * const customSize = brotliSizeSync("content", { quality: 11 });
 * console.log(customSize); // e.g., 25
 */
export const brotliSizeSync = (input: Buffer | URL | string, options?: BrotliOptions): number => {
    if (input instanceof URL || typeof input === "string") {
        const path = toPath(input);

        if (isFilePath(path)) {
            const fileContent = readFileSync(path);

            return brotliCompressSync(fileContent, options).length;
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
 *
 * @example
 * // Get size of a string
 * const stringSize = rawSizeSync("Hello, World!");
 * console.log(stringSize); // 13
 *
 * @example
 * // Get size of a file
 * const fileSize = rawSizeSync("/path/to/file.txt");
 * console.log(fileSize); // e.g., 2048
 *
 * @example
 * // Get size of a buffer
 * const bufferSize = rawSizeSync(Buffer.from("Hello"));
 * console.log(bufferSize); // 5
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
