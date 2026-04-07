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
        ],
        typescript: {
            tsconfigPath: "./tsconfig.eslint.json",
        },
    },
    {
        files: ["**/*.test.ts", "__tests__/**/*.ts"],
        rules: {
            "@typescript-eslint/no-explicit-any": "off",
            "@typescript-eslint/no-unnecessary-condition": "off",
            "@typescript-eslint/no-unsafe-assignment": "off",
            "@typescript-eslint/no-unsafe-call": "off",
            "@typescript-eslint/no-unsafe-member-access": "off",
            "@typescript-eslint/no-unsafe-return": "off",
            "@typescript-eslint/require-await": "off",
            "@typescript-eslint/unbound-method": "off",
            "no-secrets/no-secrets": "off",
            "sonarjs/no-nested-functions": "off",
            "unicorn/no-null": "off",
            "vitest/require-mock-type-parameters": "off",
            "vitest/unbound-method": "off",
        },
    },
    {
        files: ["**/*.ts"],
        rules: {
            // no-for-of-array conflicts with unicorn/no-for-loop and no-plusplus;
            // for...of is idiomatic TypeScript so we keep it and disable this rule.
            "no-for-of-array/no-for-of-array": "off",
        },
    },
);
