import type { BuildConfig } from "@visulima/packem/config";
import isolatedDeclarationTransformer from "@visulima/packem/dts/isolated/transformer/typescript";
import { defineConfig } from "@visulima/packem/config";
import transformer from "@visulima/packem/transformer/esbuild";

// eslint-disable-next-line import/no-unused-modules
export default defineConfig({
    runtime: "node",
    rollup: {
        license: {
            path: "./LICENSE.md",
        },
        requireCJS: {
            builtinNodeModules: true,
        },
    },
    transformer,
    isolatedDeclarationTransformer,
    cjsInterop: true,
    validation: {
        packageJson: {
            exports: false,
        },
        dependencies: {
            unused: {
                exclude: [
                    "@visulima/tui-binding-darwin-arm64",
                    "@visulima/tui-binding-darwin-x64",
                    "@visulima/tui-binding-linux-arm64-gnu",
                    "@visulima/tui-binding-linux-arm64-musl",
                    "@visulima/tui-binding-linux-x64-gnu",
                    "@visulima/tui-binding-linux-x64-musl",
                    "@visulima/tui-binding-win32-arm64-msvc",
                    "@visulima/tui-binding-win32-x64-msvc",
                    "react-devtools-core",
                ],
            },
        },
    },
}) as BuildConfig;
