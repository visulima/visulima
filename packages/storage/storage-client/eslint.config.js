import { createConfig } from "@anolilab/eslint-config";
import tanstackQuery from "@tanstack/eslint-plugin-query";
import tsParser from "@typescript-eslint/parser";
import solid from "eslint-plugin-solid";
import svelte from "eslint-plugin-svelte";
import vue from "eslint-plugin-vue";
import svelteParser from "svelte-eslint-parser";
import vueParser from "vue-eslint-parser";

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
            "README.md",
            "CHANGELOG.md",
            "AGENTS.md",
            "prettier.config.js",
        ],
        typescript: {
            tsconfigPath: "./tsconfig.eslint.json",
        },
    },
    {
        files: ["__tests__/**"],
        rules: {
            // Concise `renderHook(() => { hook(); })` and `vi.fn(() => x)` helpers put the arrow
            // body inline; the statements-per-line cap is purely stylistic noise in tests.
            "@stylistic/max-statements-per-line": "off",
            "@typescript-eslint/member-ordering": "off",
            "@typescript-eslint/no-explicit-any": "off",
            "@typescript-eslint/no-non-null-assertion": "off",
            "@typescript-eslint/no-unnecessary-condition": "off",
            "@typescript-eslint/no-unsafe-argument": "off",
            "@typescript-eslint/no-unsafe-assignment": "off",
            "@typescript-eslint/no-unsafe-call": "off",
            "@typescript-eslint/no-unsafe-member-access": "off",
            "@typescript-eslint/no-unsafe-return": "off",
            "@typescript-eslint/prefer-nullish-coalescing": "off",
            "@typescript-eslint/require-await": "off",
            "@typescript-eslint/restrict-template-expressions": "off",
            "@typescript-eslint/unbound-method": "off",
            // One-shot assertion regexes (`toThrow(/abort/i)`) need not be hoisted to module scope.
            "e18e/prefer-static-regex": "off",
            "jsdoc/match-description": "off",
            "max-classes-per-file": "off",
            // The resume/url-storage suites target the browser `localStorage` global on purpose.
            "n/no-unsupported-features/node-builtins": "off",
            "no-await-in-loop": "off",
            "no-confusing-arrow": "off",
            // Tests exercise the `_attach`/`_detach`/`_updateOffset` @internal API of UploadControl directly.
            "no-underscore-dangle": "off",
            "react/destructuring-assignment": "off",
            "react/react-in-jsx-scope": "off",
            "sonarjs/no-dead-store": "off",
            "sonarjs/no-undefined-argument": "off",
            "sonarjs/no-unused-vars": "off",
            "unicorn/no-null": "off",
            "unused-imports/no-unused-vars": "off",
            "vitest/no-conditional-in-test": "off",
            "vitest/require-mock-type-parameters": "off",
            "vitest/unbound-method": "off",
        },
    },
    {
        files: ["src/**/*.ts", "src/**/*.tsx"],
        rules: {
            // Prettier owns indent and operator-linebreak placement; ESLint's stylistic rules
            // disagree on multi-line variable declarations, type unions, and ternary objects.
            "@stylistic/indent": "off",
            "@stylistic/operator-linebreak": "off",
        },
    },
    // Vue configuration
    ...vue.configs["flat/recommended"],
    {
        files: ["**/*.vue"],
        languageOptions: {
            parser: vueParser,
            parserOptions: {
                ecmaVersion: "latest",
                sourceType: "module",
            },
        },
        plugins: {
            vue,
        },
        processor: vue.processors[".vue"],
    },
    // Solid configuration
    {
        files: ["**/*.tsx", "**/*.jsx"],
        plugins: {
            solid,
        },
        rules: {
            ...solid.configs.recommended.rules,
        },
    },
    // Svelte configuration
    ...svelte.configs.recommended,
    {
        files: ["**/*.svelte", "*.svelte", "**/*.svelte.js", "*.svelte.js", "**/*.svelte.ts", "*.svelte.ts"],
        languageOptions: {
            parser: svelteParser,
            parserOptions: {
                ecmaVersion: "latest",
                parser: tsParser,
                sourceType: "module",
            },
        },
        plugins: {
            svelte,
        },
    },
    // TanStack Query configuration
    {
        plugins: {
            "@tanstack/query": tanstackQuery,
        },
        rules: {
            ...tanstackQuery.configs.recommended.rules,
        },
    },
);
