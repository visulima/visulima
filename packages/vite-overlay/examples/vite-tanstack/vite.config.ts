import { defineConfig } from "vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import viteErrorOverlay from "../../dist/index.js";

import { tanstackRouter } from "@tanstack/router-plugin/vite";
import { resolve } from "node:path";

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [tanstackRouter({ autoCodeSplitting: true }), viteReact(), tailwindcss(), viteErrorOverlay()],
    resolve: {
        alias: {
            "@": resolve(__dirname, "./src"),
        },
    },
});
