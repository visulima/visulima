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
            ".prettierrc.cjs",
            "package.json",
            "__tests__/crypto/fixtures.ts",
            "README.md",
        ],
    },
    {
        files: ["**/*.test.ts"],
        rules: {
            "@typescript-eslint/no-explicit-any": "off",
            "@typescript-eslint/no-extraneous-class": "off",
            "@typescript-eslint/no-useless-constructor": "off",
            "class-methods-use-this": "off",
            "max-classes-per-file": "off",
            "n/no-unsupported-features/node-builtins": "off",
            "no-secrets/no-secrets": "off",
            "sonarjs/no-nested-functions": "off",
            "unicorn/no-null": "off",
            "vitest/no-conditional-in-test": "off",
            "vitest/require-mock-type-parameters": "off",
        },
    },
    {
        files: ["**/providers/**/*.ts"],
        rules: {
            "@stylistic/no-extra-parens": "off",
            "sonarjs/file-name-differ-from-class": "off",
        },
    },
);
