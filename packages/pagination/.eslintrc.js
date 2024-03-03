/** @ts-check */
/** @type {import('eslint').Linter.Config} */
module.exports = {
    env: {
        // Your environments (which contains several predefined global variables)
        // Most environments are loaded automatically if our rules are added
    },
    extends: ["@anolilab/eslint-config"],
    globals: {
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
            rules: {},
        },
        {
            files: ["*.test.ts", "*.bench.ts"],
            // Set parserOptions.project for the project to allow TypeScript to create the type-checker behind the scenes when we run linting
            parserOptions: {},
            rules: {
                "@typescript-eslint/no-unsafe-argument": "off",
                "@typescript-eslint/no-unsafe-assignment": "off",
                "@typescript-eslint/no-unsafe-call": "off",
                "@typescript-eslint/no-unsafe-member-access": "off",
            },
        },
    ],
    parserOptions: {
        ecmaVersion: 2021,
        project: "./tsconfig.eslint.json",
        sourceType: "commonjs",
        tsconfigRootDir: __dirname,
    },
    // Report unused `eslint-disable` comments.
    reportUnusedDisableDirectives: true,
    root: true,
    rules: {
        // Customize your rules
    },
};
