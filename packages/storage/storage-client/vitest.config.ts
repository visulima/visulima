import { getVitestConfig } from "../../../tools/get-vitest-config";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import sveltePreprocess from "svelte-preprocess";

const config = getVitestConfig({
    plugins: [
        svelte({
            preprocess: sveltePreprocess(),
            compilerOptions: {
                dev: true,
            },
        }),
    ],
    test: {
        environment: "happy-dom",
        server: {
            deps: {
                inline: ["solid-js", "@tanstack/solid-query"],
            },
        },
    },
    resolve: {
        conditions: ["browser", "development"],
        mainFields: ["browser", "module", "main"],
        alias: {
            "solid-js/web": "solid-js/web/dist/web.js",
            "solid-js/store": "solid-js/store/dist/store.js",
            "solid-js": "solid-js/dist/solid.js",
        },
    },
});

export default config;
