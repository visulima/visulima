import { defineConfig } from "@visulima/packem/config";
import transformer from "@visulima/packem/transformer/esbuild";
import tailwindcssLoader from "@visulima/packem/css/loader/tailwindcss";
import cssnanoMinifier from "@visulima/packem/css/minifier/cssnano";

export default defineConfig({
    transformer,
    runtime: "node",
    rollup: {
        css: {
            mode: "inline",
            loaders: [tailwindcssLoader],
            minifier: cssnanoMinifier,
        },
    },
    // TODO: remove this after packem bug fix
    validation: {
        dependencies: {
            unused: {
                exclude: ["@shikijs/langs", "@shikijs/themes", "isomorphic-dompurify", "shiki"]
            },
            hoisted: {
                exclude: ["@visulima/boxen"]
            }
        }
    }
});
