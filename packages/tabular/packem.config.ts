import typedocBuilder from "@visulima/packem/builder/typedoc";
import type { BuildConfig } from "@visulima/packem/config";
import { defineConfig } from "@visulima/packem/config";
import transformer from "@visulima/packem/transformer/esbuild";

export default defineConfig({
    runtime: "node",
    builder: {
        // TODO: add it back after its fixed in the alpha
        // typedoc: typedocBuilder,
    },
    rollup: {
        license: {
            path: "./LICENSE.md",
        },
        requireCJS: {
            builtinNodeModules: true,
        },
    },
    transformer,
    typedoc: {
        excludeInternal: true,
        excludePrivate: true,
        format: "inline",
        readmePath: "./README.md",
    },
}) as BuildConfig;
