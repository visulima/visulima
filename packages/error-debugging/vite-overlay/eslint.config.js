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
            "package.json",
            "playwright-setup.js",
            "prettier.config.js",
            "README.md",
            "src/overlay/client/index.css", // ignore till eslint fix
        ],
        typescript: {
            tsconfigPath: "./tsconfig.eslint.json",
        },
    },
    {
        files: ["./__tests__/e2e/**"],
        rules: {
            "vitest/consistent-test-filename": "off",
            "vitest/prefer-importing-vitest-globals": "off",
            "vitest/require-hook": "off",
        },
    },
    {
        files: ["./__tests__/**"],
        rules: {
            "@typescript-eslint/member-ordering": "off",
            "@typescript-eslint/no-explicit-any": "off",
            "@typescript-eslint/no-misused-promises": "off",
            "@typescript-eslint/no-non-null-assertion": "off",
            "@typescript-eslint/no-unnecessary-condition": "off",
            "@typescript-eslint/no-unsafe-argument": "off",
            "@typescript-eslint/no-unsafe-assignment": "off",
            "@typescript-eslint/no-unsafe-call": "off",
            "@typescript-eslint/no-unsafe-member-access": "off",
            "@typescript-eslint/no-unsafe-return": "off",
            "@typescript-eslint/prefer-nullish-coalescing": "off",
            "@typescript-eslint/require-await": "off",
            "@typescript-eslint/restrict-template-expressions": "off",
            "@typescript-eslint/unbound-method": "off",
            "no-secrets/no-secrets": "off",
            "sonarjs/publicly-writable-directories": "off",
            "unicorn/no-null": "off",
            // The autofixers for these rules are unsafe in this suite: `toHaveBeenCalledWith()`
            // asserts zero-arg calls (not equivalent to `toHaveBeenCalled()`), and `expectTypeOf`
            // is compile-time only so it breaks `expect.assertions()` counts.
            "vitest/prefer-called-with": "off",
            "vitest/prefer-expect-type-of": "off",
            "vitest/require-mock-type-parameters": "off",
        },
    },
);
