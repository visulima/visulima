import { defineConfig } from "vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import viteErrorOverlay from "../../dist/vite/error-overlay-plugin.mjs";

import { tanstackRouter } from "@tanstack/router-plugin/vite";
import { resolve } from "node:path";

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [tanstackRouter({ autoCodeSplitting: true }), viteErrorOverlay(), viteReact(), tailwindcss()],
    test: {
        globals: true,
        environment: "jsdom",
    },
    resolve: {
        alias: {
            "@": resolve(__dirname, "./src"),
        },
    },
});
