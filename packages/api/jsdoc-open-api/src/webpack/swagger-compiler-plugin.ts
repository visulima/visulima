import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import { collect } from "@visulima/fs";

import { DEFAULT_EXCLUDE } from "../constants";
import type { BaseDefinition } from "../exported";
import jsDocumentCommentsToOpenApi from "../jsdoc/comments-to-open-api";
import { parseFileMulti } from "../parse-file";
import SpecBuilder from "../spec-builder";
import swaggerJsDocumentCommentsToOpenApi from "../swagger-jsdoc/comments-to-open-api";
import validate from "../validate";

// webpack uses `export = exports` CJS-namespace types (webpack/types.d.ts), which
// rollup-plugin-dts can't trace at bundle time. Using an inline type reference
// keeps the import out of the module-level import graph for dts generation.

type WebpackCompiler = import("webpack").Compiler;
type WebpackCompilation = import("webpack").Compilation;

const translators = [jsDocumentCommentsToOpenApi, swaggerJsDocumentCommentsToOpenApi];

const toError = (error: unknown): Error => {
    if (error instanceof Error) {
        return error;
    }

    return new Error(String(error));
};

class SwaggerCompilerPlugin {
    private readonly assetsPath: string;

    private readonly ignore: (RegExp | string)[];

    private readonly silent: boolean;

    private readonly sources: string[];

    private readonly swaggerDefinition: BaseDefinition;

    private readonly verbose: boolean;

    public constructor(
        assetsPath: string,
        sources: string[],
        swaggerDefinition: BaseDefinition,
        options: {
            ignore?: (RegExp | string)[];
            /** Suppress the informational "Build paused…" / "switching back…" logs. */
            silent?: boolean;
            verbose?: boolean;
        },
    ) {
        this.assetsPath = assetsPath;
        this.swaggerDefinition = swaggerDefinition;
        this.sources = sources;
        this.verbose = options.verbose ?? false;
        this.silent = options.silent ?? false;
        this.ignore = options.ignore ?? [];
    }

    public apply(compiler: WebpackCompiler): void {
        const skip = new Set<RegExp | string>([...DEFAULT_EXCLUDE, ...this.ignore]);

        compiler.hooks.make.tapAsync(
            "SwaggerCompilerPlugin",
            // eslint-disable-next-line @typescript-eslint/no-misused-promises
            async (compilation: WebpackCompilation, callback: (error?: Error) => void): Promise<void> => {
                this.log("Build paused, switching to swagger build");

                const spec = new SpecBuilder(this.swaggerDefinition);

                try {
                    // eslint-disable-next-line unicorn/prevent-abbreviations
                    for (const dir of this.sources) {
                        // eslint-disable-next-line no-await-in-loop
                        const files: string[] = await collect(dir, {
                            extensions: [".js", ".cjs", ".mjs", ".ts", ".tsx", ".jsx", ".yaml", ".yml"],
                            includeDirs: false,
                            skip: [...skip],
                        });

                        if (this.verbose) {
                            this.log(`Found ${String(files.length)} files in ${dir}`);
                            this.log(JSON.stringify(files));
                        }

                        files.forEach((file) => {
                            if (this.verbose) {
                                this.log(`Parsing file ${file}`);
                            }

                            spec.addData(parseFileMulti(file, translators, this.verbose).map((item) => item.spec));
                        });
                    }

                    if (this.verbose) {
                        this.log("Validating swagger spec");
                        this.log(JSON.stringify(spec, undefined, 2));
                    }

                    await validate(structuredClone(spec) as unknown as Record<string, unknown>);

                    const { assetsPath } = this;

                    await mkdir(dirname(assetsPath), { recursive: true });
                    await writeFile(assetsPath, JSON.stringify(spec, undefined, 2));

                    if (this.verbose) {
                        this.log(`Written swagger spec to "${this.assetsPath}" file`);
                    }
                } catch (error) {
                    // Surface the failure through webpack's diagnostics instead of
                    // killing the host process (e.g. the Next.js dev server).
                    const wrapped = toError(error);

                    // `compilation.errors` may be unavailable on minimal/fake compilers.
                    if (Array.isArray((compilation as { errors?: unknown[] }).errors)) {
                        (compilation as { errors: Error[] }).errors.push(wrapped);
                    }

                    callback(wrapped);

                    return;
                }

                this.log("switching back to normal build");

                callback();
            },
        );
    }

    private log(message: string): void {
        if (!this.silent) {
            // eslint-disable-next-line no-console
            console.log(message);
        }
    }
}

export default SwaggerCompilerPlugin;
