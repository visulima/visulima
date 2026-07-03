import { getVitestConfig } from "../../../tools/get-vitest-config";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import sveltePreprocess from "svelte-preprocess";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
// Force @tanstack/solid-query to resolve to pre-built files instead of source TSX.
// The @tanstack/custom-condition export resolves to source .tsx files that require
// Solid's JSX compiler, but we cannot use vite-plugin-solid alongside React/Vue/Svelte plugins.
const solidQueryBuild = resolve(__dirname, "node_modules/@tanstack/solid-query/build/dev.js");

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
        // React Query background refetches race happy-dom's teardownWindow on
        // CI: assertions pass, teardown aborts in-flight fetches and restores
        // real `globalThis.fetch`, then a retry/settling mutation hits the real
        // network against placeholder URLs (api.example.com, happy-dom's
        // default localhost:3000 origin) and the rejection surfaces post-test.
        // Vitest's own unhandled-error tracker captures these despite a
        // process.on handler; this flag is the documented escape hatch.
        dangerouslyIgnoreUnhandledErrors: true,
        environment: "happy-dom",
        server: {
            deps: {
                inline: ["solid-js", "@tanstack/solid-query", "@tanstack/react-query", "@tanstack/vue-query", "@tanstack/svelte-query", "@tanstack/query-core"],
            },
        },
    },
    resolve: {
        conditions: ["@tanstack/custom-condition", "browser", "development"],
        mainFields: ["browser", "module", "main"],
        alias: {
            "@tanstack/solid-query": solidQueryBuild,
            "solid-js/web": "solid-js/web/dist/web.js",
            "solid-js/store": "solid-js/store/dist/store.js",
            "solid-js": "solid-js/dist/solid.js",
        },
    },
});

export default config;
