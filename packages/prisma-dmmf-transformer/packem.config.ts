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
        license: {
            path: "./LICENSE.md",
        },
        requireCJS: {
            builtinNodeModules: true,
        },
    },
    transformer,
    cjsInterop: true,
    validation: {
        dependencies: {
            unused: {
                exclude: ["@prisma/generator-helper", "type-fest"],
            },
        },
    },
}) as BuildConfig;
