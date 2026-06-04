import type { BuildConfig } from "@visulima/packem/config";
import { defineConfig } from "@visulima/packem/config";
import transformer from "@visulima/packem/transformer/esbuild";

// eslint-disable-next-line import/no-unused-modules
export default defineConfig({
    node10Compatibility: {
        writeToPackageJson: true,
        typeScriptVersion: ">=5.0",
    },
    rollup: {
        // packem force-enables esbuild `keepNames` whenever minify is on (i.e. the
        // production build). That wraps every function — including the per-call
        // recursion callback in the hot inspect path — in an `Object.defineProperty`
        // name-tag, which made the published build ~3x slower than dev. We don't rely
        // on our own functions' `.name`, so keep it off in every build.
        esbuild: {
            keepNames: false,
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
    validation: {
        dependencies: {
            unused: {
                exclude: ["type-fest"],
            },
        },
    },
    transformer,
    cjsInterop: true,
}) as BuildConfig;
