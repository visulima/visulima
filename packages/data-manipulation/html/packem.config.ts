import type { BuildConfig } from "@visulima/packem/config";
import { defineConfig } from "@visulima/packem/config";
import transformer from "@visulima/packem/transformer/esbuild";

// eslint-disable-next-line import/no-unused-modules
export default defineConfig({
    runtime: "node",
    rollup: {
        dts: {
            oxc: true,
        },
        license: {
            path: "./LICENSE.md",
        },
        requireCJS: {
            builtinNodeModules: true,
        },
    },
    validation: {
        dependencies: {
            hoisted: {
                exclude: ["@jsr/std__html"],
            },
            unused: {
                exclude: ["csstype"],
            },
        },
    },
    transformer,
}) as BuildConfig;
