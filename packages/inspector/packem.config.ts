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
    node10Compatibility: {
        writeToPackageJson: true,
        typeScriptVersion: ">=5.0",
    },
    transformer,
    cjsInterop: true,
    // TODO: remove this after packem bug fix
    validation: {
        dependencies: {
            unused: {
                exclude: ["type-fest"],
            },
        },
    },
}) as BuildConfig;
