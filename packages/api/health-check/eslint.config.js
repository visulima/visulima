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
            "recipes",
            "vitest.config.ts",
            "packem.config.ts",
            ".secretlintrc.cjs",
            ".secretlintrc.js",
            "package.json",
            "README.md",
            "prettier.config.js",
        ],
        typescript: {
            tsconfigPath: "./tsconfig.eslint.json",
        },
    },
    {
        files: ["src/**/*.ts"],
        rules: {
            "@typescript-eslint/no-unnecessary-condition": "off",
            "@typescript-eslint/no-unnecessary-type-parameters": "off",
            "@typescript-eslint/require-await": "off",
            "@typescript-eslint/restrict-template-expressions": "off",
            "compat/compat": "off",
            "e18e/prefer-static-regex": "off",
            "jsdoc/match-description": "off",
            "n/no-unsupported-features/node-builtins": "off",
            "no-param-reassign": "off",
            "perfectionist/sort-objects": "off",
            "unicorn/no-anonymous-default-export": "off",
            "unicorn/no-null": "off",
        },
    },
    {
        files: ["__tests__/**/*.ts", "**/*.test.ts"],
        rules: {
            "@stylistic/no-tabs": "off",
            "@typescript-eslint/no-unnecessary-condition": "off",
            "@typescript-eslint/no-unsafe-assignment": "off",
            "@typescript-eslint/no-unsafe-member-access": "off",
            "@typescript-eslint/require-await": "off",
            "compat/compat": "off",
            "e18e/ban-dependencies": "off",
            "n/no-unsupported-features/node-builtins": "off",
            "perfectionist/sort-objects": "off",
            "sonarjs/no-control-regex": "off",
            "sonarjs/no-tab": "off",
            "unicorn/no-null": "off",
            "vitest/prefer-strict-equal": "off",
        },
    },
);
