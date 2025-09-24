import typedocBuilder from "@visulima/packem/builder/typedoc";
import type { BuildConfig } from "@visulima/packem/config";
import { defineConfig } from "@visulima/packem/config";
import transformer from "@visulima/packem/transformer/esbuild";
import validate from "packages/jsdoc-open-api/src/validate";

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
    },
    transformer,
    builder: {
        // TODO: add it back after its fixed in the alpha
        //typedoc: typedocBuilder,
    },
    cjsInterop: true,
    typedoc: {
        format: "inline",
        readmePath: "./README.md",
        excludePrivate: true,
        excludeInternal: true,
    },
    // TODO: remove this after packem bug fix
    validation: {
        dependencies: {
            unused: {
                exclude: ["@visulima/fs", "@visulima/path", "jsonc-parser", "resolve-pkg-maps"],
            },
        },
    },
}) as BuildConfig;
