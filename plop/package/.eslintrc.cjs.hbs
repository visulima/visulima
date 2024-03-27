/** @ts-check */
// eslint-disable-next-line import/no-commonjs,import/no-unused-modules
const { defineConfig } = require("@anolilab/eslint-config/define-config");
// eslint-disable-next-line import/no-commonjs
const globals = require("@anolilab/eslint-config/globals");

/// <reference types="@eslint-types/unicorn" />
/// <reference types="@eslint-types/typescript-eslint" />
/// <reference types="@eslint-types/jsdoc" />
/// <reference types="@eslint-types/import" />
/// <reference types="@eslint-types/deprecation" />

/** @type {import('eslint').Linter.Config} */
module.exports = defineConfig({
    env: {
        // Your environments (which contains several predefined global variables)
        // Most environments are loaded automatically if our rules are added
    },
    extends: ["@anolilab/eslint-config", "@anolilab/eslint-config/typescript-type-checking"],
    globals: {
        ...globals.es2021,
        // Your global variables (setting to false means it's not allowed to be reassigned)
        // myGlobal: false
    },
    ignorePatterns: ["!**/*"],
    overrides: [
        {
            files: ["*.ts", "*.tsx", "*.mts", "*.cts", "*.js", "*.jsx"],
            // Set parserOptions.project for the project to allow TypeScript to create the type-checker behind the scenes when we run linting
            parserOptions: {},
            rules: {},
        },
        {
            files: ["*.ts", "*.tsx", "*.mts", "*.cts"],
            // Set parserOptions.project for the project to allow TypeScript to create the type-checker behind the scenes when we run linting
            parserOptions: {},
            rules: {
                "@typescript-eslint/no-unsafe-assignment": "off",
                "@typescript-eslint/no-unsafe-call": "off",
                "@typescript-eslint/no-unsafe-member-access": "off",
                "@typescript-eslint/no-unsafe-argument": "off",
                "@typescript-eslint/no-unsafe-return": "off",
                "prefer-template": "off",
            },
        },
        {
            files: ["*.js", "*.jsx"],
            rules: {},
        },
        {
            files: ["*.mdx"],
            rules: {
                "jsx-a11y/anchor-has-content": "off",
                // @see https://github.com/jsx-eslint/eslint-plugin-jsx-a11y/issues/917
                "jsx-a11y/heading-has-content": "off",
            },
        },
        {
            files: ["src/index.ts"],
            rules: {
                "import/no-unused-modules": "off",
            },
        },
        {
            files: ["__docs__/**"],
            rules: {
                "import/no-unresolved": "off",
                "import/no-unused-modules": "off",
                "no-console": "off",
                "no-undef": "off",
                "no-unused-vars": "off",
                "unicorn/prefer-top-level-await": "off",
            },
        },
        {
            files: ["__tests__/**"],
            rules: {
                "import/no-unused-modules": "off",
            },
        },
    ],
    parserOptions: {
        ecmaVersion: 2021,
        project: "./tsconfig.eslint.json",
        sourceType: "module",
    },
    // Report unused `eslint-disable` comments.
    reportUnusedDisableDirectives: true,
    root: true,
});
