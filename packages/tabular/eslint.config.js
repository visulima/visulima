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
            "tsconfig.eslint.json",
            "package.json",
            ".prettierrc.cjs",
            "README.md",
        ],
        rules: {
            "jsdoc/match-description": "off",
        },
    },
    {
        files: ["**/*.test.ts"],
        rules: {
            "@stylistic/no-tabs": "off",
            "sonarjs/no-control-regex": "off",
            "sonarjs/no-tab": "off",
            "unicorn/no-null": "off",
        },
    },
    {
        files: ["./src/grid.ts"],
        rules: {
            "jsdoc/informative-docs": "off",
            "unicorn/no-null": "off",
        },
    },
    {
        files: ["./__bench__/table.bench.ts"],
        rules: {
            "@typescript-eslint/no-explicit-any": "off",
            "@typescript-eslint/no-shadow": "off",
            "import/no-extraneous-dependencies": "off",
            "n/no-unpublished-import": "off",
            "no-plusplus": "off",
        },
    },
);
