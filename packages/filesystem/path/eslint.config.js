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
            ".prettierrc.cjs",
            "README.md",
        ],
    },
    {
        files: ["src/utils.ts", "__tests__/unit/utils.test.ts"],
        rules: {
            "unicorn/prevent-abbreviations": "off",
        },
    },
    {
        files: ["__tests__/unit/*.test.ts"],
        rules: {
            "sonarjs/publicly-writable-directories": "off",
            "unicorn/no-null": "off",
            "vitest/require-hook": "off",
        },
    },
);
