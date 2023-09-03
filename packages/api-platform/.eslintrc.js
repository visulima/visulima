const globals = require("@anolilab/eslint-config/globals");

/** @ts-check */
/** @type {import('eslint').Linter.Config} */
module.exports = {
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
            files: ["*.ts", "*.tsx", "*.mts", "*.cts", "*.js", "*.jsx", ".cjs", ".mjs"],
            // Set parserOptions.project for the project to allow TypeScript to create the type-checker behind the scenes when we run linting
            parserOptions: {},
            rules: {},
        },
        {
            files: ["*.ts", "*.tsx", "*.mts", "*.cts"],
            // Set parserOptions.project for the project to allow TypeScript to create the type-checker behind the scenes when we run linting
            parserOptions: {},
            // TODO: enable all new rules
            rules: {
                "@typescript-eslint/no-base-to-string": "off",
                "@typescript-eslint/no-explicit-any": "off",
                "@typescript-eslint/no-redundant-type-constituents": "off",
                "@typescript-eslint/no-unnecessary-condition": "off",
                "@typescript-eslint/no-unsafe-assignment": "off",
                "@typescript-eslint/no-unsafe-call": "off",
                "@typescript-eslint/no-unsafe-member-access": "off",
                "@typescript-eslint/no-unsafe-return": "off",
                "@typescript-eslint/restrict-template-expressions": "off",
                "security/detect-non-literal-fs-filename": "off",
                "security/detect-object-injection": "off",
                "vitest/no-conditional-expect": "off",
                "vitest/no-conditional-in-test": "off",
                "vitest/no-conditional-tests": "off",
                "vitest/no-hooks": "off",
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
                "no-multi-spaces": "off",
                "no-secrets/no-secrets": "off",
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
    rules: {
        // Customize your rules
    },
};
