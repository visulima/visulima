import { defineConfig } from "@visulima/packem/config";
import transformer from "@visulima/packem/transformer/esbuild";
import tailwindcssLoader from "@visulima/packem/css/loader/tailwindcss";
import cssnanoMinifier from "@visulima/packem/css/minifier/cssnano";

export default defineConfig({
    failOnWarn: false,
    transformer,
    runtime: "node",
    rollup: {
        css: {
            mode: "inline",
            loaders: [tailwindcssLoader],
            minifier: cssnanoMinifier,
        },
    },
});
