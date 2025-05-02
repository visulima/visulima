import typedocBuilder from "@visulima/packem/builder/typedoc";
import type { BuildConfig } from "@visulima/packem/config";
import { defineConfig } from "@visulima/packem/config";
import transformer from "@visulima/packem/transformer/esbuild";

// eslint-disable-next-line import/no-unused-modules
export default defineConfig({
    rollup: {
        license: {
            path: "./LICENSE.md",
        },
        node10Compatibility: {
            writeToPackageJson: true,
            typeScriptVersion: ">=5.0",
        },
    },
    transformer,
    builder: {
        typedoc: typedocBuilder,
    },
    cjsInterop: true,
    declaration: false,
    typedoc: {
        format: "inline",
        readmePath: "./README.md",
        excludePrivate: true,
        excludeInternal: true,
    },
}) as BuildConfig;
