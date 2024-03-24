/// <reference types="vitest" />
import type { UserConfig } from "vitest/config";
import { defineConfig, configDefaults } from "vitest/config";

// https://vitejs.dev/config/
export const getVitestConfig = (options: UserConfig = {}) => {
    const VITEST_SEQUENCE_SEED = Date.now();

    console.log("VITEST_SEQUENCE_SEED", VITEST_SEQUENCE_SEED);

    return defineConfig({
        ...options,
        test: {
            coverage: {
                all: true,
                provider: "v8",
                reporter: ["clover", "cobertura", "lcov", "text"],
                include: ["src"],
                exclude: [...configDefaults.coverage.exclude, "__fixtures__/**", "__bench__/**", "scripts/**"],
            },
            environment: "node",
            reporters: process.env.CI_PREFLIGHT ? ["basic", "github-actions"] : ["basic"],
            sequence: {
                seed: VITEST_SEQUENCE_SEED,
            },
            typecheck: {
                enabled: false,
            },
            exclude: [...configDefaults.exclude, "__fixtures__/**"],
            ...options.test,
        },
    });
};
