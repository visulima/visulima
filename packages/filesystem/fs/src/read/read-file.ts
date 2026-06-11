import { readFile as nodeReadFile } from "node:fs/promises";
import { brotliDecompress, unzip } from "node:zlib";

import { toPath } from "@visulima/path/utils";

import type { ContentType, ReadFileOptions } from "../types";
import assertValidFileOrDirectoryPath from "../utils/assert-valid-file-or-directory-path";
import mapReadError from "./utils/map-read-error";

type DecompressionMethod = (buffer: Buffer, callback: (error: Error | null, result: Buffer) => void) => void;

const decompressionMethods: Record<string, DecompressionMethod> = {
    brotli: brotliDecompress,
    gzip: unzip,
    none: (buffer: Buffer, callback: (error: Error | null, result: Buffer) => void) => {
        // eslint-disable-next-line unicorn/no-null -- Node.js callback convention uses null for no error
        callback(null, buffer);
    },
} as const;

/**
 * Asynchronously reads the entire contents of a file.
 * It can also decompress the file content if a `compression` option is provided.
 * @template O - The type of the options object, extending {@link ReadFileOptions}.
 * @param path The path to the file to read. Can be a file URL or a string path.
 * @param options Optional configuration for reading the file. See {@link ReadFileOptions}.
 * Available `compression` methods: "brotli", "gzip", "none" (default).
 * @returns A promise that resolves with the file content. The type of the content (string or Buffer)
 * depends on the `buffer` option (defaults to string if `buffer` is false or not set).
 * @example
 * ```javascript
 * import { readFile } from "@visulima/fs";
 * import { join } from "node:path";
 *
 * const readMyFile = async () => {
 *   try {
 *     // Read a regular text file
 *     const content = await readFile(join("path", "to", "my-file.txt"));
 *     console.log("File content:", content);
 *
 *     // Read a file as a Buffer
 *     const bufferContent = await readFile(join("path", "to", "another-file.bin"), { buffer: true });
 *     console.log("Buffer length:", bufferContent.length);
 *
 *     // Read and decompress a gzipped file
 *     // Assume my-archive.txt.gz exists
 *     // const decompressedContent = await readFile(join("path", "to", "my-archive.txt.gz"), { compression: "gzip", encoding: "utf8" });
 *     // console.log("Decompressed content:", decompressedContent);
 *   } catch (error) {
 *     console.error("Failed to read file:", error);
 *   }
 * };
 *
 * readMyFile();
 * ```
 */
const readFile = async <O extends ReadFileOptions<keyof typeof decompressionMethods> | undefined = undefined>(
    path: URL | string,
    options?: O,
): Promise<ContentType<O>> => {
    assertValidFileOrDirectoryPath(path);

    // eslint-disable-next-line no-param-reassign
    path = toPath(path);

    const { buffer, compression, encoding, flag } = options ?? {};

    let content: Buffer;

    // Read directly and translate the thrown errno into a typed error class.
    // This avoids extra `access()` pre-flight syscalls and the TOCTOU window
    // they introduced.
    try {
        content = await nodeReadFile(path, flag ? { flag } : {});
    } catch (error) {
        throw mapReadError(error, path);
    }

    return await new Promise<ContentType<O>>((resolve, reject) => {
        (decompressionMethods[compression ?? "none"] as DecompressionMethod)(content, (error, result) => {
            if (error) {
                reject(error);
            } else {
                resolve((buffer ? result : result.toString(encoding ?? "utf8")) as ContentType<O>);
            }
        });
    });
};

export default readFile;
