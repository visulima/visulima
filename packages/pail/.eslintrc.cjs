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
                "no-underscore-dangle": "off",
                "@typescript-eslint/no-unsafe-assignment": "off",
                "@typescript-eslint/no-unsafe-call": "off",
                "@typescript-eslint/no-unsafe-return": "off",
                "@typescript-eslint/no-unsafe-member-access": "off",
                "@typescript-eslint/no-unsafe-argument": "off",
                "prefer-template": "off",
                // @typescript-eslint/sort-type-constituents is not compatible
                "perfectionist/sort-intersection-types": "off",
                "@typescript-eslint/restrict-plus-operands": "off", // @TODO fix this
                "etc/no-internal": "off", // broken
            },
        },
        {
            files: ["*.test.ts", "*.bench.ts"],
            // Set parserOptions.project for the project to allow TypeScript to create the type-checker behind the scenes when we run linting
            parserOptions: {},
            rules: {
                "import/no-unused-modules": "off",
                "@typescript-eslint/no-unsafe-argument": "off",
                "@typescript-eslint/no-unsafe-assignment": "off",
                "@typescript-eslint/no-unsafe-call": "off",
                "@typescript-eslint/no-unsafe-member-access": "off",
                "@typescript-eslint/no-explicit-any": "off",
                "@typescript-eslint/restrict-template-expressions": "off",
            },
        },
        {
            files: ["*.browser.ts", "*.server.ts"],
            rules: {
                "import/no-unused-modules": "off",
            },
        },
        {
            files: ["*.mdx"],
            rules: {
                "jsx-a11y/anchor-has-content": "off",
                // @see https://github.com/jsx-eslint/eslint-plugin-jsx-a11y/issues/917
                "jsx-a11y/heading-has-content": "off",
            },
        },
    ],
    parserOptions: {
        ecmaVersion: 2021,
        project: "./tsconfig.eslint.json",
        sourceType: "module",
        tsconfigRootDir: __dirname,
    },
    // Report unused `eslint-disable` comments.
    reportUnusedDisableDirectives: true,
    root: true,
    rules: {
        // Customize your rules
    },
};
