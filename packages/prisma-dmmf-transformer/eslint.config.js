import { createConfig } from "@anolilab/eslint-config";

/** @type {import("@anolilab/eslint-config").PromiseFlatConfigComposer} */
export default createConfig({
    ignores: ["dist", "node_modules", "coverage", "__fixtures__", "__docs__", "vitest.config.ts", "packem.config.ts", ".secretlintrc.cjs", "package.json", "README.md", ".prettierrc.cjs"],
}, {
    files: ["**/*.test.ts"],
    rules: {
        "@stylistic/no-tabs": "off",
        "sonarjs/no-control-regex": "off",
        "sonarjs/no-tab": "off",
        "unicorn/no-null": "off",
    },
});
