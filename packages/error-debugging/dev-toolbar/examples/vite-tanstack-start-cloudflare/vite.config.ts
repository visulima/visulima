import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { devToolbar } from "@visulima/dev-toolbar/vite";
import viteOverlay from "@visulima/vite-overlay";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";

export default defineConfig({
    plugins: [
        // Disable the native balloon button — the dev-toolbar renders its own error button
        viteOverlay({ showBallonButton: false }),
        tsConfigPaths({
            projects: ["./tsconfig.json"],
        }),
        tanstackStart({
            sitemap: {
                host: "https://your-project.pages.dev",
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
                assets: true,
                inspector: true,
                a11y: true,
            },
            defaultVisible: true,
            placement: "bottom-center",
        }),
    ],
});
