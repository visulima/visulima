import { stat } from "node:fs/promises";

import { readFile } from "@visulima/fs";
import type { Pail } from "@visulima/pail";
import { glob } from "glob";
import globParent from "glob-parent";
import { basename, dirname, join, normalize, relative } from "pathe";
import type { Plugin, PluginContext } from "rollup";

type SingleTargetDesc = {
    dest?: string;
    exclude?: string[] | string;
    src: string[] | string;
};

type MultipleTargetsDesc = SingleTargetDesc | SingleTargetDesc[] | string[] | string;

type FileDesc = { copied: string[]; dest: string[]; timestamp: number; transform?: (content: Buffer, filename: string) => Buffer | string };

export type CopyPluginOptions = {
    copyOnce?: boolean;
    exactFileNames?: boolean;
    flatten?: boolean;
    targets: MultipleTargetsDesc;
};

// eslint-disable-next-line sonarjs/cognitive-complexity
export const copyPlugin = (options: CopyPluginOptions, logger: Pail<never, string>): Plugin => {
    const files = new Map<string, FileDesc>();
    const config = {
        copyOnce: true,
        exactFileNames: true,
        flatten: false,
        ...options,
    };

    let { targets } = config;

    if (Array.isArray(targets)) {
        targets = targets
            .map((item) => {
                if (typeof item === "string") {
                    return { src: item };
                }

                if (typeof item === "object" && "src" in item) {
                    return item;
                }

                return undefined;
            })
            .filter(Boolean) as SingleTargetDesc[];
    } else if (typeof targets === "string") {
        targets = [{ src: targets }];
    }

    return <Plugin>{
        async buildStart() {
            const results = await Promise.all(
                (targets as SingleTargetDesc[])
                    .flatMap((target) =>
                        (Array.isArray(target.src)
                            ? target.src.map((itemSource) => {
                                  return {
                                      ...target,
                                      src: itemSource,
                                  };
                              })
                            : target),
                    )
                    .map((target) =>
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
                        glob(target.src, { ignore: target.exclude }).then((result) => {
                            return {
                                dest: target.dest ?? "",
                                parent: globParent(target.src as string),
                                src: result,
                            };
                        }),
                    ),
            );

            // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
            for (const result of results) {
                // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
                for (const file of result.src) {
                    let fileDesc: FileDesc;

                    if (files.has(file)) {
                        fileDesc = files.get(file) as FileDesc;
                    } else {
                        fileDesc = {
                            copied: [],
                            dest: [],
                            timestamp: 0,
                        };
                        files.set(file, fileDesc);
                    }

                    const destination = config.flatten ? normalize(result.dest) : join(result.dest, relative(result.parent, dirname(file)));

                    if (!fileDesc.dest.includes(destination)) {
                        fileDesc.dest.push(destination);
                    }

                    (this as unknown as PluginContext).addWatchFile(file);
                }
            }

            logger.info({
                message: "Copying files...",
                prefix: "copy",
            });

            let counter = 0;

            await Promise.all(
                [...files].map(async ([fileName, fileDesc]) => {
                    let source: Buffer | undefined;

                    try {
                        // eslint-disable-next-line security/detect-non-literal-fs-filename
                        const fileStat = await stat(fileName);

                        if (!fileStat.isFile()) {
                            return;
                        }

                        const timestamp = fileStat.mtime.getTime();

                        if (timestamp > fileDesc.timestamp) {
                            // eslint-disable-next-line no-param-reassign
                            fileDesc.timestamp = timestamp;
                            // eslint-disable-next-line no-param-reassign
                            fileDesc.copied = [];
                        }

                        source = await readFile(fileName, {
                            buffer: true,
                        });
                    } catch (error: unknown) {
                        logger.error({
                            context: [error],
                            message: `error reading file ${fileName}`,
                            prefix: "copy",
                        });

                        return;
                    }

                    // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
                    for (const destination of fileDesc.dest) {
                        if (config.copyOnce && fileDesc.copied.includes(destination)) {
                            // eslint-disable-next-line no-continue
                            continue;
                        }

                        const baseName = basename(fileName);

                        // path.join removes ./ from the beginning, that's needed for rollup name/fileName fields
                        const destinationFileName = join(destination, baseName);

                        try {
                            (this as unknown as PluginContext).emitFile({
                                [config.exactFileNames ? "fileName" : "name"]: destinationFileName,
                                source,
                                type: "asset",
                            });

                            logger.debug({
                                message: `copied ${fileName} → ${destinationFileName}`,
                                prefix: "copy",
                            });

                            // eslint-disable-next-line no-plusplus
                            counter++;

                            fileDesc.copied.push(destination);
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        } catch (error: any) {
                            logger.error({
                                context: [error],
                                message: `error copying file ${fileName} → ${destinationFileName}`,
                                prefix: "copy",
                            });
                        }
                    }
                }),
            );

            logger.success(`Copied ${counter} files`);
        },
        name: "packem:copy",
    };
};
