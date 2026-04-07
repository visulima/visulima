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
            "__bench__",
            "vitest.config.ts",
            "packem.config.ts",
            ".secretlintrc.cjs",
            "package.json",
            "prettier.config.js",
            "README.md",
        ],
        typescript: {
            tsconfigPath: "./tsconfig.eslint.json",
        },
    },
    {
        files: ["./__tests__/**/*.ts"],
        rules: {
            "@typescript-eslint/require-await": "off",
            "@typescript-eslint/unbound-method": "off",
            "no-underscore-dangle": "off",
            "sonarjs/os-command": "off",
            "unicorn/no-null": "off",
        },
    },
    {
        files: ["**/*.ts"],
        rules: {
            "e18e/prefer-static-regex": "off",
        },
    },
    {
        files: ["./src/**/*.ts"],
        rules: {
            "@rushstack/security/no-unsafe-regexp": "off",
            "@typescript-eslint/no-unnecessary-condition": "off",
            "@typescript-eslint/no-unnecessary-type-parameters": "off",
            "@typescript-eslint/no-unsafe-argument": "off",
            "@typescript-eslint/no-unsafe-assignment": "off",
            "@typescript-eslint/no-unsafe-call": "off",
            "@typescript-eslint/no-unsafe-member-access": "off",
            "@typescript-eslint/no-unsafe-return": "off",
            "@typescript-eslint/prefer-nullish-coalescing": "off",
            "@typescript-eslint/restrict-plus-operands": "off",
            "@typescript-eslint/restrict-template-expressions": "off",
            "e18e/ban-dependencies": "off",
            eqeqeq: "off",
            "etc/no-assign-mutated-array": "off",
            "jsdoc/match-description": "off",
            "no-for-of-array/no-for-of-array": "off",
            "no-restricted-syntax": "off",
            "no-secrets/no-secrets": "off",
            "no-underscore-dangle": "off",
            "security/detect-non-literal-regexp": "off",
            "security/detect-object-injection": "off",
            "sonarjs/different-types-comparison": "off",
            "unicorn/no-array-reverse": "off",
            "unicorn/no-array-sort": "off",
            "unicorn/no-instanceof-builtins": "off",
            "unicorn/no-null": "off",
        },
    },
);
