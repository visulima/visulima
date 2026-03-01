import { devToolbar } from "@visulima/dev-toolbar/vite";
import viteOverlay from "@visulima/vite-overlay";
import { defineConfig } from "vite";
import solid from "vite-plugin-solid";

// https://vite.dev/config/
export default defineConfig({
    plugins: [
        solid(),
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
