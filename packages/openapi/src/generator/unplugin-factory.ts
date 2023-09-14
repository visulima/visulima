import type { UnpluginBuildContext, UnpluginFactory } from "unplugin";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
 
import sources from "webpack-sources";
import type { Compiler as WebpackCompiler } from "webpack";
import { Compilation } from "webpack";
import type { Compiler as RsCompiler } from "@rspack/core";

import type { Options } from "./types";
import resolveOptions from "./util/resolve-options";
import generateCode from "./util/generate-code";
import collectFiles from "./util/collect-files";

const PLUGIN_NAME = "openapi-jsdoc-compiler";

const unpluginFactory: UnpluginFactory<Options, false> = (options) => {
    const config = resolveOptions(options);

    let files: ReadonlyArray<string> = [];
    let fileContent: string | undefined;

    const buildStart = async (context: UnpluginBuildContext) => {
        files = await collectFiles(config.include, [...config.exclude, config.outputFilePath], config.extensions, config.verbose, config.followSymlinks);

        files.forEach((file) => {
            context.addWatchFile(file);
        });
    };

    return {
        apply: "build",
        enforce: "post",
        name: PLUGIN_NAME,
        // eslint-disable-next-line perfectionist/sort-objects
        async buildStart(this: UnpluginBuildContext) {
            await buildStart(this);
        },
        // eslint-disable-next-line perfectionist/sort-objects
        async buildEnd(this: UnpluginBuildContext) {
            fileContent = await generateCode(files, config.swaggerDefinition, config.verbose, config.stopOnInvalid);

            if (typeof fileContent === "string") {
                this.emitFile({
                    fileName: config.outputFilePath,
                    source: fileContent,
                    type: "asset",
                });
            }
        },
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        async watchChange(this, id) {
            if (!files.includes(id)) {
                return;
            }

            fileContent = await generateCode(files, config.swaggerDefinition, config.verbose, config.stopOnInvalid);
        },

        // eslint-disable-next-line perfectionist/sort-objects
        esbuild: {
            setup({ initialOptions, onEnd, onStart }) {
                onStart(async () => {
                    await buildStart({
                        addWatchFile: () => {},
                    } as unknown as UnpluginBuildContext);
                });

                onEnd(async () => {
                    fileContent = await generateCode(files, config.swaggerDefinition, config.verbose, config.stopOnInvalid);

                    if (typeof fileContent === "string") {
                        const emittedFile = {
                            fileName: config.outputFilePath,
                            source: fileContent,
                        };

                        if (initialOptions.outdir) {
                            const fileOutputPath = dirname(join(initialOptions.outdir, emittedFile.fileName));

                            // Ensure output directory exists for this.emitFile
                            // eslint-disable-next-line security/detect-non-literal-fs-filename
                            if (!existsSync(fileOutputPath)) {
                                // eslint-disable-next-line security/detect-non-literal-fs-filename
                                mkdirSync(fileOutputPath, { recursive: true });
                            }

                            if (emittedFile.source && emittedFile.fileName) {
                                // eslint-disable-next-line security/detect-non-literal-fs-filename
                                writeFileSync(resolve(initialOptions.outdir, emittedFile.fileName), emittedFile.source);
                            }
                        } else {
                            // eslint-disable-next-line no-console
                            console.log(
                                `${PLUGIN_NAME}: outdir is not defined in esbuild options, this plugin will not generate the "${emittedFile.fileName}" file`,
                            );
                        }
                    }
                });
            },
        },
        rspack(compiler: RsCompiler) {
            compiler.hooks.emit.tapPromise(PLUGIN_NAME, async (compilation) => {
                if (typeof fileContent === "string") {
                    const emittedFile = {
                        fileName: config.outputFilePath,
                        source: fileContent,
                    };

                    if (emittedFile.source && emittedFile.fileName) {
                        compilation.emitAsset(emittedFile.fileName, new sources.RawSource(emittedFile.source));
                    }
                }
            });
        },
        webpack(compiler: WebpackCompiler) {
            compiler.hooks.compilation.tap(PLUGIN_NAME, (compilation: Compilation) => {
                compilation.hooks.processAssets.tap(
                    {
                        name: PLUGIN_NAME,
                        stage: Compilation.PROCESS_ASSETS_STAGE_ADDITIONAL,
                    },
                    (assets: Record<string, object>) => {
                        if (typeof fileContent === "string") {
                            // eslint-disable-next-line no-param-reassign
                            assets[config.outputFilePath] = {
                                size: () => (fileContent as string).length,
                                source: () => fileContent,
                            };
                        }
                    },
                );
            });
        },
    };
};

export default unpluginFactory;
