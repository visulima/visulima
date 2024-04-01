import type { JscConfig } from "@swc/core";
import type { Plugin } from "esbuild";
import { dirname, isAbsolute, relative } from "pathe";

import logger from "../../../../../logger";
import tryRequire from "../../../../../utils/try-require";

const swcTsDecorator = (): Plugin => {
    return {
        name: "swc-ts-decorator",

        setup(build) {
            const swc: typeof import("@swc/core") = tryRequire("@swc/core");

            if (!swc) {
                logger.warn(build.initialOptions.format!, `You have emitDecoratorMetadata enabled but @swc/core was not installed, skipping swc plugin`);
                return;
            }

            // Force esbuild to keep class names as well
            build.initialOptions.keepNames = true;

            build.onLoad({ filter: /\.[jt]sx?$/ }, async (arguments_) => {
                const isTs = /\.tsx?$/.test(arguments_.path);

                const jsc: JscConfig = {
                    keepClassNames: true,
                    parser: {
                        decorators: true,
                        syntax: isTs ? "typescript" : "ecmascript",
                    },
                    target: "es2022",
                    transform: {
                        decoratorMetadata: true,
                        legacyDecorator: true,
                    },
                };

                const result = await swc.transformFile(arguments_.path, {
                    configFile: false,
                    jsc,
                    sourceMaps: true,
                    swcrc: false,
                });

                let {code} = result;

                if (result.map) {
                    const map: { sources: string[] } = JSON.parse(result.map);
                    // Make sure sources are relative path
                    map.sources = map.sources.map((source) => (isAbsolute(source) ? relative(dirname(arguments_.path), source) : source));
                    code += `//# sourceMappingURL=data:application/json;base64,${Buffer.from(JSON.stringify(map)).toString("base64")}`;
                }

                return {
                    contents: code,
                };
            });
        },
    };
};

export default swcTsDecorator;
