import { readFileSync as nodeReadFileSync } from "node:fs";
import { brotliDecompressSync, unzipSync } from "node:zlib";

import { toPath } from "@visulima/path/utils";

import { R_OK } from "../constants";
import PermissionError from "../error/permission-error";
import isAccessibleSync from "../is-accessible-sync";
import type { ContentType, ReadFileOptions } from "../types";
import assertValidFileOrDirectoryPath from "../utils/assert-valid-file-or-directory-path";

type DecompressionMethod = (buffer: Buffer, callback: (error: Error | null, result: Buffer) => void) => void;

const decompressionMethods: Record<string, DecompressionMethod> = {
    brotli: brotliDecompressSync,
    gzip: unzipSync,
    none: (buffer: Buffer) => buffer,
} as const;

/**
 * Synchronously reads the entire contents of a file.
 * It can also decompress the file content if a `compression` option is provided.
 * @template O - The type of the options object, extending {@link ReadFileOptions}.
 * @param path The path to the file to read. Can be a file URL or a string path.
 * @param options Optional configuration for reading the file. See {@link ReadFileOptions}.
 * Available `compression` methods: "brotli", "gzip", "none" (default).
 * @returns The file content. The type of the content (string or Buffer)
 * depends on the `buffer` option (defaults to string if `buffer` is false or not set).
 * @example
 * ```javascript
 * import { readFileSync } from "@visulima/fs";
 * import { join } from "node:path";
 *
 * try {
 *   // Read a regular text file
 *   const content = readFileSync(join("path", "to", "my-file.txt"));
 *   console.log("File content:", content);
 *
 *   // Read a file as a Buffer
 *   const bufferContent = readFileSync(join("path", "to", "another-file.bin"), { buffer: true });
 *   console.log("Buffer length:", bufferContent.length);
 *
 *   // Read and decompress a gzipped file
 *   // Assume my-archive.txt.gz exists
 *   // const decompressedContent = readFileSync(join("path", "to", "my-archive.txt.gz"), { compression: "gzip", encoding: "utf8" });
 *   // console.log("Decompressed content:", decompressedContent);
 * } catch (error) {
 *   console.error("Failed to read file:", error);
 * }
 * ```
 */
const readFileSync = <O extends ReadFileOptions<keyof typeof decompressionMethods> | undefined = undefined>(
    path: URL | string,
    options?: O,
): ContentType<O> => {
    assertValidFileOrDirectoryPath(path);

    // eslint-disable-next-line no-param-reassign
    path = toPath(path) as string;

    if (!isAccessibleSync(path)) {
        throw new PermissionError(`unable to read the non-accessible file: ${path}`);
    }

    if (!isAccessibleSync(path, R_OK)) {
        throw new PermissionError(`invalid access to read file at: ${path}`);
    }

    const { buffer, compression, encoding, flag } = options ?? {};

    // @ts-expect-error - TS doesn't like our typed `encoding` option
    const content = nodeReadFileSync(path, flag ? { encoding, flag } : { encoding });

    const decompressed = (decompressionMethods[compression ?? "none"] as DecompressionMethod)(content);

    return (buffer ? decompressed : decompressed.toString()) as ContentType<O>;
};

export default readFileSync;
