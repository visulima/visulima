import fs from "node:fs";
import path from "node:path";
import type { BaseDefinition } from "@visulima/jsdoc-open-api";
import compilerPlugin from "@visulima/jsdoc-open-api/plugin/webpack";
import type { NextConfig } from "next/types";
import type { NextJsWebpackConfig, WebpackConfigContext } from "next/dist/server/config-shared";
import type { Configuration } from "webpack";

const withOpenApi =
    ({
        definition,
        ignore = [],
        output = "swagger/swagger.json",
        sources,
        verbose,
    }: {
        definition: Exclude<BaseDefinition, "openapi"> & { openapi?: string };
        ignore?: string[];
        output: string;
        sources: string[];
        swaggerApiPath: string;
        verbose?: boolean;
    }) =>
    (nextConfig: NextConfig): NextConfig =>
        ({
            ...nextConfig,
            webpack: (config: Configuration, options: WebpackConfigContext) => {
                if (!options.isServer) {
                    return config;
                }

                if (output.startsWith("/")) {
                    // eslint-disable-next-line no-param-reassign
                    output = output.slice(1);
                }

                if (!output.endsWith(".json")) {
                    throw new Error("The output path must end with .json");
                }

                // eslint-disable-next-line no-param-reassign
                config = {
                    ...config,
                    plugins: [
                        // @ts-expect-error: ignore
                        ...config.plugins,
                        compilerPlugin({
                            exclude: ignore,
                            include: sources.map((source) => {
                                const combinedPath = path.join(options.dir as string, source.replace("./", ""));

                                // Check if the path is a directory
                                fs.lstatSync(combinedPath).isDirectory();

                                return combinedPath;
                            }),
                            outputFilePath: output,
                            swaggerDefinition: {
                                // @ts-expect-error: This property should be overwritten
                                openapi: "3.0.0",
                                ...definition,
                            },
                            verbose,
                        }),
                    ],
                };

                if (typeof nextConfig.webpack === "function") {
                    return nextConfig.webpack(config, options) as NextJsWebpackConfig;
                }

                return config as NextJsWebpackConfig;
            },
        }) as NextConfig;

export default withOpenApi;
