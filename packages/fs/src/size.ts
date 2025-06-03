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
 * Asynchronously gets the size of a readable stream by consuming it and summing the length of its chunks.
 * This function is memory-efficient as it does not store the entire stream content in memory.
 *
 * @param stream The readable stream to measure.
 * @returns A promise that resolves with the total size of the stream in bytes.
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
 * Asynchronously calculates the compressed size of a readable stream using a provided compression algorithm.
 * The function pipes the input stream through a compressor and sums the size of the compressed chunks.
 * This approach is memory-efficient, avoiding loading the entire compressed stream into memory.
 *
 * @param stream The readable stream to compress and measure.
 * @param createCompressor A factory function that returns a Node.js `ReadWriteStream` (e.g., `zlib.createGzip()`).
 * @returns A promise that resolves with the total compressed size of the stream in bytes.
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
 * Asynchronously processes input data (Buffer, Readable stream, URL, or file path string) in a memory-efficient manner.
 * If the input is a file path or URL, it reads the file as a stream.
 * If the input is a string, it converts it to a Buffer.
 * It then applies the appropriate processor function (either for Buffers or streams).
 *
 * @param input The input data to process. Can be a Buffer, Readable stream, URL (representing a file path), or a string (file path or content).
 * @param processor A function to process Buffer data, returning its size.
 * @param streamProcessor An async function to process Readable stream data, returning its size.
 * @returns A promise that resolves with the size calculated by the applied processor.
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
 * Asynchronously calculates the gzipped size of the given input.
 * The input can be a Buffer, a Readable stream, a URL object pointing to a file, or a string (file path or content).
 * Uses memory-efficient streaming for files and streams to avoid loading entire contents into memory.
 *
 * @param input The input data to gzip and measure.
 * @param [options] Optional Zlib options for gzip compression.
 * @returns A promise that resolves with the gzipped size in bytes.
 * @example
 * ```javascript
 * import { gzipSize } from "@visulima/fs";
 * import { Readable } from "node:stream";
 * import { writeFile, unlink } from "node:fs/promises";
 * import { join } from "node:path";
 *
 * const text = "Lorem ipsum dolor sit amet, consectetur adipiscing elit.";
 * const filePath = join("temp-file.txt");
 *
 * async function main() {
 *   // From Buffer
 *   const buffer = Buffer.from(text);
 *   console.log(`Gzip size of buffer: ${await gzipSize(buffer)} bytes`);
 *
 *   // From string (content)
 *   console.log(`Gzip size of string content: ${await gzipSize(text)} bytes`);
 *
 *   // From file path
 *   await writeFile(filePath, text);
 *   console.log(`Gzip size of file: ${await gzipSize(filePath)} bytes`);
 *
 *   // From URL
 *   const fileUrl = new URL(`file://${filePath}`);
 *   console.log(`Gzip size of URL: ${await gzipSize(fileUrl)} bytes`);
 *
 *   // From Readable stream
 *   const stream = Readable.from(text);
 *   console.log(`Gzip size of stream: ${await gzipSize(stream)} bytes`);
 *
 *   await unlink(filePath); // Clean up temp file
 * }
 *
 * main().catch(console.error);
 * ```
 */
export const gzipSize = async (input: Buffer | Readable | URL | string, options?: ZlibOptions): Promise<number> => {
    const streamProcessor = async (stream: Readable): Promise<number> => await getCompressedStreamSizeEfficient(stream, () => createGzip(options));
    const bufferProcessor = (data: Buffer): number => gzipSync(data, options).length;

    return await processInputEfficiently(input, bufferProcessor, streamProcessor);
};

/**
 * Asynchronously calculates the Brotli compressed size of the given input.
 * The input can be a Buffer, a Readable stream, a URL object pointing to a file, or a string (file path or content).
 * Uses memory-efficient streaming for files and streams to avoid loading entire contents into memory.
 *
 * @param input The input data to compress with Brotli and measure.
 * @param [options] Optional Zlib options for Brotli compression.
 * @returns A promise that resolves with the Brotli compressed size in bytes.
 * @example
 * ```javascript
 * import { brotliSize } from "@visulima/fs";
 * import { Readable } from "node:stream";
 * import { writeFile, unlink } from "node:fs/promises";
 * import { join } from "node:path";
 *
 * const text = "This is a test string for Brotli compression efficiency.";
 * const filePath = join("temp-brotli-file.txt");
 *
 * async function main() {
 *   // From Buffer
 *   const buffer = Buffer.from(text);
 *   console.log(`Brotli size of buffer: ${await brotliSize(buffer)} bytes`);
 *
 *   // From string (content)
 *   console.log(`Brotli size of string content: ${await brotliSize(text)} bytes`);
 *
 *   // From file path
 *   await writeFile(filePath, text);
 *   console.log(`Brotli size of file: ${await brotliSize(filePath)} bytes`);
 *
 *   // From URL
 *   const fileUrl = new URL(`file://${filePath}`);
 *   console.log(`Brotli size of URL: ${await brotliSize(fileUrl)} bytes`);
 *
 *   // From Readable stream
 *   const stream = Readable.from(text);
 *   console.log(`Brotli size of stream: ${await brotliSize(stream)} bytes`);
 *
 *   await unlink(filePath); // Clean up temp file
 * }
 *
 * main().catch(console.error);
 * ```
 */
export const brotliSize = async (input: Buffer | Readable | URL | string, options?: BrotliOptions): Promise<number> => {
    const streamProcessor = async (stream: Readable): Promise<number> => await getCompressedStreamSizeEfficient(stream, () => createBrotliCompress(options));
    const bufferProcessor = (data: Buffer): number => brotliCompressSync(data, options).length;

    return await processInputEfficiently(input, bufferProcessor, streamProcessor);
};

/**
 * Asynchronously calculates the raw (uncompressed) size of the given input.
 * The input can be a Buffer, a Readable stream, a URL object pointing to a file, or a string (file path or content).
 * Uses memory-efficient streaming for files and streams to avoid loading entire contents into memory.
 *
 * @param input The input data to measure.
 * @returns A promise that resolves with the raw size in bytes.
 * @example
 * ```javascript
 * import { rawSize } from "@visulima/fs";
 * import { Readable } from "node:stream";
 * import { writeFile, unlink } from "node:fs/promises";
 * import { join } from "node:path";
 *
 * const text = "Hello, World!";
 * const filePath = join("temp-raw-file.txt");
 *
 * async function main() {
 *   // From Buffer
 *   const buffer = Buffer.from(text);
 *   console.log(`Raw size of buffer: ${await rawSize(buffer)} bytes`);
 *
 *   // From string (content)
 *   console.log(`Raw size of string content: ${await rawSize(text)} bytes`);
 *
 *   // From file path
 *   await writeFile(filePath, text);
 *   console.log(`Raw size of file: ${await rawSize(filePath)} bytes`);
 *
 *   // From URL
 *   const fileUrl = new URL(`file://${filePath}`);
 *   console.log(`Raw size of URL: ${await rawSize(fileUrl)} bytes`);
 *
 *   // From Readable stream
 *   const stream = Readable.from(text);
 *   console.log(`Raw size of stream: ${await rawSize(stream)} bytes`);
 *
 *   await unlink(filePath); // Clean up temp file
 * }
 *
 * main().catch(console.error);
 * ```
 */
export const rawSize = async (input: Buffer | Readable | URL | string): Promise<number> => {
    const streamProcessor = async (stream: Readable): Promise<number> => await getStreamSizeEfficient(stream);
    const bufferProcessor = (data: Buffer): number => data.length;

    return await processInputEfficiently(input, bufferProcessor, streamProcessor);
};

/**
 * Synchronously calculates the gzipped size of the given input.
 * The input can be a Buffer, a URL object pointing to a file, or a string (file path or content).
 * Note: For Readable streams or very large files, consider using the asynchronous `gzipSize` function for better performance and to avoid blocking.
 *
 * @param input The input data to gzip and measure.
 * @param [options] Optional Zlib options for gzip compression.
 * @returns The gzipped size in bytes.
 * @example
 * ```javascript
 * import { gzipSizeSync } from "@visulima/fs";
 * import { writeFileSync, unlinkSync } from "node:fs";
 * import { join } from "node:path";
 *
 * const text = "Lorem ipsum dolor sit amet, consectetur adipiscing elit.";
 * const filePath = join("temp-sync-file.txt");
 *
 * // From Buffer
 * const buffer = Buffer.from(text);
 * console.log(`Sync Gzip size of buffer: ${gzipSizeSync(buffer)} bytes`);
 *
 * // From string (content)
 * console.log(`Sync Gzip size of string content: ${gzipSizeSync(text)} bytes`);
 *
 * // From file path
 * try {
 *   writeFileSync(filePath, text);
 *   console.log(`Sync Gzip size of file: ${gzipSizeSync(filePath)} bytes`);
 *
 *   // From URL
 *   const fileUrl = new URL(`file://${filePath}`);
 *   console.log(`Sync Gzip size of URL: ${gzipSizeSync(fileUrl)} bytes`);
 * } finally {
 *   try { unlinkSync(filePath); } catch {} // Clean up temp file
 * }
 * ```
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
 * Synchronously calculates the Brotli compressed size of the given input.
 * The input can be a Buffer, a URL object pointing to a file, or a string (file path or content).
 * Note: For Readable streams or very large files, consider using the asynchronous `brotliSize` function for better performance and to avoid blocking.
 *
 * @param input The input data to compress with Brotli and measure.
 * @param [options] Optional Zlib options for Brotli compression.
 * @returns The Brotli compressed size in bytes.
 * @example
 * ```javascript
 * import { brotliSizeSync } from "@visulima/fs";
 * import { writeFileSync, unlinkSync } from "node:fs";
 * import { join } from "node:path";
 *
 * const text = "This is a test string for Brotli compression efficiency, synchronously.";
 * const filePath = join("temp-brotli-sync-file.txt");
 *
 * // From Buffer
 * const buffer = Buffer.from(text);
 * console.log(`Sync Brotli size of buffer: ${brotliSizeSync(buffer)} bytes`);
 *
 * // From string (content)
 * console.log(`Sync Brotli size of string content: ${brotliSizeSync(text)} bytes`);
 *
 * // From file path
 * try {
 *   writeFileSync(filePath, text);
 *   console.log(`Sync Brotli size of file: ${brotliSizeSync(filePath)} bytes`);
 *
 *   // From URL
 *   const fileUrl = new URL(`file://${filePath}`);
 *   console.log(`Sync Brotli size of URL: ${brotliSizeSync(fileUrl)} bytes`);
 * } finally {
 *   try { unlinkSync(filePath); } catch {} // Clean up temp file
 * }
 * ```
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
 * Synchronously calculates the raw (uncompressed) size of the given input.
 * The input can be a Buffer, a URL object pointing to a file, or a string (file path or content).
 * For file paths, it uses `statSync` to get the file size.
 * Note: For Readable streams or very large files, consider using the asynchronous `rawSize` function for better performance and to avoid blocking.
 *
 * @param input The input data to measure.
 * @returns The raw size in bytes.
 * @example
 * ```javascript
 * import { rawSizeSync } from "@visulima/fs";
 * import { writeFileSync, unlinkSync } from "node:fs";
 * import { join } from "node:path";
 *
 * const text = "Hello, Synchronous World!";
 * const filePath = join("temp-raw-sync-file.txt");
 *
 * // From Buffer
 * const buffer = Buffer.from(text);
 * console.log(`Sync Raw size of buffer: ${rawSizeSync(buffer)} bytes`);
 *
 * // From string (content)
 * console.log(`Sync Raw size of string content: ${rawSizeSync(text)} bytes`);
 *
 * // From file path
 * try {
 *   writeFileSync(filePath, text);
 *   console.log(`Sync Raw size of file: ${rawSizeSync(filePath)} bytes`);
 *
 *   // From URL
 *   const fileUrl = new URL(`file://${filePath}`);
 *   console.log(`Sync Raw size of URL: ${rawSizeSync(fileUrl)} bytes`);
 * } finally {
 *   try { unlinkSync(filePath); } catch {} // Clean up temp file
 * }
 * ```
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
