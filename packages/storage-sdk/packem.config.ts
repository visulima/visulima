import type { BuildConfig } from "@visulima/packem/config";
import { defineConfig } from "@visulima/packem/config";
import transformer from "@visulima/packem/transformer/esbuild";

export default defineConfig({
    runtime: "browser",
    rollup: {
        inlineDependencies: true,
        preserveModules: false,
        license: {
            path: "./LICENSE.md",
        },
    },
    transformer,
    failOnWarn: false,
}) as BuildConfig;
