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
            ".prettierrc.cjs",
            "package.json",
            "README.md",
        ],
    },
    {
        files: ["./__tests__/**"],
        rules: {
            "jsdoc/match-description": "off",
            "sonarjs/no-nested-functions": "off",
            "sonarjs/os-command": "off",
        },
    },
    {
        files: ["./__tests__/unit/read-tsconfig-merges.test.ts"],
        rules: {
            "@stylistic/no-tabs": "off",
            "sonarjs/no-tab": "off",
        },
    },
);
