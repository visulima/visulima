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
            "__bench__",
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
        files: ["**/*.test.ts"],
        rules: {
            "@stylistic/quotes": "off",
            "@typescript-eslint/no-explicit-any": "off",
            "@typescript-eslint/no-misused-spread": "off",
            "@typescript-eslint/no-unsafe-assignment": "off",
            "@typescript-eslint/no-unsafe-call": "off",
            "@typescript-eslint/no-unsafe-member-access": "off",
            "@typescript-eslint/no-unsafe-return": "off",
            "@typescript-eslint/require-await": "off",
            "@typescript-eslint/restrict-template-expressions": "off",
            // Conflicts with unicorn/no-for-loop which prefers for-of
            "no-for-of-array/no-for-of-array": "off",
            "no-secrets/no-secrets": "off",
            "sonarjs/deprecation": "off",
            "sonarjs/no-nested-functions": "off",
            "unicorn/no-null": "off",
        },
    },
    {
        files: ["./__tests__/**/*.types.test.ts"],
        rules: {
            "sonarjs/assertions-in-tests": "off",
            "vitest/expect-expect": "off",
            "vitest/prefer-expect-assertions": "off",
        },
    },
    {
        files: ["./src/**/*.ts"],
        rules: {
            // Conflicts with unicorn/no-for-loop which prefers for-of; for-of is the idiomatic choice
            "no-for-of-array/no-for-of-array": "off",
            // JSDoc code examples have high entropy strings that are not secrets
            "no-secrets/no-secrets": "off",
        },
    },
);
