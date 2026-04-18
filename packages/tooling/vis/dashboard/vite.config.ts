import { fileURLToPath } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

const here = (path: string): string => fileURLToPath(new URL(path, import.meta.url));

// eslint-disable-next-line import/no-unused-modules
export default defineConfig({
    plugins: [react(), tailwindcss(), viteSingleFile()],
    resolve: {
        alias: {
            "@": here("./src"),
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
});
