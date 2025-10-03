import type { BuildConfig } from "@visulima/packem/config";
import { defineConfig } from "@visulima/packem/config";
import transformer from "@visulima/packem/transformer/esbuild";

// eslint-disable-next-line import/no-unused-modules
export default defineConfig({
    rollup: {
        license: {
            path: "./LICENSE.md",
        },
    },
    transformer,
    validation: {
        dependencies: {
            unused: {
                exclude: ["@aws-sdk/signature-v4-crt", "aws-crt", "express", "node-fetch"],
            },
        },
    },
}) as BuildConfig;
