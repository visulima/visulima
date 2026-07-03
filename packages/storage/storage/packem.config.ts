import type { BuildConfig } from "@visulima/packem/config";
import { defineConfig } from "@visulima/packem/config";
import transformer from "@visulima/packem/transformer/esbuild";

// eslint-disable-next-line import/no-unused-modules
export default defineConfig({
    runtime: "node",
    rollup: {
        dts: {
            oxc: true,
            // Keep optional peer dependencies (AWS SDK, AI SDKs, etc.) external in
            // the emitted .d.ts files. Without this, packem inlines ~700 S3 API
            // types (~940 KB) and the AI SDK type trees into shared chunks.
            // Consumers install the peer deps themselves, so the imports resolve
            // at type-check time.
            resolve: false,
        },
        license: {
            path: "./LICENSE.md",
        },
        copy: {
            targets: [
                {
                    dest: "./adapter/nuxt",
                    src: "./src/adapter/nuxt/package.json",
                },
            ],
        },
    },
    transformer,
    validation: {
        dependencies: {
            unused: {
                exclude: ["@aws-sdk/signature-v4-crt", "aws-crt"],
            },
        },
    },
}) as BuildConfig;
