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
            "package.json",
            "playwright-setup.js",
            "prettier.config.js",
            "README.md",
            "src/overlay/client/index.css", // ignore till eslint fix
        ],
        typescript: {
            tsconfigPath: "./tsconfig.eslint.json",
        },
    },
    {
        files: ["./__tests__/e2e/**"],
        rules: {
            "vitest/consistent-test-filename": "off",
            "vitest/prefer-importing-vitest-globals": "off",
            "vitest/require-hook": "off",
        },
    },
    {
        files: ["./__tests__/**"],
        rules: {
            "@typescript-eslint/no-explicit-any": "off",
            "no-secrets/no-secrets": "off",
            "unicorn/no-null": "off",
            "vitest/prefer-expect-assertions": "off",
            "vitest/require-mock-type-parameters": "off",
        },
    },
    {
        files: ["./__tests__/unit/**"],
        rules: {
            "@typescript-eslint/naming-convention": "off",
            "no-extend-native": "off",
            "no-underscore-dangle": "off",
        },
    },
);
