import { createConfig } from "@anolilab/eslint-config";

/** @type {import("@anolilab/eslint-config").PromiseFlatConfigComposer} */
export default createConfig(
    {
        ignores: [
            "dist",
            "node_modules",
            "coverage",
            "__fixtures__",
            "__docs__",
            "examples",
            "vitest.config.ts",
            "packem.config.ts",
            ".secretlintrc.cjs",
            "package.json",
            "playwright-setup.js",
            ".prettierrc.cjs",
            "README.md",
        ],
    },
    {
        files: ["./__tests__/e2e/**"],
        rules: {
            "vitest/consistent-test-filename": "off",
            "vitest/prefer-importing-vitest-globals": "off",
            "vitest/require-hook": "off",
        },
    },
);
