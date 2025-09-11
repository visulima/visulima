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
            "README.md",
            ".prettierrc.cjs",
            "src/types/launch-editor-middleware.d.ts",
            // Till the eslint is fixed
            "src/error-inspector/index.css",
        ],
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
);
