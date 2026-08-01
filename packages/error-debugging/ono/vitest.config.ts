/// <reference types="vitest" />

import { defineConfig, configDefaults } from "vitest/config";

// https://vitejs.dev/config/
export default defineConfig({
    test: {
        coverage: {
            provider: "v8",
            exclude: [...(configDefaults.coverage.exclude ?? []), "**/__fixtures__/**"],
        },
        environment: "node",
        // `__tests__/workerd/**` belongs to the workerd pool (`vitest.workerd.config.ts`). Those
        // specs assert workerd-only globals, so the Node pool must not pick them up.
        exclude: [...(configDefaults.exclude ?? []), "**/__fixtures__/**", "__tests__/workerd/**"],
    },
});
