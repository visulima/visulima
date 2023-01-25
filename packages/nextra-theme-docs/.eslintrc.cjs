/** @ts-check */
/** @type {import('eslint').Linter.Config} */
module.exports = {
    root: true,
    extends: [
        "@anolilab/eslint-config",
    ],
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

            rules: {
                "@typescript-eslint/no-unnecessary-condition": "off",
                "@typescript-eslint/no-non-null-assertion": "off",
                " @typescript-eslint/prefer-nullish-coalescing": "off",
                "@typescript-eslint/no-unsafe-member-access": "off",
                "@typescript-eslint/no-unsafe-argument": "off",
                "@typescript-eslint/no-unsafe-assignment": "off",
                "@typescript-eslint/prefer-nullish-coalescing": "off",
                "@typescript-eslint/no-unsafe-return": "off",
                "@typescript-eslint/explicit-module-boundary-types": "off",
                "@typescript-eslint/no-dynamic-delete": "off",
                "@typescript-eslint/no-unsafe-call": "off",
                "@typescript-eslint/no-misused-promises": "off",

                "tailwindcss/no-custom-classname": "off",
                "tailwindcss/no-contradicting-classname": "off",
            }
        },
    ],
};
