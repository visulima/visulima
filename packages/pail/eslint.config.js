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
            "MIGRATION-GUIDE.md",
        ],
    },
    {
        files: ["**/*.test.ts", "**/*.mock.ts"],
        rules: {
            "@typescript-eslint/no-explicit-any": "off",
            "no-secrets/no-secrets": "off",
            "no-underscore-dangle": "off",
            "sonarjs/no-nested-functions": "off",
            "unicorn/no-null": "off",
            "vitest/require-mock-type-parameters": "off",
        },
    },
);
