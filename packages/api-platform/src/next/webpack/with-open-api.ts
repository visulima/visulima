import path from "node:path";
import fs from "node:fs";
import type { BaseDefinition } from "@visulima/jsdoc-open-api";
import { SwaggerCompilerPlugin } from "@visulima/jsdoc-open-api";
import type { NextConfig } from "next";
import type { Configuration } from "webpack";

const withOpenApi = ({ definition, sources, verbose, output = "swagger/swagger.json" }: { definition: BaseDefinition; sources: string[], verbose?: boolean, output: string }) => (nextConfig: NextConfig) => {

    return {
        ...nextConfig,
        webpack: (config: Configuration, options: any) => {
            if (!options.isServer) {
                return config;
            }

            if (output.startsWith("/")) {
                output = output.slice(1);
            }

            if (!output.endsWith(".json")) {
                throw new Error("The output path must end with .json");
            }

            // eslint-disable-next-line no-param-reassign
            config = {
                ...config,
                plugins: [
                // @ts-ignore
                    ...config.plugins,
                    new SwaggerCompilerPlugin(`${options.dir}/${output}`, sources.map((source) => {
                        const combinedPath = path.join(options.dir, source.replace("./", ""));

                        // Check if the path is a directory
                        fs.lstatSync(combinedPath).isDirectory();

                        return combinedPath;
                    }), definition, { verbose }),
                ],
            };

            if (typeof nextConfig.webpack === "function") {
                return nextConfig.webpack(config, options);
            }

            return config;
        },
    };
};

export default withOpenApi;
