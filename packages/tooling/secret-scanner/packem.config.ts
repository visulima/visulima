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
        dependencies: {
            unused: {
                exclude: [
                    "@visulima/secret-scanner-binding-darwin-arm64",
                    "@visulima/secret-scanner-binding-darwin-x64",
                    "@visulima/secret-scanner-binding-linux-arm64-gnu",
                    "@visulima/secret-scanner-binding-linux-arm64-musl",
                    "@visulima/secret-scanner-binding-linux-x64-gnu",
                    "@visulima/secret-scanner-binding-linux-x64-musl",
                    "@visulima/secret-scanner-binding-win32-arm64-msvc",
                    "@visulima/secret-scanner-binding-win32-x64-msvc",
                ],
            },
        },
    },
}) as BuildConfig;
