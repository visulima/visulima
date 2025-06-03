import { createConfig } from "@anolilab/eslint-config";

/** @type {import("@anolilab/eslint-config").PromiseFlatConfigComposer} */
export default createConfig({
    ignores: ["dist", "node_modules", "coverage", "__fixtures__", "__docs__", "vitest.config.ts", "packem.config.ts", ".secretlintrc.cjs", "tsconfig.eslint.json", "package.json", "README.md"],
}, {
    files: ["**/*.test.ts"],
    rules: {
        "@typescript-eslint/no-explicit-any": "off",
        "no-secrets/no-secrets": "off",
        "sonarjs/no-nested-functions": "off",
        "unicorn/no-null": "off",
    },
}, {
    files: ["./src/mode.ts", "./src/status.ts"],
    rules: {
        "unicorn/prevent-abbreviations": "off",
    },
}, {
    files: ["./src/**/*.ts"],
    rules: {
        "jsdoc/match-description": "off", // TODO: fix this later
        "jsdoc/no-undefined-types": "off",
    },
});
