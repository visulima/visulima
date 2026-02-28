import cssnanoMinifier from "@visulima/packem/css/minifier/cssnano";
import tailwindcssLoader from "@visulima/packem/css/loader/tailwindcss";
import type { BuildConfig } from "@visulima/packem/config";
import isolatedDeclarationTransformer from "@visulima/packem/dts/isolated/transformer/typescript";
import { defineConfig } from "@visulima/packem/config";
import transformer from "@visulima/packem/transformer/esbuild";
import { createPreactPreset } from "@visulima/packem/config/preset/preact";

// eslint-disable-next-line import/no-unused-modules
export default defineConfig({
    runtime: "node",
    preset: createPreactPreset(),
    isolatedDeclarationTransformer,
    externals: [
        "virtual:visulima-dev-toolbar-options",
        /^virtual:visulima-dev-toolbar-path:/,
    ],
    rollup: {
        css: {
            mode: "inline",
            minifier: cssnanoMinifier,
            loaders: [tailwindcssLoader],
        },
        license: {
            path: "./LICENSE.md",
        },
        requireCJS: {
            builtinNodeModules: true,
        },
    },
    validation: {
        dependencies: {
            unused: {
                exclude: ["tw-animate-css", "@tailwindcss/forms", "@tailwindcss/typography", "lucide-static"],
            },
            hoisted: {
                exclude: ["virtual:visulima-dev-toolbar-path:toolbar", "virtual:visulima-dev-toolbar-path:apps", "virtual:visulima-dev-toolbar-options"],
            },
        },
    },
    transformer,
}) as BuildConfig;
