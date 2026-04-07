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
        files: ["./__tests__/**"],
        rules: {
            "@typescript-eslint/no-unnecessary-condition": "off",
            "@typescript-eslint/no-unsafe-assignment": "off",
            "@typescript-eslint/no-unsafe-call": "off",
            "@typescript-eslint/require-await": "off",
            "@typescript-eslint/restrict-template-expressions": "off",
            "e18e/ban-dependencies": "off",
            "e18e/prefer-static-regex": "off",
            "jsdoc/match-description": "off",
            "sonarjs/no-nested-functions": "off",
            "sonarjs/os-command": "off",
            "vitest/no-conditional-in-test": "off",
        },
    },
    {
        files: ["./__tests__/unit/read-tsconfig-merges.test.ts"],
        rules: {
            "@stylistic/no-tabs": "off",
            "sonarjs/no-tab": "off",
        },
    },
    {
        files: ["./src/find-tsconfig.ts"],
        rules: {
            "@typescript-eslint/no-unsafe-argument": "off",
            "@typescript-eslint/no-unsafe-assignment": "off",
            "@typescript-eslint/no-unsafe-call": "off",
            "@typescript-eslint/prefer-nullish-coalescing": "off",
        },
    },
    {
        files: ["./src/module.d.ts"],
        rules: {
            "@typescript-eslint/no-redundant-type-constituents": "off",
        },
    },
    {
        files: ["./src/read-tsconfig.ts"],
        rules: {
            "@typescript-eslint/no-unnecessary-condition": "off",
            "@typescript-eslint/no-unsafe-argument": "off",
            "@typescript-eslint/no-unsafe-call": "off",
            "@typescript-eslint/prefer-nullish-coalescing": "off",
            "no-for-of-array/no-for-of-array": "off",
            "no-unsafe-optional-chaining": "off",
            "sonarjs/deprecation": "off",
        },
    },
    {
        files: ["./src/utils/resolve-extends-path.ts"],
        rules: {
            "@typescript-eslint/no-unsafe-argument": "off",
            "@typescript-eslint/no-unsafe-assignment": "off",
            "@typescript-eslint/no-unsafe-call": "off",
            "@typescript-eslint/no-unsafe-return": "off",
            "@typescript-eslint/restrict-template-expressions": "off",
            "sonarjs/function-return-type": "off",
        },
    },
    {
        files: ["./src/write-tsconfig.ts"],
        rules: {
            "@typescript-eslint/no-unsafe-call": "off",
        },
    },
);
