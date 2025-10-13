import typedocBuilder from "@visulima/packem/builder/typedoc";
import type { BuildConfig } from "@visulima/packem/config";
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
    builder: {
        // TODO: add it back after its fixed in the alpha
        //typedoc: typedocBuilder,
    },
    typedoc: {
        format: "inline",
        readmePath: "./README.md",
        excludePrivate: true,
        excludeInternal: true,
    },
}) as BuildConfig;
