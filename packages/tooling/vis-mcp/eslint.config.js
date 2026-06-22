import { createConfig } from "@anolilab/eslint-config";

/** @type {import("@anolilab/eslint-config").PromiseFlatConfigComposer} */
export default createConfig(
    {
        ignores: [
            "dist",
            "node_modules",
            "coverage",
            "__fixtures__",
            "**/__fixtures__/**",
            "__docs__",
            "vitest.config.ts",
            "packem.config.ts",
            ".secretlintrc.cjs",
            ".prettierrc.cjs",
            "package.json",
            "README.md",
            "prettier.config.js",
        ],
        typescript: {
            tsconfigPath: "./tsconfig.eslint.json",
        },
    },
    {
        files: ["**/*.ts"],
        rules: {
            // Defer to prettier — it picks single-quotes when the literal
            // already contains `"` (e.g. example task IDs) which collides
            // with the stylistic-double-quote rule.
            "@stylistic/quotes": "off",
        },
    },
    {
        files: ["src/**/*.ts"],
        rules: {
            // Tool register modules export a single named function so the barrel
            // can re-export them by name. Default exports would defeat that.
            "import/prefer-default-export": "off",
            // Zod 4 nudges — package targets zod ^3.25 where `.describe()` is
            // canonical and `.trim()` is opt-in.
            "zod/prefer-meta": "off",
            "zod/prefer-string-schema-with-trim": "off",
        },
    },
    {
        files: ["src/bin.ts"],
        rules: {
            // bin scripts legitimately exit with a non-zero status on fatal errors.
            "unicorn/no-process-exit": "off",
        },
    },
    {
        files: ["__tests__/**/*.ts"],
        rules: {
            // Tests legitimately reach into internal state via non-null asserts and
            // use abbreviations like `ctx` for fixtures.
            "@stylistic/max-statements-per-line": "off",
            "@typescript-eslint/no-non-null-assertion": "off",
            "e18e/prefer-static-regex": "off",
            "no-secrets/no-secrets": "off",
            "sonarjs/no-alphabetical-sort": "off",
            "unicorn/no-array-sort": "off",
            "unicorn/prevent-abbreviations": "off",
            // try/catch + `expect` on the caught error is the idiomatic assertion
            // style here; a message arg to toThrow() would be redundant.
            "vitest/require-to-throw-message": "off",
            "vitest/require-top-level-describe": "off",
        },
    },
);
