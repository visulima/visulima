import type { BuildConfig } from "@visulima/packem/config";
import isolatedDeclarationTransformer from "@visulima/packem/dts/isolated/transformer/typescript";
import { defineConfig } from "@visulima/packem/config";
import transformer from "@visulima/packem/transformer/esbuild";
import { createPreactPreset } from "@visulima/packem/config/preset/preact";

// eslint-disable-next-line import/no-unused-modules
export default defineConfig({
    runtime: "node",
    preset: createPreactPreset(),
    isolatedDeclarationTransformer,
    rollup: {
        license: {
            path: "./LICENSE.md",
        },
        requireCJS: {
            builtinNodeModules: true,
        },
    },
    transformer,
}) as BuildConfig;
