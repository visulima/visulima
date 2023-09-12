import type { UnpluginBuildContext, UnpluginFactory } from "unplugin";
import { exit } from "node:process";
import { collect } from "@visulima/readdir";
import cliProgress from "cli-progress";
import colors from "ansi-colors";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import sources from "webpack-sources";
import type { Compiler as WebpackCompiler } from "webpack";
import { Compilation } from "webpack";
import type { Compiler as RsCompiler } from "@rspack/core";
import { parseLongSyntax, parseShortSyntax } from "@visulima/openapi-comment-parser";
import type { OpenAPIV3_1 } from "openapi-types";

import SpecBuilder from "./spec-builder";
import type { Options } from "./types";
import { resolveOptions } from "./options";
import parseYaml from "./util/parse-yaml";

const PLUGIN_NAME = "openapi-jsdoc-compiler";

const unpluginFactory: UnpluginFactory<Options, false> = (options) => {
    const config = resolveOptions(options);

    let files: string[] = [];
    let fileContent: string;

    const generateCode = async (foundFiles: string[]) => {
        const spec = new SpecBuilder(config.swaggerDefinition);

        const singleBar = new cliProgress.SingleBar(
            {
                clearOnComplete: false,
                format: `{value}/{total} | ${colors.green("{bar}")} | {filename}`,
                hideCursor: true,
            },
            cliProgress.Presets.shades_grey,
        );

        singleBar.start(foundFiles.length, 0);

        foundFiles.forEach((filePath) => {
            if (config.verbose) {
                // eslint-disable-next-line no-console
                console.log(`Parsing file ${filePath}`);
            }

            singleBar.increment(1, { filename: filePath });

            const extension = extname(filePath);
            // eslint-disable-next-line security/detect-non-literal-fs-filename
            const content = readFileSync(filePath, { encoding: "utf8" });

            try {
                if ([".yaml", ".yml"].includes(extension)) {
                    const parsedYaml = parseYaml(content, filePath);

                    spec.addData(parsedYaml.map(({ spec: data }) => data as OpenAPIV3_1.Document));
                } else if ([".cjs", ".cts", ".js", ".jsx", ".mjs", ".mts", ".ts", ".tsx"].includes(extension)) {
                    const parsedShortJsDocumentFile = parseShortSyntax(content);

                    spec.addData(parsedShortJsDocumentFile.map(({ spec: data }) => data as OpenAPIV3_1.Document));

                    const parsedLongJsDocumentFile = parseLongSyntax(content);

                    spec.addData(parsedLongJsDocumentFile.map(({ spec: data }) => data as OpenAPIV3_1.Document));
                } else if (extension === ".json") {
                    const parsedJson = JSON.parse(content);

                    spec.addData(parsedJson as OpenAPIV3_1.Document);
                }
            } catch (error) {
                // eslint-disable-next-line no-console
                console.error(error);

                if (config.stopOnInvalid) {
                    exit(1);
                }
            }
        });

        singleBar.stop();

        try {
            // eslint-disable-next-line no-console
            console.log("\nValidating OpenApi spec...");

            if (config.verbose) {
                // eslint-disable-next-line no-console
                console.log(`\n${JSON.stringify(spec, null, 2)}\n`);
            }

            await validate(JSON.parse(JSON.stringify(spec)));

            // eslint-disable-next-line no-console
            console.log("\nOpenApi spec is valid\n");
        } catch (error: any) {
            // eslint-disable-next-line no-console
            console.error(error.toJSON());

            if (config.stopOnInvalid) {
                exit(1);
            }
        }

        return JSON.stringify(spec, null, 2);
    };

    const buildStart = async (context: UnpluginBuildContext) => {
        // eslint-disable-next-line no-console
        console.log("\nStarting the search for OpenApi jsdoc files to parse...\n");

        // eslint-disable-next-line no-restricted-syntax
        for await (const directory of config.include) {
            files = await collect(directory, {
                extensions: config.extensions,
                includeDirs: false,
                minimatchOptions: {
                    match: {
                        debug: config.verbose,
                        matchBase: true,
                    },
                    skip: {
                        debug: config.verbose,
                        matchBase: true,
                    },
                },
                skip: [...config.exclude, config.outputFilePath],
            });

            if (config.verbose) {
                // eslint-disable-next-line no-console
                console.log(`Found ${files.length} files in "${directory}" directory`);
                // eslint-disable-next-line no-console
                console.log(files);
            }
        }

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
            fileContent = await generateCode(files);

            this.emitFile({
                fileName: config.outputFilePath,
                source: fileContent,
                type: "asset",
            });
        },
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        async watchChange(this, id) {
            if (!files.includes(id)) {
                return;
            }

            fileContent = await generateCode(files);
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
                    fileContent = await generateCode(files);

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
                });
            },
        },
        rspack(compiler: RsCompiler) {
            compiler.hooks.emit.tapPromise(PLUGIN_NAME, async (compilation) => {
                const emittedFile = {
                    fileName: config.outputFilePath,
                    source: fileContent,
                };

                if (emittedFile.source && emittedFile.fileName) {
                    compilation.emitAsset(emittedFile.fileName, new sources.RawSource(emittedFile.source));
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
                        // eslint-disable-next-line no-param-reassign
                        assets[config.outputFilePath] = {
                            size: () => fileContent.length,
                            source: () => fileContent,
                        };
                    },
                );
            });
        },
    };
};

export default unpluginFactory;
