import { createConfig } from "@anolilab/eslint-config";

/** @type {import("@anolilab/eslint-config").PromiseFlatConfigComposer} */
export default createConfig({
    ignores: ["dist", "node_modules", "coverage", "__fixtures__", "__docs__", "vitest.config.ts", "packem.config.ts", ".secretlintrc.cjs", "package.json", "README.md", "CHANGELOG.md"],
}, {
    files: ["**/*.test.ts", "__tests__/**/*.ts", "__bench__/**/*.ts"],
    rules: {
        "@stylistic/no-tabs": "off",
        "@typescript-eslint/no-explicit-any": "off",
        "@typescript-eslint/no-unsafe-argument": "off",
        "@typescript-eslint/no-unsafe-assignment": "off",
        "@typescript-eslint/no-unsafe-call": "off",
        "@typescript-eslint/no-unsafe-member-access": "off",
        "@typescript-eslint/no-unsafe-return": "off",
        "@typescript-eslint/prefer-nullish-coalescing": "off",
        "@typescript-eslint/require-await": "off",
        "e18e/prefer-static-regex": "off",
        "no-secrets/no-secrets": "off",
        "prefer-arrow-callback": "off",
        "sonarjs/no-empty-test-file": "off",
        "sonarjs/no-tab": "off",
        "unicorn/no-immediate-mutation": "off",
        "unicorn/no-null": "off",
        "unicorn/prevent-abbreviations": "off",
    },
}, {
    files: ["./src/types/**/*.ts"],
    rules: {
        "sonarjs/file-name-differ-from-class": "off",
    },
});
