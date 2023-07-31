import { mkdir, writeFile } from "node:fs";
import { dirname } from "node:path";
import { exit } from "node:process";
import { collect } from "@visulima/readdir";

import type { Compiler } from "webpack";

import type { BaseDefinition } from "../exported.d";
import jsDocumentCommentsToOpenApi from "../jsdoc/comments-to-open-api";
import parseFile from "../parse-file";
import SpecBuilder from "../spec-builder";
import swaggerJsDocumentCommentsToOpenApi from "../swagger-jsdoc/comments-to-open-api";
import validate from "../validate";

const exclude = [
    "coverage/**",
    ".github/**",
    "packages/*/test{,s}/**",
    "**/*.d.ts",
    "test{,s}/**",
    "test{,-*}.{js,cjs,mjs,ts,tsx,jsx,yaml,yml}",
    "**/*{.,-}test.{js,cjs,mjs,ts,tsx,jsx,yaml,yml}",
    "**/__tests__/**",
    "**/{ava,babel,nyc}.config.{js,cjs,mjs}",
    "**/jest.config.{js,cjs,mjs,ts}",
    "**/{karma,rollup,webpack}.config.js",
    "**/.{eslint,mocha}rc.{js,cjs}",
    "**/.{travis,yarnrc}.yml",
    "**/{docker-compose,docker}.yml",
    "**/.yamllint.{yaml,yml}",
    "**/node_modules/**",
    "**/pnpm-lock.yaml",
    "**/pnpm-workspace.yaml",
    "**/{package,package-lock}.json",
    "**/yarn.lock",
    "**/package.json5",
    "**/.next/**",
];

const errorHandler = (error: any) => {
    if (error) {
        // eslint-disable-next-line no-console
        console.error(error);

        exit(1);
    }
};

class SwaggerCompilerPlugin {
    private readonly assetsPath: string;

    private readonly ignore: ReadonlyArray<string> | string;

    private readonly sources: string[];

    private readonly swaggerDefinition: BaseDefinition;

    private readonly verbose: boolean;

    public constructor(
        assetsPath: string,
        sources: string[],
        swaggerDefinition: BaseDefinition,
        options: {
            ignore?: ReadonlyArray<string> | string;
            verbose?: boolean;
        },
    ) {
        this.assetsPath = assetsPath;
        this.swaggerDefinition = swaggerDefinition;
        this.sources = sources;
        this.verbose = options.verbose ?? false;
        this.ignore = options.ignore ?? [];
    }

    public apply(compiler: Compiler): void {
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        compiler.hooks.make.tapAsync("SwaggerCompilerPlugin", async (_, callback: VoidFunction): Promise<void> => {
            // eslint-disable-next-line no-console
            console.log("Build paused, switching to swagger build");

            const spec = new SpecBuilder(this.swaggerDefinition);

            // eslint-disable-next-line no-restricted-syntax,unicorn/prevent-abbreviations
            for await (const dir of this.sources) {
                const files = await collect(dir, {
                    extensions: [".js", ".cjs", ".mjs", ".ts", ".tsx", ".jsx", ".yaml", ".yml"],
                    includeDirs: false,
                    minimatchOptions: {
                        match: {
                            debug: this.verbose,
                            matchBase: true,
                        },
                        skip: {
                            debug: this.verbose,
                            matchBase: true,
                        },
                    },
                    skip: [...this.ignore, ...exclude],
                });

                if (this.verbose) {
                    // eslint-disable-next-line no-console
                    console.log(`Found ${files.length} files in ${dir}`);
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
                    console.log(JSON.stringify(spec, null, 2));
                }

                await validate(JSON.parse(JSON.stringify(spec)));
            } catch (error: any) {
                // eslint-disable-next-line no-console
                console.error(error.toJSON());

                exit(1);
            }

            const { assetsPath } = this;

            // eslint-disable-next-line security/detect-non-literal-fs-filename
            mkdir(dirname(assetsPath), { recursive: true }, (error) => {
                if (error) {
                    errorHandler(error);
                }

                // eslint-disable-next-line security/detect-non-literal-fs-filename
                writeFile(assetsPath, JSON.stringify(spec, null, 2), errorHandler);
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
