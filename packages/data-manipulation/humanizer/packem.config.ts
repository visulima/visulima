import type { BuildConfig } from "@visulima/packem/config";
import { defineConfig } from "@visulima/packem/config";
import transformer from "@visulima/packem/transformer/esbuild";

// eslint-disable-next-line import/no-unused-modules
export default defineConfig({
    rollup: {
        // `loadDurationLanguage` does a runtime `import("./language/<code>.js")`.
        // The language packs are emitted as separate entry chunks, so there are no
        // `.js` source files for the dynamic-import-vars plugin to glob — warn
        // instead of failing the build and leave the import for runtime resolution.
        dynamicVars: {
            warnOnError: true,
        },
        dts: {
            oxc: true,
        },
        license: {
            path: "./LICENSE.md",
        },
        requireCJS: {
            builtinNodeModules: true,
        },
    },
    transformer,
}) as BuildConfig;
