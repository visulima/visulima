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
            "scripts",
            "vitest.config.ts",
            "vitest.workerd.config.ts",
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
        // A few dialect feature names (`numberedLastDayOfMonth`, `mixedDayOfMonthText`) read as high
        // entropy to the secret heuristic.
        files: ["src/**/*.ts", "__tests__/**/*.ts"],
        rules: {
            "no-secrets/no-secrets": "off",
        },
    },
);
