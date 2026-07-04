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
            "package.json",
            "prettier.config.js",
            "README.md",
            "CHANGELOG.md",
        ],
        typescript: {
            tsconfigPath: "./tsconfig.eslint.json",
        },
    },
    {
        files: ["**/*.test.ts"],
        rules: {
            "@typescript-eslint/no-explicit-any": "off",
            "no-secrets/no-secrets": "off",
            "sonarjs/no-nested-functions": "off",
            "unicorn/no-null": "off",
        },
    },
    {
        files: ["./src/mode.ts", "./src/status.ts"],
        rules: {
            // Public API names contain "Ext" and "Param" abbreviations that cannot be renamed without breaking changes
            "unicorn/prevent-abbreviations": "off",
        },
    },
    {
        files: ["./__tests__/unit/mode.test.ts"],
        rules: {
            // Tests for deprecated APIs that must remain to verify backward compatibility
            "sonarjs/deprecation": "off",
        },
    },
);
