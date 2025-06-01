import { createConfig } from "@anolilab/eslint-config";

export default createConfig({
    ignores: ["dist", "node_modules", "coverage", "__fixtures__", "__docs__", "examples", "vitest.config.ts", "packem.config.ts", ".secretlintrc.cjs", "tsconfig.eslint.json", "package.json", "README.md"],
}, {
    files: ["**/*.test.ts"],
    rules: {
        "@typescript-eslint/no-explicit-any": "off",
        "no-secrets/no-secrets": "off",
        "sonarjs/no-nested-functions": "off",
        "unicorn/no-null": "off",
    },
}, {
    files: ["./__tests__/unit/index.test.ts"],
    rules: {
        "@stylistic/no-tabs": "off",
        "sonarjs/no-tab": "off",
    },
}, {
    files: ["./src/**/*.ts"],
    rules: {
        "jsdoc/match-description": "off", // TODO: fix this later
    },
});
