import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { createConfig } from "@anolilab/eslint-config";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import("@anolilab/eslint-config").PromiseFlatConfigComposer} */
export default createConfig(
    {
        ignores: [
            "dist",
            "node_modules",
            "coverage",
            "__fixtures__",
            "__docs__",
            "vitest.config.ts",
            "packem.config.ts",
            ".secretlintrc.cjs",
            "package.json",
            "README.md",
            ".prettierrc.cjs",
            "**/*.js",
            "**/*.d.ts",
            "binding.js",
            "docs/**",
        ],
        typescript: {
            tsconfigPath: "./tsconfig.eslint.json",
        },
    },
    {
        languageOptions: {
            parserOptions: {
                projectService: {
                    allowDefaultProject: ["*.js", "*.d.ts", "*.ts", "eslint.config.js"],
                },
                tsconfigRootDir: __dirname,
            },
        },
        rules: {
            "vitest/unbound-method": "off",
        },
    },
    {
        files: ["**/*.tsx"],
        rules: {
            "unicorn/no-null": "off",
        },
    },
    {
        files: ["__tests__/ink/fixtures/**/*.tsx"],
        rules: {
            // Fixtures are standalone React components run as child processes, not test files
            "@typescript-eslint/no-explicit-any": "off",
            "@typescript-eslint/no-unsafe-argument": "off",
            "@typescript-eslint/no-unsafe-assignment": "off",
            "@typescript-eslint/no-unsafe-call": "off",
            "@typescript-eslint/no-unsafe-member-access": "off",
            "no-console": "off",
            "react-refresh/only-export-components": "off",
            "react-web-api/no-leaked-timeout": "off",
            "unicorn/no-null": "off",
        },
    },
    {
        files: ["__tests__/**/*.test.ts", "__tests__/**/*.test.tsx", "__tests__/helpers/**/*.ts"],
        rules: {
            // Test mocks are inherently untyped — vi.fn(), .mock.calls, as any casts
            "@typescript-eslint/no-explicit-any": "off",
            "@typescript-eslint/no-non-null-assertion": "off",
            "@typescript-eslint/no-unsafe-argument": "off",
            "@typescript-eslint/no-unsafe-assignment": "off",
            "@typescript-eslint/no-unsafe-call": "off",
            "@typescript-eslint/no-unsafe-member-access": "off",
            "@typescript-eslint/no-unsafe-return": "off",
            "@typescript-eslint/unbound-method": "off",
            // Ink framework uses custom aria-role and aria-state props, not standard HTML ARIA
            "jsx-a11y/aria-props": "off",
            // Error boundaries and mock components need multiple classes
            "max-classes-per-file": "off",
            // React perf rules don't apply to test JSX
            "react-perf/jsx-no-new-array-as-prop": "off",
            "react-perf/jsx-no-new-function-as-prop": "off",
            "react-perf/jsx-no-new-object-as-prop": "off",
            "react-refresh/only-export-components": "off",
            // it.skipIf makes files appear empty to sonarjs
            "sonarjs/no-empty-test-file": "off",
            // Duplicate test helper functions across describe blocks
            "sonarjs/no-identical-functions": "off",
            // EventEmitter needed for Node.js stream mocking
            "unicorn/prefer-event-target": "off",
            // Tests deliberately check null behavior
            "unicorn/no-null": "off",
            // Tests may be skipped
            "vitest/no-disabled-tests": "off",
        },
    },
);
