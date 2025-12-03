/// <reference types="vitest" />
import type { ViteUserConfig } from "vitest/config";
import { defineConfig, configDefaults, coverageConfigDefaults } from "vitest/config";

const VITEST_SEQUENCE_SEED = Date.now();

// https://vitejs.dev/config/
export const getVitestConfig = (options: ViteUserConfig = {}) => {
    console.log("VITEST_SEQUENCE_SEED", VITEST_SEQUENCE_SEED);

    return defineConfig({
        ...options,
        test: {
            ...configDefaults,
            coverage: {
                ...coverageConfigDefaults,
                provider: "v8",
                reporter: ["clover", "cobertura", "lcov", "text", "html"],
                include: ["src"],
                exclude: [
                    ...(coverageConfigDefaults.exclude ?? []),
                    "__fixtures__/**",
                    "__bench__/**",
                    "scripts/**",
                    "src/**/types.ts",
                    "src/module.d.ts",
                    "src/reset.d.ts",
                    "e2e",
                    "**/node_modules/**",
                    "**/dist/**",
                ],
            },
            environment: "node",
            reporters: process.env.CI_PREFLIGHT ? ["default", "github-actions"] : ["default"],
            sequence: {
                seed: VITEST_SEQUENCE_SEED,
            },
            typecheck: {
                enabled: false,
            },
            ...options.test,
            exclude: [...configDefaults.exclude, "__fixtures__/**", ...(options.test?.exclude ?? [])],
        },
    });
};
