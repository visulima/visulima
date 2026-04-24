import type { BuildConfig } from "@visulima/packem/config";
import { defineConfig } from "@visulima/packem/config";
import transformer from "@visulima/packem/transformer/esbuild";

// eslint-disable-next-line import/no-unused-modules
export default defineConfig({
    runtime: "node",
    rollup: {
        dts: {
            oxc: true,
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
