import { fileURLToPath } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

const here = (path: string): string => fileURLToPath(new URL(path, import.meta.url));

// eslint-disable-next-line import/no-unused-modules
export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), "");
    const apiPort = env.VIS_DASHBOARD_API_PORT ?? "7788";
    const apiTarget = env.VIS_DASHBOARD_API_URL ?? `http://127.0.0.1:${apiPort}`;

    return {
        plugins: [react(), tailwindcss(), viteSingleFile()],
        resolve: {
            alias: {
                "@": here("./src"),
            },
        },
        server: {
            proxy: {
                "/api": {
                    target: apiTarget,
                    changeOrigin: true,
                    ws: true,
                    configure: (proxy) => {
                        proxy.on("proxyReq", (proxyReq, req) => {
                            if (req.url?.startsWith("/api/events")) {
                                proxyReq.setHeader("accept", "text/event-stream");
                            }
                        });
                    },
                },
            },
        },
        build: {
            outDir: here("./dist"),
            emptyOutDir: true,
            cssCodeSplit: false,
            assetsInlineLimit: 100_000_000,
            target: "es2022",
            reportCompressedSize: false,
            rollupOptions: {
                output: {
                    inlineDynamicImports: true,
                },
            },
        },
    };
});
