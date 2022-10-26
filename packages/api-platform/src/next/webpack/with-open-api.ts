import type { BaseDefinition } from "@visulima/jsdoc-open-api";
import { SwaggerCompilerPlugin } from "@visulima/jsdoc-open-api";
import type { NextConfig } from "next";
import type { Configuration } from "webpack";

const withOpenApi = ({ definition, sources }: { definition: BaseDefinition; sources: string[] }) => (nextConfig: NextConfig) => {
    const publicRuntimeConfig = (nextConfig.publicRuntimeConfig || { PUBLIC_BASE_URL: "" }) as { PUBLIC_BASE_URL: string };

    return {
        ...nextConfig,
        webpack: (config: Configuration, options: any) => {
            if (!options.isServer) {
                return config;
            }

            // eslint-disable-next-line no-param-reassign
            config = {
                ...config,
                plugins: [
                // @ts-ignore
                    ...config.plugins,
                    new SwaggerCompilerPlugin(`${publicRuntimeConfig.PUBLIC_BASE_URL}/_next/static/swagger.json`, sources, definition, {}),
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
