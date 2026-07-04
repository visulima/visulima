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
            "__bench__",
            "vitest.config.ts",
            "packem.config.ts",
            ".secretlintrc.cjs",
            "prettier.config.js",
            "package.json",
            "MIGRATION-GUIDE.md",
            "README.md",
            "CHANGELOG.md",
        ],
        typescript: {
            tsconfigPath: "./tsconfig.eslint.json",
        },
    },
    {
        files: ["**/*.test.ts", "__tests__/**/*.ts"],
        rules: {
            // vitest's expect.objectContaining() returns AsymmetricMatcher typed as any
            "@typescript-eslint/no-unsafe-assignment": "off",
            "no-secrets/no-secrets": "off",
            "unicorn/no-null": "off",
            "vitest/require-mock-type-parameters": "off",
            "vitest/unbound-method": "off",
        },
    },
);
