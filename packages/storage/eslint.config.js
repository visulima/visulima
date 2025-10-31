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
            ".prettierrc.cjs",
            "README.md",
        ],
    },
    {
        files: ["__tests__/**"],
        rules: {
            "vitest/prefer-called-exactly-once-with": "off",
        },
    },
);
