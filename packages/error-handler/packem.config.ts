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
    },
    validation: {
        dependencies: {
            // TODO: remove after bug is fixed in packem, after the cache is writen, this fails
            unused: {
                exclude: ["@tinyhttp/accepts", "@visulima/boxen", "@visulima/error", "http-errors", "http-status-codes", "jstoxml", "ts-japi"]
            }
        }
    },
    transformer,
}) as BuildConfig;
