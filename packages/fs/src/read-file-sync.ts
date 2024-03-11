import { readFileSync as nodeReadFileSync } from "node:fs";
import { brotliDecompressSync, unzipSync } from "node:zlib";

import { R_OK } from "./constants";
import PermissionError from "./error/permission-error";
import isAccessibleSync from "./is-accessible-sync";
import type { ContentType, ReadFileOptions } from "./types";
import assertValidFileOrDirectoryPath from "./utils/assert-valid-file-or-directory-path";
import toPath from "./utils/to-path";

const decompressionMethods = {
    brotli: brotliDecompressSync,
    gzip: unzipSync,
    none: (buffer: Buffer) => buffer,
} as const;

const readFileSync = <O extends ReadFileOptions<keyof typeof decompressionMethods> | undefined = undefined>(
    path: URL | string,
    options?: O,
): ContentType<O> | undefined => {
    assertValidFileOrDirectoryPath(path);

    // eslint-disable-next-line no-param-reassign
    path = toPath(path);

    if (!isAccessibleSync(path)) {
        throw new PermissionError(`unable to read the non-accessible file: ${path}`);
    }

    if (!isAccessibleSync(path, R_OK)) {
        throw new PermissionError(`invalid access to read file at: ${path}`);
    }

    const { buffer, compression, encoding, flag } = options ?? {};

    // @ts-expect-error - TS doesn't like our typed `encoding` option
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    const content = nodeReadFileSync(path, flag ? { encoding, flag } : { encoding });

    const decompressed = decompressionMethods[compression ?? "none"](content);

    return (buffer ? decompressed : decompressed.toString()) as ContentType<O>;
};

export default readFileSync;
