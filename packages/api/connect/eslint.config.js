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
            ".secretlintrc.js",
            "prettier.config.js",
            "package.json",
            "README.md",
        ],
        typescript: {
            tsconfigPath: "./tsconfig.eslint.json",
        },
    },
    {
        files: ["bench/**/*"],
        rules: {
            "func-style": "off",
            "import/extensions": "off",
            "import/no-unresolved": "off",
            "jsdoc/require-param-description": "off",
            "jsdoc/require-param-type": "off",
            "markdown/fenced-code-language": "off",
        },
    },
    {
        files: ["**/*.test.ts"],
        rules: {
            "@typescript-eslint/no-explicit-any": "off",
            "@typescript-eslint/no-throw-literal": "off",
            "@typescript-eslint/no-unsafe-argument": "off",
            "@typescript-eslint/no-unsafe-assignment": "off",
            "@typescript-eslint/no-unsafe-call": "off",
            "@typescript-eslint/no-unsafe-member-access": "off",
            "@typescript-eslint/no-unsafe-return": "off",
            "@typescript-eslint/only-throw-error": "off",
            "@typescript-eslint/require-await": "off",
            "@typescript-eslint/restrict-template-expressions": "off",
            "@typescript-eslint/unbound-method": "off",
            "compat/compat": "off",
            "no-secrets/no-secrets": "off",
            "sonarjs/no-clear-text-protocols": "off",
            "unicorn/no-null": "off",
        },
    },
    {
        files: ["./__tests__/unit/index.test.ts"],
        rules: {
            "@stylistic/no-tabs": "off",
            "sonarjs/no-tab": "off",
        },
    },
);
