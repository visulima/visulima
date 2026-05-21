import { fileURLToPath } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

const here = (path: string): string => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), "");
    const apiPort = env.VIS_DASHBOARD_API_PORT ?? "7788";
    const apiTarget = env.VIS_DASHBOARD_API_URL ?? `http://127.0.0.1:${apiPort}`;

    return {
        build: {
            assetsInlineLimit: 100_000_000,
            cssCodeSplit: false,
            emptyOutDir: true,
            outDir: here("./dist"),
            reportCompressedSize: false,
            rollupOptions: {
                output: {
                    inlineDynamicImports: true,
                },
            },
            target: "es2022",
        },
        plugins: [react(), tailwindcss(), viteSingleFile()],
        resolve: {
            alias: {
                "@": here("./src"),
            },
        },
        server: {
            proxy: {
                "/api": {
                    changeOrigin: true,
                    configure: (proxy) => {
                        proxy.on("proxyReq", (proxyReq, req) => {
                            if (req.url?.startsWith("/api/events")) {
                                proxyReq.setHeader("accept", "text/event-stream");
                            }
                        });
                    },
                    target: apiTarget,
                    ws: true,
                },
            },
        },
    };
});
