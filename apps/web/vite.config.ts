import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import mdx from "fumadocs-mdx/vite";
import Unfonts from "unplugin-fonts/vite";
import { defineConfig } from "vite";
import { imagetools } from "vite-imagetools";
import svgr from "vite-plugin-svgr";
import tsConfigPaths from "vite-tsconfig-paths";
import viteOverlay from "@visulima/vite-overlay";
import { devToolbar } from "@visulima/dev-toolbar/vite";

const FumadocsDeps = ["fumadocs-core", "fumadocs-ui"];

export default defineConfig({
    build: {
        assetsInlineLimit: 4096, // Inline small assets as base64
        // Increase chunk size limit for better compression
        chunkSizeWarningLimit: 1000,
        // Enable advanced minification
        cssCodeSplit: true,
        cssMinify: "lightningcss",
        minify: "esbuild",
        reportCompressedSize: true, // Faster builds
        sourcemap: false, // Disable in production for smaller builds
        target: "esnext",
    },
    esbuild: {
        // Remove console logs in production
        drop: process.env.NODE_ENV === "production" ? ["console", "debugger"] : [],
        // Tree shaking improvements
        treeShaking: true,
    },
    optimizeDeps: {
        exclude: ["scripts/*"],
    },
    plugins: [
        viteOverlay({ showBallonButton: false }),
        devToolbar({
            // TanStack Start SSR renders HTML server-side, bypassing Vite's
            // transformIndexHtml. Use appendTo to inject via the module graph instead.
            //appendTo: /router\.tsx$/,
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
        mdx(await import("./source.config")),
        tsConfigPaths({
            projects: ["./tsconfig.json"],
        }),
        tailwindcss(),
        svgr({
            // Optimize SVG imports
            svgrOptions: {
                // plugins: ["@svgr/plugin-svgo", "@svgr/plugin-jsx"],
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
        }) as any,
        tanstackStart({
            prerender: {
                crawlLinks: false,
                enabled: false,
            },
            target: "netlify",
        } as any),
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
        // Optimize SSR performance
        optimizeDeps: {
            exclude: ["fumadocs-ui", "fumadocs-core", "@fumadocs/mdx-remote"],
            include: ["react", "react-dom"],
        },
    },
});
