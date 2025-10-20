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
            "vitest.config.ts",
            "packem.config.ts",
            ".secretlintrc.cjs",
            ".prettierrc.cjs",
            "package.json",
            "README.md",
        ],
    },
    {
        files: ["__tests__/**"],
        rules: {
            "unicorn/no-null": "off",
        },
    },
);
