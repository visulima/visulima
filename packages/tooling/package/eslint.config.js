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
            "MIGRATION-GUIDE.md",
        ],
        typescript: {
            tsconfigPath: "./tsconfig.eslint.json",
        },
    },
    {
        files: ["./__tests__/**"],
        rules: {
            "@typescript-eslint/await-thenable": "off",
            "@typescript-eslint/no-confusing-void-expression": "off",
            "@typescript-eslint/no-unsafe-assignment": "off",
            "@typescript-eslint/no-unsafe-call": "off",
            "@typescript-eslint/no-unsafe-member-access": "off",
            "@typescript-eslint/require-await": "off",
            "e18e/ban-dependencies": "off",
            "e18e/prefer-static-regex": "off",
            "sonarjs/no-undefined-argument": "off",
        },
    },
    {
        files: ["./__tests__/unit/package-json.test.ts"],
        rules: {
            "vitest/no-conditional-expect": "off",
            "vitest/no-conditional-in-test": "off",
        },
    },
    {
        files: ["./src/monorepo.ts"],
        rules: {
            "@typescript-eslint/no-unsafe-argument": "off",
            "@typescript-eslint/no-unsafe-assignment": "off",
            "@typescript-eslint/no-unsafe-call": "off",
            "@typescript-eslint/no-unsafe-member-access": "off",
        },
    },
    {
        files: ["./src/package-json.ts"],
        rules: {
            "@typescript-eslint/await-thenable": "off",
            "@typescript-eslint/no-unnecessary-condition": "off",
            "@typescript-eslint/no-unnecessary-type-parameters": "off",
            "@typescript-eslint/no-unsafe-argument": "off",
            "@typescript-eslint/no-unsafe-assignment": "off",
            "@typescript-eslint/no-unsafe-call": "off",
            "@typescript-eslint/no-unsafe-return": "off",
            "e18e/ban-dependencies": "off",
            "e18e/prefer-static-regex": "off",
            "no-for-of-array/no-for-of-array": "off",
            "sonarjs/different-types-comparison": "off",
        },
    },
    {
        files: ["./src/package-manager.ts"],
        rules: {
            "@typescript-eslint/no-unsafe-argument": "off",
            "@typescript-eslint/no-unsafe-assignment": "off",
            "@typescript-eslint/no-unsafe-call": "off",
            "@typescript-eslint/no-unsafe-return": "off",
            "@typescript-eslint/prefer-nullish-coalescing": "off",
            "@typescript-eslint/require-await": "off",
        },
    },
    {
        files: ["./src/package.ts"],
        rules: {
            "@typescript-eslint/no-unsafe-argument": "off",
            "@typescript-eslint/no-unsafe-assignment": "off",
            "@typescript-eslint/no-unsafe-call": "off",
            "@typescript-eslint/no-unsafe-member-access": "off",
        },
    },
    {
        files: ["./src/pnpm.ts"],
        rules: {
            "@typescript-eslint/no-unsafe-argument": "off",
            "@typescript-eslint/no-unsafe-assignment": "off",
            "@typescript-eslint/no-unsafe-call": "off",
            "no-for-of-array/no-for-of-array": "off",
        },
    },
    {
        files: ["./src/error/package-not-found-error.ts"],
        rules: {
            "@typescript-eslint/prefer-nullish-coalescing": "off",
        },
    },
);
