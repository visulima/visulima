import { readFile as nodeReadFile } from "node:fs/promises";
import { brotliDecompress, unzip } from "node:zlib";

import type { ContentType, ReadFileOptions } from "./types";

const decompressionMethods = {
    brotli: brotliDecompress,
    gzip: unzip,
    none: (buffer: Buffer, callback: (error: Error | null, result: Buffer) => void) => {
        callback(null, buffer);
    },
} as const;

const readFile = async <O extends ReadFileOptions<keyof typeof decompressionMethods> | undefined = undefined>(
    path: string,
    options?: O,
): Promise<ContentType<O> | undefined> => {
    const { buffer, compression, encoding, flag } = options ?? {};

    // @ts-expect-error - TS doesn't like our typed `encoding` option
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    return await nodeReadFile(path, flag ? { encoding, flag } : { encoding })
        .then(
            async (content) =>
                // eslint-disable-next-line compat/compat
                await new Promise<ContentType<O> | undefined>((resolve) => {
                    decompressionMethods[compression ?? "none"](content, (error, result) => {
                        if (error) {
                            resolve(undefined);
                        } else {
                            resolve((buffer ? result : result.toString()) as ContentType<O>);
                        }
                    });
                }),
        )
        .catch(() => undefined);
};

export default readFile;
