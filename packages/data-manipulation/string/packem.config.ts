import type { BuildConfig } from "@visulima/packem/config";
import { defineConfig } from "@visulima/packem/config";
import transformer from "@visulima/packem/transformer/esbuild";
import { optimizeLodashImports } from "@optimize-lodash/rollup-plugin";

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
        plugins: [
            {
                enforce: "pre",
                plugin: optimizeLodashImports(),
            },
        ],
    },
    transformer,
}) as BuildConfig;
