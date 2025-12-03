import fs from "node:fs";

import type { BaseDefinition } from "@visulima/jsdoc-open-api";
import { SwaggerCompilerPlugin } from "@visulima/jsdoc-open-api";
import { join } from "@visulima/path";
import type { NextJsWebpackConfig, WebpackConfigContext } from "next/dist/server/config-shared";
import type { NextConfig } from "next/types";
import type { Configuration } from "webpack";

const withOpenApi
    = ({
        definition,
        output = "swagger/swagger.json",
        sources,
        verbose,
    }: {
        definition: Exclude<BaseDefinition, "openapi"> & { openapi?: string };
        output: string;
        sources: string[];
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
                            new SwaggerCompilerPlugin(
                                `${options.dir}/${output}`,
                                sources.map((source) => {
                                    const combinedPath = join(options.dir as string, source.replace("./", ""));

                                    // Check if the path is a directory
                                    fs.lstatSync(combinedPath).isDirectory();

                                    return combinedPath;
                                }),
                                {
                                // @ts-expect-error: This property should be overwritten
                                    openapi: "3.0.0",
                                    ...definition,
                                },
                                { verbose },
                            ),
                        ],
                    };

                    if (typeof nextConfig.webpack === "function") {
                        return nextConfig.webpack(config, options) as NextJsWebpackConfig;
                    }

                    return config as NextJsWebpackConfig;
                },
            }) as NextConfig;

export default withOpenApi;
