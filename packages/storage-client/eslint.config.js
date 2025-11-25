import { createConfig } from "@anolilab/eslint-config";
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
            "vitest.config.ts",
            "packem.config.ts",
            ".secretlintrc.cjs",
            "package.json",
            "README.md",
            ".prettierrc.cjs",
        ],
    },
    {
        files: ["__tests__/**"],
        rules: {
            "max-classes-per-file": "off",
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
                sourceType: "module",
            },
        },
        plugins: {
            svelte,
        },
    },
);
