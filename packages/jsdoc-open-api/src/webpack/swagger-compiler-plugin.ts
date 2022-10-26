import SwaggerParser from "@apidevtools/swagger-parser";
// eslint-disable-next-line import/no-extraneous-dependencies
import { collect } from "@visulima/readdir";
import _debug from "debug";
import { exit } from "node:process";
import type { Configuration } from "webpack";

import type { BaseDefinition } from "../exported";
import jsDocumentCommentsToOpenApi from "../jsdoc/comments-to-open-api";
import parseFile from "../parse-file";
import SpecBuilder from "../spec-builder";
import swaggerJsDocumentCommentsToOpenApi from "../swagger-jsdoc/comments-to-open-api";

const debug = _debug("visulima:jsdoc-open-api:swagger-compiler-plugin");

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
    "**/package-lock.json",
    "**/yarn.lock",
    "**/package.json",
    "**/package.json5",
    "**/.next/**",
];

class SwaggerCompilerPlugin {
    private readonly swaggerDefinition: BaseDefinition;

    private readonly sources: string[];

    private readonly verbose: boolean;

    private ignore: string | ReadonlyArray<string>;

    assetsPath: string;

    constructor(
        assetsPath: string,
        sources: string[],
        swaggerDefinition: BaseDefinition,
        options: {
            verbose?: boolean;
            ignore?: string | ReadonlyArray<string>;
        },
    ) {
        this.assetsPath = assetsPath;
        this.swaggerDefinition = swaggerDefinition;
        this.sources = sources;
        this.verbose = options.verbose || false;
        this.ignore = options.ignore || [];
    }

    apply(compiler: Configuration) {
        // @ts-ignore
        compiler.hooks.make.tapAsync("SwaggerCompilerPlugin", async (compilation, callback: VoidFunction) => {
            // eslint-disable-next-line no-console
            console.log("Build paused");
            // eslint-disable-next-line no-console
            console.log("switching to swagger build");

            const spec = new SpecBuilder(this.swaggerDefinition);

            // eslint-disable-next-line no-restricted-syntax,unicorn/prevent-abbreviations
            for await (const dir of this.sources) {
                const files = await collect(dir, {
                    // eslint-disable-next-line @rushstack/security/no-unsafe-regexp
                    skip: [...this.ignore, ...exclude],
                    extensions: [".js", ".cjs", ".mjs", ".ts", ".tsx", ".jsx", ".yaml", ".yml"],
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
                });

                if (this.verbose) {
                    // eslint-disable-next-line no-console
                    console.log(`Found ${files.length} files in ${dir}`);
                    // eslint-disable-next-line no-console
                    console.log(files);
                }

                files.forEach((file) => {
                    // eslint-disable-next-line testing-library/no-debugging-utils
                    debug(`Parsing file ${file}`);

                    const parsedJsDocumentFile = parseFile(file, jsDocumentCommentsToOpenApi, this.verbose);

                    spec.addData(parsedJsDocumentFile.map((item) => item.spec));

                    const parsedSwaggerJsDocumentFile = parseFile(file, swaggerJsDocumentCommentsToOpenApi, this.verbose);

                    spec.addData(parsedSwaggerJsDocumentFile.map((item) => item.spec));
                });
            }

            try {
                await SwaggerParser.validate(JSON.parse(JSON.stringify(spec)));
            } catch (error) {
                // @ts-ignore
                // eslint-disable-next-line no-console
                console.error(error.toJSON());
                exit(1);
            }

            // eslint-disable-next-line no-param-reassign
            compilation.assets[this.assetsPath] = {
                source() {
                    return JSON.stringify(spec, null, 2);
                },
                size() {
                    return Object.keys(spec).length;
                },
            };

            // eslint-disable-next-line no-console
            console.log("switching back to normal build");

            callback();
        });
    }
}

export default SwaggerCompilerPlugin;
