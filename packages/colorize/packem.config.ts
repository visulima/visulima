import { defineConfig } from "@visulima/packem/config";
import transformer from "@visulima/packem/transformer/esbuild";

// eslint-disable-next-line import/no-unused-modules
export default defineConfig({
    cjsInterop: true,
    rollup: {
        license: {
            path: "./LICENSE.md",
        },
    },
    declaration: false,
    transformer,
});
