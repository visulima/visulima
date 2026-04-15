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
            "MIGRATION-GUIDE.md",
        ],
        typescript: {
            tsconfigPath: "./tsconfig.eslint.json",
        },
    },
    {
        // External dep types (@visulima/fs, @visulima/path, js-yaml, @pnpm/*) unresolvable by typescript-eslint
        files: ["src/**/*.ts"],
        rules: {
            "@typescript-eslint/no-unsafe-argument": "off",
            "@typescript-eslint/no-unsafe-assignment": "off",
            "@typescript-eslint/no-unsafe-call": "off",
            "@typescript-eslint/no-unsafe-member-access": "off",
            "@typescript-eslint/no-unsafe-return": "off",
        },
    },
    {
        files: ["./__tests__/**"],
        rules: {
            "@typescript-eslint/no-unsafe-argument": "off",
            "@typescript-eslint/no-unsafe-assignment": "off",
            "@typescript-eslint/no-unsafe-call": "off",
            "@typescript-eslint/no-unsafe-return": "off",
            "@typescript-eslint/restrict-template-expressions": "off",
        },
    },
    {
        files: ["./__tests__/unit/package-json.test.ts"],
        rules: {
            // describe.each union type not properly narrowed by typescript-eslint
            "@typescript-eslint/await-thenable": "off",
            "@typescript-eslint/no-confusing-void-expression": "off",
            "vitest/no-conditional-expect": "off",
            "vitest/no-conditional-in-test": "off",
        },
    },
);
