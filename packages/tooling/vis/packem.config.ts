import type { BuildConfig } from "@visulima/packem/config";
import { defineConfig } from "@visulima/packem/config";
import tailwindcssLoader from "@visulima/packem/css/loader/tailwindcss";
import cssnanoMinifier from "@visulima/packem/css/minifier/cssnano";
import transformer from "@visulima/packem/transformer/esbuild";

// eslint-disable-next-line import/no-unused-modules
export default defineConfig({
    runtime: "node",
    externals: [/^@visulima\/vis(\/|$)/],
    rollup: {
        resolveExternals: {
            exclude: ["@visulima/tabular", /^@visulima\/tabular(\/|$)/],
        },
        css: {
            mode: "inline",
            loaders: [tailwindcssLoader],
            minifier: cssnanoMinifier,
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
    },
    transformer,
    cjsInterop: true,
    validation: {
        packageJson: {
            exports: false,
        },
        dependencies: {
            unused: {
                exclude: [
                    "@bomb.sh/tab",
                    "react-reconciler",
                    "smol-toml",
                    // sigma and graphology-types are read at runtime — sigma's UMD bundle is
                    // sliced from node_modules via require.resolve() for the graph HTML
                    // report, graphology-types is a peer of the graph runtime.
                    "sigma",
                    "graphology-types",
                    "@floating-ui/core",
                    "@floating-ui/dom",
                    "@visulima/vis-binding-darwin-arm64",
                    "@visulima/vis-binding-darwin-x64",
                    "@visulima/vis-binding-linux-arm64-gnu",
                    "@visulima/vis-binding-linux-arm64-musl",
                    "@visulima/vis-binding-linux-x64-gnu",
                    "@visulima/vis-binding-linux-x64-musl",
                    "@visulima/vis-binding-win32-arm64-msvc",
                    "@visulima/vis-binding-win32-x64-msvc",
                ],
            },
            hoisted: {
                exclude: [
                    "@antfu/install-pkg",
                    "json5",
                    "normalize-package-data",
                    "@visulima/is-ansi-color-supported",
                    "compromise",
                    "v8-compile-cache",
                    "fastest-levenshtein",
                    "terminal-size",
                    "@jridgewell/trace-mapping",
                ],
            },
        },
    },
}) as BuildConfig;
