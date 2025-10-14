import type { BuildConfig } from "@visulima/packem/config";
import { defineConfig } from "@visulima/packem/config";
import transformer from "@visulima/packem/transformer/esbuild";
import type { Plugin } from "rollup";

// eslint-disable-next-line import/no-unused-modules
export default defineConfig({
    node10Compatibility: {
        writeToPackageJson: true,
        typeScriptVersion: ">=5.0",
    },
    rollup: {
        license: {
            path: "./LICENSE.md",
        },
        plugins: [
            // workaround for the issue with default and named exports in the cjs build
            {
                enforce: "post",
                plugin: <Plugin>{
                    name: "colorize-plugin",
                    generateBundle(options, output) {
                        if (options.format === "cjs") {
                            const outputKeys = Object.keys(output);

                            if (outputKeys.includes("index.server.cjs")) {
                                output[outputKeys[0]].code = output[outputKeys[0]].code.replace(
                                    `module.exports.Colorize = Colorize;\nmodule.exports = colorize;`,
                                    `module.exports = colorize;\nmodule.exports.Colorize = Colorize;`,
                                );

                                // prod
                                output[outputKeys[0]].code = output[outputKeys[0]].code.replace(
                                    `exports.Colorize=X;exports.default=V`,
                                    `module.exports=V;module.exports.Colorize=X`,
                                );
                            }
                        }
                    },
                },
            },
            requireCJS: {
                builtinNodeModules: true,
            },
        ],
    },
    transformer,
    cjsInterop: true,
}) as BuildConfig;
