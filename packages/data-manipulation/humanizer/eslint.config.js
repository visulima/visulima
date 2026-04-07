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
            "no-for-of-array/no-for-of-array": "off",
            "sonarjs/os-command": "off",
            "unicorn/no-null": "off",
        },
    },
    {
        files: ["./src/language/*.ts", "./src/language/**/*.ts"],
        rules: {
            "@stylistic/no-extra-parens": "off",
            "import/prefer-default-export": "off",
            "no-for-of-array/no-for-of-array": "off",
            "unicorn/filename-case": "off",
            "unicorn/prevent-abbreviations": "off",
        },
    },
);
