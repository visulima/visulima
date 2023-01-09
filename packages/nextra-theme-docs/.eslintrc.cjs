/** @ts-check */
/** @type {import('eslint').Linter.Config} */
module.exports = {
    root: true,
    extends: ["@anolilab/eslint-config"],
    ignorePatterns: ["!**/*"],
    env: {
        // Your environments (which contains several predefined global variables)
        browser: true,
        node: false,
        commonjs: true,
        es6: true,
        // mocha: true,
        jest: false,
        // jquery: true
    },
    globals: {
        // Your global variables (setting to false means it's not allowed to be reassigned)
        //
        // myGlobal: false
    },
    rules: {
        // Customize your rules
        "import/extensions": "off",
        "unicorn/no-array-for-each": "off",
        "unicorn/no-null": "off",
        "unicorn/no-array-reduce": "off",

        "no-restricted-imports": [
            "error",
            {
                patterns: ["@mui/*/*/*", "!@mui/core/test-utils/*"],
            },
        ],
        "max-len": ["error", { code: 160 }],
    },
    overrides: [
        {
            files: ["*.ts", "*.tsx"],
            parserOptions: {
                project: "./tsconfig.eslint.json",
                // eslint-disable-next-line no-undef
                tsconfigRootDir: __dirname,
            },
            settings: {
                tailwindcss: {
                    config: "./tailwind.config.js",
                    whitelist: ["nextra-code-block", "md:dark:bg-x-gradient-dark-700-dark-700-50-dark-800"],
                },
            },
        },
        {
            files: ["**/src/components/flexsearch.tsx", "**/src/utils/normalize-pages.ts"],
            rules: {
                "@typescript-eslint/no-unsafe-assignment": "off",
                "@typescript-eslint/no-unsafe-call": "off",
                "@typescript-eslint/no-unsafe-member-access": "off",
            }
        },
        {
            files: ["*.test.ts", "*.test.tsx"],
            rules: {
                "testing-library/render-result-naming-convention": "off",
            }
        }
    ],
};
