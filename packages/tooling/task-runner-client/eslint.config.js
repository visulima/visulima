import { createConfig } from "@anolilab/eslint-config";

/** @type {import("@anolilab/eslint-config").PromiseFlatConfigComposer} */
export default createConfig(
    {
        ignores: [
            "dist",
            "node_modules",
            "coverage",
            "__fixtures__",
            "vitest.config.ts",
            "packem.config.ts",
            ".secretlintrc.cjs",
            "package.json",
            "README.md",
            "CHANGELOG.md",
            "prettier.config.js",
        ],
        typescript: {
            tsconfigPath: "./tsconfig.eslint.json",
        },
    },
    {
        rules: {
            // Single-export-shaped utility module; named exports are intentional.
            "import/prefer-default-export": "off",
            // `getEnv`/`getEnvs` mirror `@voidzero-dev/vite-task-client` verbatim
            // so tools written against that client work unchanged — the name is
            // the compatibility contract, not an accidental abbreviation.
            "unicorn/prevent-abbreviations": "off",
        },
    },
    {
        files: ["__tests__/**/*"],
        rules: {
            // Tests mutate process.env by dynamic key and assert bare throws.
            "@typescript-eslint/no-dynamic-delete": "off",
            "vitest/require-to-throw-message": "off",
        },
    },
);
