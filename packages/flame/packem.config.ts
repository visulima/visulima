import { defineConfig } from "@visulima/packem/config";
import transformer from "@visulima/packem/transformer/esbuild";
import postcssLoader from "@visulima/packem/css/loader/postcss";
import sourceMapLoader from "@visulima/packem/css/loader/sourcemap";
import cssnanoMinifier from "@visulima/packem/css/minifier/cssnano";

export default defineConfig({
    transformer,
    rollup: {
        css: {
            loaders: [postcssLoader, sourceMapLoader],
            minifier: cssnanoMinifier,
        },
    },
});
