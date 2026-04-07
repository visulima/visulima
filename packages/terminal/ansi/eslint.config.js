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
            "vitest.config.ts",
            "packem.config.ts",
            ".secretlintrc.cjs",
            "package.json",
            "prettier.config.js",
            "README.md",
        ],
        typescript: {
            tsconfigPath: "./tsconfig.eslint.json",
        },
    },
    {
        files: ["**/*.test.ts"],
        rules: {
            "@typescript-eslint/no-explicit-any": "off",
            "no-secrets/no-secrets": "off",
            "sonarjs/no-nested-functions": "off",
            "unicorn/no-null": "off",
        },
    },
    {
        files: ["./src/mode.ts", "./src/status.ts"],
        rules: {
            "unicorn/prevent-abbreviations": "off",
        },
    },
    {
        files: ["./src/**/*.ts"],
        rules: {
            "@stylistic/operator-linebreak": "off",
            "@typescript-eslint/no-unnecessary-condition": "off",
            "@typescript-eslint/prefer-nullish-coalescing": "off",
            "@typescript-eslint/restrict-plus-operands": "off",
            "@typescript-eslint/restrict-template-expressions": "off",
            "e18e/prefer-static-regex": "off",
            "jsdoc/match-description": "off", // TODO: fix this later
            "jsdoc/no-undefined-types": "off",
            "no-for-of-array/no-for-of-array": "off",
            "sonarjs/deprecation": "off",
            "sonarjs/different-types-comparison": "off",
        },
    },
    {
        files: ["__tests__/**/*.ts"],
        rules: {
            "@typescript-eslint/no-unsafe-argument": "off",
            "@typescript-eslint/no-unsafe-assignment": "off",
            "@typescript-eslint/no-unsafe-call": "off",
            "@typescript-eslint/no-unsafe-member-access": "off",
            "@typescript-eslint/require-await": "off",
            "@typescript-eslint/restrict-template-expressions": "off",
            "e18e/prefer-static-regex": "off",
            "sonarjs/deprecation": "off",
        },
    },
);
