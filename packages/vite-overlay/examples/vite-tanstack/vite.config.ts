import { resolve } from "node:path";

import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import viteErrorOverlay from "@visulima/vite-overlay/dist/index.js";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [tanstackRouter({ autoCodeSplitting: true }), viteReact(), tailwindcss(), viteErrorOverlay()],
    resolve: {
        alias: {
            "@": resolve(__dirname, "./src"),
        },
    },
});
