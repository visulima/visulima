import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { defineConfig } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";
import viteErrorOverlay from "@visulima/vite-overlay";
import viteReact from "@vitejs/plugin-react";

export default defineConfig({
    plugins: [
        viteErrorOverlay({
            overlay: {
                // Balloon button configuration
                balloon: {
                    enabled: true,
                    position: "bottom-left", // "top-left" | "top-right" | "bottom-left" | "bottom-right"
                    icon: "", // Optional custom icon URL
                    style: {
                        background: "green",
                        color: "#ffffff",
                    },
                },
                // Custom CSS to inject for styling customization
                customCSS: `
                    #__v_o__message {
                        color: green;
                    }
                `,
            },
        }),
        tsConfigPaths({
            projects: ["./tsconfig.json"],
        }),
        tanstackStart({
            sitemap: {
                host: "https://localhost:3000",
            },
            customViteReactPlugin: true,
        }),
        viteReact(),
    ],
});
