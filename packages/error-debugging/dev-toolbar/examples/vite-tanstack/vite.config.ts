import { resolve } from "node:path";

import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import { devToolbar } from "@visulima/dev-toolbar/vite";
import viteOverlay from "@visulima/vite-overlay";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [
        tanstackRouter({ autoCodeSplitting: true }),
        viteReact(),
        tailwindcss(),
        // Disable the native balloon button — the dev-toolbar renders its own error button
        viteOverlay({ showBallonButton: false }),
        devToolbar({
            apps: {
                settings: true,
                timeline: true,
                inspector: true,
            },
            defaultVisible: true,
            placement: "bottom-center",
        }),
    ],
    resolve: {
        alias: {
            "@": resolve(__dirname, "./src"),
        },
    },
});
