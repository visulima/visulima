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
        node10Compatibility: {
            writeToPackageJson: true,
            typeScriptVersion: ">=5.0",
        },
        dynamicVars: {
            include: [],
        },
    },
    transformer,
    cjsInterop: true,
}) as BuildConfig;
