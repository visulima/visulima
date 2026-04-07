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
            "examples",
            "vitest.config.ts",
            "packem.config.ts",
            ".secretlintrc.cjs",
            "package.json",
            "prettier.config.js",
            "README.md",
        ],
        rules: {
            "jsdoc/match-description": "off",
        },
        typescript: {
            tsconfigPath: "./tsconfig.eslint.json",
        },
    },
    {
        files: ["**/*.test.ts"],
        rules: {
            "@stylistic/no-tabs": "off",
            "@typescript-eslint/no-unsafe-assignment": "off",
            "@typescript-eslint/no-unsafe-call": "off",
            "@typescript-eslint/no-unsafe-member-access": "off",
            "@typescript-eslint/require-await": "off",
            "e18e/prefer-static-regex": "off",
            "sonarjs/no-control-regex": "off",
            "sonarjs/no-tab": "off",
            "unicorn/no-null": "off",
        },
    },
    {
        files: ["./src/grid.ts"],
        rules: {
            "@typescript-eslint/no-unnecessary-condition": "off",
            "e18e/prefer-static-regex": "off",
            "jsdoc/informative-docs": "off",
            "no-for-of-array/no-for-of-array": "off",
            "no-useless-assignment": "off",
            "sonarjs/deprecation": "off",
            "sonarjs/different-types-comparison": "off",
            "unicorn/no-null": "off",
        },
    },
    {
        files: ["./src/table.ts"],
        rules: {
            "@typescript-eslint/no-for-in-array": "off",
            "@typescript-eslint/no-unsafe-assignment": "off",
            "@typescript-eslint/prefer-nullish-coalescing": "off",
            "@typescript-eslint/prefer-optional-chain": "off",
            "no-for-of-array/no-for-of-array": "off",
            "sonarjs/deprecation": "off",
        },
    },
    {
        files: ["./src/utils/border-utilities.ts.ts"],
        rules: {
            "@typescript-eslint/restrict-template-expressions": "off",
        },
    },
    {
        files: ["./src/utils/calculate-row-heights.ts"],
        rules: {
            "@typescript-eslint/no-unnecessary-condition": "off",
            "sonarjs/different-types-comparison": "off",
        },
    },
    {
        files: ["./src/utils/compute-row-logical-width.ts"],
        rules: {
            "@typescript-eslint/prefer-nullish-coalescing": "off",
        },
    },
    {
        files: ["./src/utils/determine-cell-vertical-position.ts"],
        rules: {
            "no-useless-assignment": "off",
        },
    },
    {
        files: ["./src/utils/normalize-cell.ts"],
        rules: {
            "@typescript-eslint/no-base-to-string": "off",
        },
    },
);
