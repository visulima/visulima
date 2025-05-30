import { createConfig } from "@anolilab/eslint-config";

export default createConfig({
    ignores: ["dist", "examples", "./README.md", ".secretlintrc.cjs"],
}, {
    files: ["**/*.test.ts"],
    rules: {
        "unicorn/no-null": "off",
    },
});
