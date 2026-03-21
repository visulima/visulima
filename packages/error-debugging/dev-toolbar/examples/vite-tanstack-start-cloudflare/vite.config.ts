import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { devToolbar } from "@visulima/dev-toolbar/vite";
import viteOverlay from "@visulima/vite-overlay";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
    resolve: {
        tsconfigPaths: true,
    },
    plugins: [
        cloudflare({ viteEnvironment: { name: "ssr" } }),
        // Disable the native balloon button — the dev-toolbar renders its own error button
        viteOverlay({ showBallonButton: false }),
        tanstackStart({
            sitemap: {
                host: "https://your-project.pages.dev",
            },
        }),
        viteReact(),
        devToolbar({
            apps: {
                settings: true,
                timeline: true,
                assets: true,
                inspector: true,
                a11y: true,
                seo: true,
            },
            defaultVisible: true,
            placement: "bottom-center",
        }),
    ],
});
