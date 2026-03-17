import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import mdx from "fumadocs-mdx/vite";
import Unfonts from "unplugin-fonts/vite";
import { defineConfig, type Plugin } from "vite";
import { imagetools } from "vite-imagetools";
import svgr from "vite-plugin-svgr";

type Awaitable<T> = Promise<T> | T;

const interopDefault = async <T>(m: Awaitable<T>): Promise<T extends { default: infer U } ? U : T> => {
    const resolved = await m;

    return ((resolved as unknown as Record<string, unknown>)["default"] ?? resolved) as T extends { default: infer U } ? U : T;
};

export default defineConfig(async ({ mode }) => {
    const plugins = [];

    const isDev = mode === "development";

    if (isDev) {
        const [devToolbar, viteOverlay] = await Promise.all([interopDefault(import("@visulima/dev-toolbar/vite")), interopDefault(import("@visulima/vite-overlay"))]);

        plugins.push(
            devToolbar.devToolbar({
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
        );
        plugins.push(viteOverlay({ showBallonButton: false }));
    }

    return {
        resolve: {
            tsconfigPaths: true,
        },
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
        optimizeDeps: {
            exclude: ["scripts/*", "@fumadocs/mdx-remote", "@fumadocs/mdx-remote/client"],
        },
        plugins: [
            ...plugins,
            mdx(await import("./source.config")),
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
                    crawlLinks: true,
                    enabled: true,
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
    };
});
