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
    validation: {
        dependencies: {
            unused: {
                exclude: ["type-fest"],
            },
        },
    },
    transformer,
    isolatedDeclarationTransformer,
}) as BuildConfig;
