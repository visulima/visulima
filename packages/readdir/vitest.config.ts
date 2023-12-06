/// <reference types="vitest" />

import { defineConfig, configDefaults } from "vitest/config";

// https://vitejs.dev/config/
export default defineConfig({
    test: {
        coverage: {
            provider: "v8",
            exclude: [...configDefaults.coverage.exclude, "**/__fixtures__/**"],
        },
        environment: "node",
        exclude: [...configDefaults.exclude, "**/__fixtures__/**"],
    },
});
