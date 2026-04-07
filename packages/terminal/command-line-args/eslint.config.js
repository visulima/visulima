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
            "__bench__",
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
        files: ["__tests__/**"],
        rules: {
            "@typescript-eslint/no-unsafe-return": "off",
            "sonarjs/publicly-writable-directories": "off",
            "unicorn/no-null": "off",
        },
    },
    {
        files: ["**/*.ts"],
        rules: {
            "@typescript-eslint/no-base-to-string": "off",
            "@typescript-eslint/no-unnecessary-condition": "off",
            "@typescript-eslint/no-unsafe-argument": "off",
            "@typescript-eslint/no-unsafe-assignment": "off",
            "@typescript-eslint/no-unsafe-call": "off",
            "@typescript-eslint/no-unsafe-member-access": "off",
            "@typescript-eslint/no-unsafe-return": "off",
            "@typescript-eslint/prefer-nullish-coalescing": "off",
            "@typescript-eslint/restrict-template-expressions": "off",
            "e18e/prefer-static-regex": "off",
            "no-for-of-array/no-for-of-array": "off",
            "sonarjs/different-types-comparison": "off",
            "sonarjs/no-redundant-optional": "off",
        },
    },
);
