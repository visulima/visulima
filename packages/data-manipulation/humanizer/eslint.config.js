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
            "examples",
            "vitest.config.ts",
            "packem.config.ts",
            ".secretlintrc.cjs",
            "prettier.config.js",
            "package.json",
            "README.md",
        ],
        typescript: {
            tsconfigPath: "./tsconfig.eslint.json",
        },
    },
    {
        files: ["./__tests__/**"],
        rules: {
            "@typescript-eslint/no-unsafe-argument": "off",
            "@typescript-eslint/no-unsafe-assignment": "off",
            "@typescript-eslint/require-await": "off",
            "jsdoc/match-description": "off",
            "no-for-of-array/no-for-of-array": "off",
            "sonarjs/no-nested-functions": "off",
            "sonarjs/os-command": "off",
        },
    },
    {
        files: ["./src/language/*.ts", "./src/language/**/*.ts"],
        rules: {
            "@stylistic/no-extra-parens": "off",
            "import/prefer-default-export": "off",
            "jsdoc/match-description": "off",
            "no-for-of-array/no-for-of-array": "off",
            "unicorn/filename-case": "off",
            "unicorn/prevent-abbreviations": "off",
        },
    },
    {
        files: ["./src/duration.ts"],
        rules: {
            "no-for-of-array/no-for-of-array": "off",
        },
    },
);
