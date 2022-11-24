/** @ts-check */
/** @type {import('eslint').Linter.Config} */
module.exports = {
    root: true,
    extends: ["@anolilab/eslint-config", "plugin:@next/next/recommended", "plugin:@next/next/core-web-vitals"],
    // ignorePatterns: ["!**/*"],
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

        "max-len": ["error", { code: 160 }],

        "react/jsx-props-no-spreading": "off",
        // @see https://github.com/typescript-eslint/typescript-eslint/issues/1824
        "@typescript-eslint/indent": "off",
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
            files: ["*.mdx"],
            extends: "plugin:mdx/recommended",
            settings: {
                "mdx/code-blocks": true,
                "mdx/language-mapper": {},
            },
        },
    ],
};
