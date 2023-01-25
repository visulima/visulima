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
        browser: false,
        node: true,
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
        "dot-notation": "off",
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
        },
        {
            files: ["*.test.ts", "*.test.tsx"],

            parserOptions: {
                project: "./tsconfig.eslint.json",
                // eslint-disable-next-line no-undef
                tsconfigRootDir: __dirname,
            },

            rules: {
                "@typescript-eslint/no-unsafe-assignment": "off",
                "@typescript-eslint/no-unsafe-member-access": "off",
                "@typescript-eslint/no-unsafe-call": "off",
                // Want work with noPropertyAccessFromIndexSignature
                "@typescript-eslint/dot-notation": "off"
            }
        }
    ],
};
