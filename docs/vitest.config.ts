/// <reference types="vitest" />

import { defineConfig } from "vitest/config";

// https://vitejs.dev/config/
export default defineConfig({
    test: {
        coverage: {
            reporter: ["text", "json", "html"],
        },
    },
});
