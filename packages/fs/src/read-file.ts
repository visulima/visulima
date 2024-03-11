import { readFile as nodeReadFile } from "node:fs/promises";
import { brotliDecompress, unzip } from "node:zlib";

import { R_OK } from "./constants";
import PermissionError from "./error/permission-error";
import isAccessible from "./is-accessible";
import type { ContentType, ReadFileOptions } from "./types";
import assertValidFileOrDirectoryPath from "./utils/assert-valid-file-or-directory-path";
import toPath from "./utils/to-path";

const decompressionMethods = {
    brotli: brotliDecompress,
    gzip: unzip,
    none: (buffer: Buffer, callback: (error: Error | null, result: Buffer) => void) => {
        callback(null, buffer);
    },
} as const;

const readFile = async <O extends ReadFileOptions<keyof typeof decompressionMethods> | undefined = undefined>(
    path: URL | string,
    options?: O,
): Promise<ContentType<O> | undefined> => {
    assertValidFileOrDirectoryPath(path);

    // eslint-disable-next-line no-param-reassign
    path = toPath(path);

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
