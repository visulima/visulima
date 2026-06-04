import type { BuildConfig } from "@visulima/packem/config";
import { defineConfig } from "@visulima/packem/config";
import transformer from "@visulima/packem/transformer/esbuild";
import { optimizeLodashImports } from "@optimize-lodash/rollup-plugin";

// eslint-disable-next-line import/no-unused-modules
export default defineConfig({
    runtime: "node",
    rollup: {
        // packem force-enables esbuild `keepNames` in production (minify) builds, which
        // wraps every named closure in an `Object.defineProperty` name-tag — costly on hot
        // paths that re-create closures per call (e.g. the per-token locale detectors in
        // split-by-case). We don't rely on our own functions' `.name`, so keep it off.
        // See visulima/visulima#678.
        esbuild: {
            keepNames: false,
        },
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
