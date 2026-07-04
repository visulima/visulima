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
            "prettier.config.js",
            "package.json",
            "README.md",
            "CHANGELOG.md",
            "prettier.config.js",
            "src/types/launch-editor-middleware.d.ts",
            // Till the eslint is fixed
            "src/error-inspector/index.css",
        ],
        typescript: {
            tsconfigPath: "./tsconfig.eslint.json",
        },
    },
    {
        files: ["**/*.test.ts"],
        rules: {
            // External dep types (@visulima/fs, @visulima/path) unresolvable by typescript-eslint
            "@typescript-eslint/no-unsafe-call": "off",
            "no-secrets/no-secrets": "off",
            "unicorn/no-null": "off",
        },
    },
);
