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
            "__bench__/fixtures",
            "__bench__/scripts",
        ],
        typescript: {
            tsconfigPath: "./tsconfig.eslint.json",
        },
    },
    {
        files: ["**/*.test.ts"],
        rules: {
            "@typescript-eslint/no-explicit-any": "off",
            "@typescript-eslint/no-unsafe-argument": "off",
            "@typescript-eslint/no-unsafe-assignment": "off",
            "@typescript-eslint/no-unsafe-call": "off",
            "@typescript-eslint/no-unsafe-return": "off",
            "@typescript-eslint/restrict-template-expressions": "off",
            "no-secrets/no-secrets": "off",
            "sonarjs/no-nested-functions": "off",
            "unicorn/no-null": "off",
        },
    },
    {
        files: ["src/**/*.ts"],
        rules: {
            "@typescript-eslint/no-unsafe-argument": "off",
            "@typescript-eslint/no-unsafe-assignment": "off",
            "@typescript-eslint/no-unsafe-call": "off",
            "@typescript-eslint/no-unsafe-return": "off",
            "@typescript-eslint/restrict-template-expressions": "off",
        },
    },
    {
        files: ["__bench__/**/*.ts"],
        rules: {
            "@typescript-eslint/naming-convention": "off",
            "sonarjs/no-unused-vars": "off",
            "unused-imports/no-unused-vars": "off",
        },
    },
    {
        // Test files use describe.each to test both sync/async variants together,
        // which causes unavoidable type-level conflicts (e.g., awaiting a sync function).
        // These overrides are genuinely needed for test patterns, not masking real issues.
        files: ["__tests__/**/*.ts"],
        rules: {
            "@stylistic/max-statements-per-line": "off",
            "@stylistic/no-extra-parens": "off",
            "@typescript-eslint/await-thenable": "off",
            "@typescript-eslint/no-confusing-void-expression": "off",
            "@typescript-eslint/no-require-imports": "off",
            "@typescript-eslint/require-await": "off",
            "e18e/ban-dependencies": "off",
            "global-require": "off",
            "sonarjs/no-commented-code": "off",
            "unicorn/no-null": "off",
        },
    },
    {
        ignores: ["__bench__/walk.bench.ts", "__bench__/find-up.bench.ts", "__bench__/file-ops.bench.ts", "__bench__/glob.bench.ts"],
    },
);
