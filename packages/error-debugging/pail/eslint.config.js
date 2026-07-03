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
            "prettier.config.js",
            "README.md",
            "MIGRATION-GUIDE.md",
            "__bench__",
        ],
        typescript: {
            tsconfigPath: "./tsconfig.eslint.json",
        },
    },
    {
        rules: {
            // unicorn/no-for-loop conflicts with no-for-of-array/no-for-of-array
            "unicorn/no-for-loop": "off",
        },
    },
    {
        files: ["**/*.test.ts", "**/*.mock.ts", "__tests__/**/*.ts"],
        rules: {
            "@stylistic/max-statements-per-line": "off",
            "@typescript-eslint/no-explicit-any": "off",
            "@typescript-eslint/no-floating-promises": "off",
            "@typescript-eslint/no-unnecessary-condition": "off",
            "@typescript-eslint/no-unsafe-argument": "off",
            "@typescript-eslint/no-unsafe-assignment": "off",
            "@typescript-eslint/no-unsafe-call": "off",
            "@typescript-eslint/no-unsafe-member-access": "off",
            "@typescript-eslint/no-unsafe-return": "off",
            "@typescript-eslint/prefer-nullish-coalescing": "off",
            "@typescript-eslint/require-await": "off",
            "@typescript-eslint/restrict-template-expressions": "off",
            "@typescript-eslint/unbound-method": "off",
            "no-secrets/no-secrets": "off",
            "no-underscore-dangle": "off",
            "sonarjs/different-types-comparison": "off",
            "sonarjs/no-nested-functions": "off",
            "unicorn/no-null": "off",
            "vitest/require-mock-type-parameters": "off",
            "vitest/unbound-method": "off",
        },
    },
);
