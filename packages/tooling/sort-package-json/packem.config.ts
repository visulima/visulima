import type { BuildConfig } from "@visulima/packem/config";
import isolatedDeclarationTransformer from "@visulima/packem/dts/isolated/transformer/typescript";
import { defineConfig } from "@visulima/packem/config";
import transformer from "@visulima/packem/transformer/esbuild";

// eslint-disable-next-line import/no-unused-modules
export default defineConfig({
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
                    "@visulima/sort-package-json-binding-darwin-arm64",
                    "@visulima/sort-package-json-binding-darwin-x64",
                    "@visulima/sort-package-json-binding-linux-arm64-gnu",
                    "@visulima/sort-package-json-binding-linux-arm64-musl",
                    "@visulima/sort-package-json-binding-linux-x64-gnu",
                    "@visulima/sort-package-json-binding-linux-x64-musl",
                    "@visulima/sort-package-json-binding-win32-arm64-msvc",
                    "@visulima/sort-package-json-binding-win32-x64-msvc",
                ],
            },
        },
    },
}) as BuildConfig;
