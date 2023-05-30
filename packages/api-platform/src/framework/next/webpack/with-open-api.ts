import type { BaseDefinition } from "@visulima/jsdoc-open-api";
import { SwaggerCompilerPlugin } from "@visulima/jsdoc-open-api";
// eslint-disable-next-line import/no-extraneous-dependencies
import type { NextConfig } from "next";
// eslint-disable-next-line import/no-extraneous-dependencies
import type { NextJsWebpackConfig } from "next/dist/server/config-shared";
import fs from "node:fs";
import path from "node:path";
import type { Configuration } from "webpack";

const withOpenApi = ({
    definition,
    sources,
    verbose,
    output = "swagger/swagger.json",
}: // eslint-disable-next-line max-len
{
    definition: Exclude<BaseDefinition, "openapi"> & { openapi?: string };
    sources: string[];
    verbose?: boolean;
    output: string;
}) => (nextConfig: NextConfig): NextConfig => ({
    ...nextConfig,
    webpack: (config: Configuration, options: any) => {
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
                // @ts-expect-error
                ...config.plugins,
                new SwaggerCompilerPlugin(
                    `${options.dir}/${output}`,
                    sources.map((source) => {
                        const combinedPath = path.join(options.dir as string, source.replace("./", ""));

                        // Check if the path is a directory
                        fs.lstatSync(combinedPath).isDirectory();

                        return combinedPath;
                    }),
                    {
                        // @ts-expect-error
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
} as NextConfig);

export default withOpenApi;
