import { defineConfig } from "@visulima/packem/config";
import isolatedDeclarationTransformer from "@visulima/packem/dts/isolated/transformer/typescript";
import transformer from "@visulima/packem/transformer/esbuild";
import tailwindcssLoader from "@visulima/packem/css/loader/tailwindcss";
import cssnanoMinifier from "@visulima/packem/css/minifier/cssnano";

export default defineConfig({
    transformer,
    isolatedDeclarationTransformer,
    runtime: "node",
    rollup: {
        css: {
            mode: "inline",
            loaders: [tailwindcssLoader],
            minifier: cssnanoMinifier,
        },
        requireCJS: {
            builtinNodeModules: true,
        },
    },
});
