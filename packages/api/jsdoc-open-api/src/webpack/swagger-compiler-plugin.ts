import { mkdir, writeFile } from "node:fs";
import { dirname } from "node:path";
import { exit } from "node:process";

import { collect } from "@visulima/fs";

import { DEFAULT_EXCLUDE } from "../constants";
import type { BaseDefinition } from "../exported";
import jsDocumentCommentsToOpenApi from "../jsdoc/comments-to-open-api";
import parseFile from "../parse-file";
import SpecBuilder from "../spec-builder";
import swaggerJsDocumentCommentsToOpenApi from "../swagger-jsdoc/comments-to-open-api";
import validate from "../validate";

// webpack uses `export = exports` CJS-namespace types (webpack/types.d.ts), which
// rollup-plugin-dts can't trace at bundle time. Using an inline type reference
// keeps the import out of the module-level import graph for dts generation.

type WebpackCompiler = import("webpack").Compiler;

const errorHandler = (error: any) => {
    if (error) {
        // eslint-disable-next-line no-console
        console.error(error);

        exit(1);
    }
};

class SwaggerCompilerPlugin {
    private readonly assetsPath: string;

    private readonly ignore: (RegExp | string)[];

    private readonly sources: string[];

    private readonly swaggerDefinition: BaseDefinition;

    private readonly verbose: boolean;

    public constructor(
        assetsPath: string,
        sources: string[],
        swaggerDefinition: BaseDefinition,
        options: {
            ignore?: (RegExp | string)[];
            verbose?: boolean;
        },
    ) {
        this.assetsPath = assetsPath;
        this.swaggerDefinition = swaggerDefinition;
        this.sources = sources;
        this.verbose = options.verbose ?? false;
        this.ignore = options.ignore ?? [];
    }

    public apply(compiler: WebpackCompiler): void {
        const skip = new Set<RegExp | string>([...DEFAULT_EXCLUDE, ...this.ignore]);

        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        compiler.hooks.make.tapAsync("SwaggerCompilerPlugin", async (_, callback: VoidFunction): Promise<void> => {
            // eslint-disable-next-line no-console
            console.log("Build paused, switching to swagger build");

            const spec = new SpecBuilder(this.swaggerDefinition);

            // eslint-disable-next-line unicorn/prevent-abbreviations
            for (const dir of this.sources) {
                // eslint-disable-next-line no-await-in-loop
                const files: string[] = await collect(dir, {
                    extensions: [".js", ".cjs", ".mjs", ".ts", ".tsx", ".jsx", ".yaml", ".yml"],
                    includeDirs: false,
                    skip: [...skip],
                });

                if (this.verbose) {
                    // eslint-disable-next-line no-console
                    console.log(`Found ${String(files.length)} files in ${dir}`);
                    // eslint-disable-next-line no-console
                    console.log(files);
                }

                files.forEach((file) => {
                    if (this.verbose) {
                        // eslint-disable-next-line no-console
                        console.log(`Parsing file ${file}`);
                    }

                    try {
                        const parsedJsDocumentFile = parseFile(file, jsDocumentCommentsToOpenApi, this.verbose);

                        spec.addData(parsedJsDocumentFile.map((item) => item.spec));

                        const parsedSwaggerJsDocumentFile = parseFile(file, swaggerJsDocumentCommentsToOpenApi, this.verbose);

                        spec.addData(parsedSwaggerJsDocumentFile.map((item) => item.spec));
                    } catch (error) {
                        // eslint-disable-next-line no-console
                        console.error(error);

                        exit(1);
                    }
                });
            }

            try {
                if (this.verbose) {
                    // eslint-disable-next-line no-console
                    console.log("Validating swagger spec");
                    // eslint-disable-next-line no-console
                    console.log(JSON.stringify(spec, undefined, 2));
                }

                await validate(structuredClone(spec) as unknown as Record<string, unknown>);
            } catch (error: any) {
                // eslint-disable-next-line no-console
                console.error(error.toJSON());

                exit(1);
            }

            const { assetsPath } = this;

            mkdir(dirname(assetsPath), { recursive: true }, (error) => {
                if (error) {
                    errorHandler(error);
                }

                writeFile(assetsPath, JSON.stringify(spec, undefined, 2), errorHandler);
            });

            if (this.verbose) {
                // eslint-disable-next-line no-console
                console.log(`Written swagger spec to "${this.assetsPath}" file`);
            }

            // eslint-disable-next-line no-console
            console.log("switching back to normal build");

            callback();
        });
    }
}

export default SwaggerCompilerPlugin;
