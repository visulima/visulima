import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { devToolbar } from "@visulima/dev-toolbar/vite";
import viteOverlay from "@visulima/vite-overlay";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
    resolve: {
        tsconfigPaths: true,
    },
    plugins: [
        // Disable the native balloon button — the dev-toolbar renders its own error button
        viteOverlay({ showBallonButton: false }),
        tanstackStart({
            sitemap: {
                host: "https://localhost:3000",
            },
        }),
        viteReact(),
        devToolbar({
            // TanStack Start SSR renders HTML server-side, bypassing Vite's
            // transformIndexHtml. Use appendTo to inject via the module graph instead.
            appendTo: /router\.tsx$/,
            apps: {
                settings: true,
                timeline: true,
            },
            defaultVisible: true,
            placement: "bottom-center",
        }),
    ],
});
