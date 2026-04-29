import type { BuildConfig } from "@visulima/packem/config";
import { defineConfig } from "@visulima/packem/config";
import transformer from "@visulima/packem/transformer/esbuild";

// eslint-disable-next-line import/no-unused-modules
export default defineConfig({
    runtime: "node",
    externals: [/^@visulima\/vis(\/|$)/],
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
        },
    },
}) as BuildConfig;
