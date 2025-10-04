/// <reference types="vitest" />

import { defineConfig } from "vitest/config";

const exclude = [
    "**/node_modules/**",
    "**/dist/**",
    "**/cypress/**",
    "**/.{idea,git,cache,output,temp}/**",
    "**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress}.config.*",
    "__tests__/storage/local/disk-storage.test.ts",
    "__tests__/storage/local/disk-storage-with-checksum.test.ts",
    "__tests__/handler/express/multipart.test.ts",
    "__tests__/handler/express/tus.test.ts",
    "__mocks__/fs/**",
    "__tests__/__helpers__/**",
];

// https://vitejs.dev/config/
export default defineConfig({
    // plugins: [react()],
    test: {
        environment: "node",
        exclude,
        coverage: {
            exclude,
        },
    },
});
