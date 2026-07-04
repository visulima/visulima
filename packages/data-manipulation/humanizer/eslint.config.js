import { createConfig } from "@anolilab/eslint-config";

/** @type {import("@anolilab/eslint-config").PromiseFlatConfigComposer} */
export default createConfig(
    {
        ignores: [
            "dist",
            "node_modules",
            "coverage",
            "__bench__",
            "__fixtures__",
            "__docs__",
            "examples",
            "vitest.config.ts",
            "packem.config.ts",
            ".secretlintrc.cjs",
            "prettier.config.js",
            "package.json",
            "README.md",
            "CHANGELOG.md",
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
            // Circular fix conflict: no-confusing-arrow requires parens around arrow body ternaries,
            // but @stylistic/no-extra-parens wants to remove them
            "@stylistic/no-extra-parens": "off",
            // Each language file exports a single named `durationLanguage` - changing to default would break the public API
            "import/prefer-default-export": "off",
            // Language files use locale codes (e.g. sr_Latn, zh_CN) as filenames per BCP 47 standard
            "unicorn/filename-case": "off",
            // el.ts (Greek) is a valid locale code, not an abbreviation for "element"
            "unicorn/prevent-abbreviations": "off",
        },
    },
);
