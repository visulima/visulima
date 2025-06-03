import { readFile as nodeReadFile } from "node:fs/promises";
import { brotliDecompress, unzip } from "node:zlib";

import { toPath } from "@visulima/path/utils";

import { R_OK } from "../constants";
import PermissionError from "../error/permission-error";
import isAccessible from "../is-accessible";
import type { ContentType, ReadFileOptions } from "../types";
import assertValidFileOrDirectoryPath from "../utils/assert-valid-file-or-directory-path";

const decompressionMethods = {
    brotli: brotliDecompress,
    gzip: unzip,
    none: (buffer: Buffer, callback: (error: Error | null, result: Buffer) => void) => {
        callback(null, buffer);
    },
} as const;

/**
 * Asynchronously reads the entire contents of a file.
 * It can also decompress the file content if a `compression` option is provided.
 *
 * @template O - The type of the options object, extending {@link ReadFileOptions}.
 * @param path The path to the file to read. Can be a file URL or a string path.
 * @param options Optional configuration for reading the file. See {@link ReadFileOptions}.
 *                Available `compression` methods: "brotli", "gzip", "none" (default).
 * @returns A promise that resolves with the file content. The type of the content (string or Buffer)
 *          depends on the `buffer` option (defaults to string if `buffer` is false or not set).
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
    path = toPath(path) as string;

    if (!(await isAccessible(path))) {
        throw new PermissionError(`unable to read the non-accessible file: ${path}`);
    }

    if (!(await isAccessible(path, R_OK))) {
        throw new Error(`Unable to read the non-readable file: ${path}`);
    }

    const { buffer, compression, encoding, flag } = options ?? {};

    // @ts-expect-error - TS doesn't like our typed `encoding` option
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    return await nodeReadFile(path, flag ? { encoding, flag } : { encoding })
        .then(
            async (content) =>
                // eslint-disable-next-line compat/compat
                await new Promise<ContentType<O> | undefined>((resolve, reject) => {
                    decompressionMethods[compression ?? "none"](content, (error, result) => {
                        if (error) {
                            reject(error);
                        } else {
                            resolve((buffer ? result : result.toString()) as ContentType<O>);
                        }
                    });
                }),
        )
        .catch((error: unknown) => {
            throw error;
        });
};

export default readFile;
