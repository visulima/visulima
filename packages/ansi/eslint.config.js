import { createConfig } from "@anolilab/eslint-config";

export default createConfig({
    ignores: ["dist", "node_modules", "coverage", "__fixtures__", "__docs__", "vitest.config.ts", "packem.config.ts", ".secretlintrc.cjs", "tsconfig.eslint.json", "package.json", "README.md"],
}, {
    files: ["**/*.test.ts"],
    rules: {
        "no-secrets/no-secrets": "off",
        "unicorn/no-null": "off",
    },
});
