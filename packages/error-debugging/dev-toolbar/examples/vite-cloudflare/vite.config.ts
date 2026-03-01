import { cloudflare } from "@cloudflare/vite-plugin";
import { devToolbar } from "@visulima/dev-toolbar/vite";
import viteOverlay from "@visulima/vite-overlay";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
    plugins: [
        cloudflare(),
        react(),
        // Disable the native balloon button — the dev-toolbar renders its own error button
        viteOverlay({ showBallonButton: false }),
        devToolbar({
            apps: {
                settings: true,
                timeline: true,
            },
            defaultVisible: true,
            placement: "bottom-center",
        }),
    ],
});
