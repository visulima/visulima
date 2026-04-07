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
            "prettier.config.js",
            "package.json",
            "README.md",
        ],
        typescript: {
            tsconfigPath: "./tsconfig.eslint.json",
        },
    },
    {
        files: ["src/**/*.ts", "**/*.test.ts"],
        rules: {
            // no-for-of-array conflicts with unicorn/no-for-loop: one forbids for-of on arrays,
            // the other forbids index-based for loops. Prefer for-of per unicorn.
            "no-for-of-array/no-for-of-array": "off",
        },
    },
    {
        files: ["**/*.test.ts"],
        rules: {
            "@typescript-eslint/no-explicit-any": "off",
            // Custom vitest matchers (e.g. toMatchStackFrame) cannot be resolved by TS,
            // causing false positives on expect() chains and test assertions.
            "@typescript-eslint/no-unsafe-argument": "off",
            "@typescript-eslint/no-unsafe-assignment": "off",
            "@typescript-eslint/no-unsafe-call": "off",
            "@typescript-eslint/no-unsafe-member-access": "off",
            "@typescript-eslint/unbound-method": "off",
            "no-secrets/no-secrets": "off",
            "sonarjs/no-nested-functions": "off",
            "unicorn/no-null": "off",
            "vitest/no-disabled-tests": "off",
            "vitest/unbound-method": "off",
        },
    },
);
