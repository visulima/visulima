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
                "import/no-cycle": "off",
                "no-use-before-define": "off",
            },
            settings: {
                tailwindcss: {
                    config: "./tailwind.config.cjs",
                    whitelist: [
                        "md:dark:bg-x-gradient-dark-700-dark-700-50-dark-800",
                        "nextra-code-block",
                        "nextra-breadcrumb",
                        "nextra-bleed",
                        "nextra-menu-desktop",
                        "nextra-menu-mobile",
                    ],
                },
            },
        },
        {
            files: ["*.js", "*.jsx"],
            rules: {
                "global-require": "off",
                "import/no-extraneous-dependencies": "off",
            },
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
        {
            files: ["src/components/highlight-matches.tsx"],
            rules: {
                "no-cond-assign": "off",
            },
        },
        {
            files: [
                "src/types.d.ts",
                "src/reset.d.ts",
                "src/icons/*.tsx",
                "src/theme/polyfill.ts",
                "src/components.tsx",
                "__tests__/dummy.test.ts",
                "src/config.tsx",
                "src/index.tsx",
            ],
            rules: {
                "import/no-unused-modules": "off",
            },
        },
        {
            files: ["src/components/flexsearch.tsx"],
            rules: {
                "@typescript-eslint/no-unsafe-assignment": "off",
                "@typescript-eslint/no-unsafe-call": "off",
                "@typescript-eslint/no-unsafe-member-access": "off",
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
        "@typescript-eslint/no-unsafe-assignment": "off",
        "@typescript-eslint/no-unsafe-call": "off",
        "@typescript-eslint/no-unsafe-member-access": "off",
    },
};
