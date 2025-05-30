import { createConfig } from "@anolilab/eslint-config";

export default createConfig({
    ignores: ["dist", "node_modules", "coverage", "__fixtures__", "__docs__", "vitest.config.ts", "packem.config.ts", ".secretlintrc.cjs", "tsconfig.eslint.json", "package.json", "README.md"],
}, {
    files: ["**/*.test.ts"],
    rules: {
        "@stylistic/no-tabs": "off",
        "@typescript-eslint/no-explicit-any": "off",
        "no-secrets/no-secrets": "off",
        "sonarjs/no-tab": "off",
        "unicorn/no-null": "off",
    },
}, {
    files: ["./src/types/**/*.ts"],
    rules: {
        "sonarjs/file-name-differ-from-class": "off",
    },
});
