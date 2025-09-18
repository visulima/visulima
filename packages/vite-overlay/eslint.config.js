import { createConfig } from "@anolilab/eslint-config";

/** @type {import("@anolilab/eslint-config").PromiseFlatConfigComposer} */
export default createConfig({
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
        "package.json",
        "README.md",
    ],
}, {
    files: ["./e2e/**"],
    rules: {
        "vitest/no-skipped-tests": "off",
        "vitest/no-focused-tests": "off",
        "vitest/no-conditional-in-test": "off",
        "vitest/no-conditional-in-setup": "off",
        "vitest/no-conditional-in-teardown": "off",
        "vitest/no-conditional-in-test": "off",
        "vitest/no-conditional-in-setup": "off",
        "vitest/no-conditional-in-teardown": "off",
    },
});
