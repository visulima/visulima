import { readFileSync as nodeReadFileSync } from "node:fs";
import { brotliDecompressSync, unzipSync } from "node:zlib";

import type { ContentType, ReadFileOptions } from "./types";

const decompressionMethods = {
    brotli: brotliDecompressSync,
    gzip: unzipSync,
    none: (buffer: Buffer) => buffer,
} as const;

const readFileSync = <O extends ReadFileOptions<keyof typeof decompressionMethods> | undefined = undefined>(
    path: string,
    options?: O,
): ContentType<O> | undefined => {
    const { buffer, compression, encoding, flag } = options ?? {};

    try {
        // @ts-expect-error - TS doesn't like our typed `encoding` option
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        const content = nodeReadFileSync(path, flag ? { encoding, flag } : { encoding });

        const decompressed = decompressionMethods[compression ?? "none"](content);

        return (buffer ? decompressed : decompressed.toString()) as ContentType<O>;
    } catch {
        return undefined;
    }
};

export default readFileSync;
