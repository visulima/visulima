import { fileURLToPath, URL } from "node:url";

import viteErrorOverlay from "@visulima/vite-overlay";
import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";
import vueDevTools from "vite-plugin-vue-devtools";

// https://vite.dev/config/
export default defineConfig({
    plugins: [viteErrorOverlay(), vue(), vueDevTools()],
    resolve: {
        alias: {
            "@": fileURLToPath(new URL("src", import.meta.url)),
        },
    },
});
