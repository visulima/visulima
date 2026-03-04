import { devToolbar } from "@visulima/dev-toolbar/vite";
import viteOverlay from "@visulima/vite-overlay";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
    plugins: [
        // Disable the native balloon button — the dev-toolbar renders its own error button
        viteOverlay({ showBallonButton: false }),
        devToolbar({
            apps: {
                settings: true,
                timeline: true,
            },
            customApps: [
                {
                    // Iframe app — loads /public/iframe-tool.html inside the panel
                    id: "example:json-formatter",
                    icon: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>',
                    name: "JSON Formatter",
                    view: {
                        src: "/iframe-tool.html",
                        type: "iframe",
                    },
                },
            ],
            defaultVisible: true,
            placement: "bottom-center",
        }),
    ],
});
