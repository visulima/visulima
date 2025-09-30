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
            ".prettierrc.cjs",
            "package.json",
            "README.md",
        ],
    },
    {
        files: ["./__tests__/unit/package-json.test.ts"],
        rules: {
            "vitest/no-conditional-expect": "off",
            "vitest/no-conditional-in-test": "off",
        },
    },
);
