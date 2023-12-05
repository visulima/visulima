/// <reference types="vitest" />

import { defineConfig } from "vitest/config";

// https://vitejs.dev/config/
export default defineConfig({
    test: {
        environment: "node",
        dir: "./__tests__",
        setupFiles: ["./test-setup-file.ts"],
    },
});
