import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { devToolbar } from "@visulima/dev-toolbar/vite";
import viteOverlay from "@visulima/vite-overlay";
import react from "@vitejs/plugin-react";
import mdx from "fumadocs-mdx/vite";
import Unfonts from "unplugin-fonts/vite";
import { defineConfig } from "vite";
import { imagetools } from "vite-imagetools";
import svgr from "vite-plugin-svgr";
import tsConfigPaths from "vite-tsconfig-paths";

export default defineConfig({
    build: {
        assetsInlineLimit: 4096,
        chunkSizeWarningLimit: 1000,
        cssCodeSplit: true,
        cssMinify: "lightningcss",
        minify: "esbuild",
        reportCompressedSize: true,
        sourcemap: false,
        target: "esnext",
    },
    esbuild: {
        drop: process.env.NODE_ENV === "production" ? ["console", "debugger"] : [],
        treeShaking: true,
    },
    optimizeDeps: {
        exclude: ["scripts/*"],
    },
    plugins: [
        viteOverlay({ showBallonButton: false }),
        devToolbar({
            apps: {
                a11y: true,
                assets: true,
                inspector: true,
                settings: true,
                timeline: true,
            },
            defaultVisible: true,
            placement: "bottom-center",
        }),
        mdx(await import("./source.config")),
        tsConfigPaths({
            projects: ["./tsconfig.json"],
        }),
        tailwindcss(),
        svgr({
            svgrOptions: {
                svgoConfig: {
                    floatPrecision: 2,
                },
            },
        }),
        Unfonts({
            custom: {
                families: [
                    {
                        name: "Geist Sans",
                        src: "./src/assets/fonts/geist/*.woff2",
                    },
                    {
                        name: "Geist Mono",
                        src: "./src/assets/fonts/geist-mono/*.woff2",
                    },
                ],
            },
        }),
        imagetools({
            defaultDirectives: (url) => {
                if (!url.searchParams.get("format") && (url.pathname.endsWith(".jpg") || url.pathname.endsWith(".jpeg"))) {
                    url.searchParams.set("format", "jpeg");
                }

                if (url.searchParams.get("format") === "jpeg") {
                    url.searchParams.set("progressive", "true");
                }

                return url.searchParams;
            },
        }),
        tanstackStart({
            prerender: {
                crawlLinks: false,
                enabled: false,
            },
        }),
        react({
            babel: {
                plugins: [["babel-plugin-react-compiler", { target: "19" }]],
            },
        }),
    ],
    server: {
        proxy: {
            "/pr/posthog": {
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/pr\/posthog/, ""),
                target: "https://eu.i.posthog.com",
            },
        },
    },
    ssr: {
        optimizeDeps: {
            exclude: ["fumadocs-ui", "fumadocs-core", "@fumadocs/mdx-remote"],
            include: ["react", "react-dom"],
        },
    },
});
