import { createConfig } from "@anolilab/eslint-config";

/** @type {import("@anolilab/eslint-config").PromiseFlatConfigComposer} */
export default createConfig({
    ignores: [
        "dist",
        "node_modules",
        "coverage",
        "examples",
        "__fixtures__",
        "__docs__",
        "vitest.config.ts",
        "packem.config.ts",
        ".secretlintrc.cjs",
        "package.json",
        "README.md",
        ".prettierrc.cjs",
    ],
}, {
    // Overrides for browser code in src/
    files: ["src/**/*.{ts,tsx,js,jsx}"],
    rules: {
        // Browser APIs that are not Node.js built-ins
        "n/no-unsupported-features/node-builtins": "off",
        // Dev-mode logging is intentional in toolbar code
        "no-console": "off",
        // Google Fonts URL is not a secret
        "no-secrets/no-secrets": ["error", {
            ignoreContent: ["https://fonts.googleapis.com/css2"],
        }],
        "react-hooks/exhaustive-deps": "off",
        // Preact code - these React rules don't apply
        "react/no-array-index-key": "off",
        "react/no-danger": "off",
    },
}, {
    // jsdoc jsxImportSource tag is valid in Preact/React tsx files
    files: ["src/**/*.{tsx,jsx}"],
    rules: {
        "jsdoc/check-tag-names": ["error", {
            definedTags: ["jsxImportSource", "font-face"],
        }],
        // Preact files use descriptive file names, not class names
        "sonarjs/file-name-differ-from-class": "off",
    },
}, {
    // CSS file overrides
    files: ["src/ui/styles/main.css"],
    rules: {
        "css/use-layers": "off",
    },
}, {
    // Global variables with double underscores in virtual module declarations
    files: ["src/client/virtual-modules.d.ts"],
    rules: {
        "@typescript-eslint/naming-convention": "off",
        "no-underscore-dangle": "off",
        "vars-on-top": "off",
    },
}, {
    // Declaration files (.d.ts) don't have classes that need to match the filename
    files: ["src/**/*.d.ts"],
    rules: {
        "sonarjs/file-name-differ-from-class": "off",
    },
}, {
    // Test file overrides
    files: ["__tests__/**/*.{ts,tsx,js,jsx}"],
    rules: {
        // test setup sometimes needs dynamic property deletion (e.g. localStorage)
        "@typescript-eslint/no-dynamic-delete": "off",
        // Test DOM queries commonly use non-null assertions
        "@typescript-eslint/no-explicit-any": "off",
        "@typescript-eslint/no-non-null-assertion": "off",
        // Inline regexes are fine in test code
        "e18e/prefer-static-regex": "off",
        // import * as t from "@babel/types" pattern used in Babel-related tests
        "import/no-namespace": "off",
        // jsxImportSource is a valid tag in Preact test files
        "jsdoc/check-tag-names": ["error", {
            definedTags: ["jsxImportSource"],
        }],
        // loop counters are fine in tests
        "no-plusplus": "off",
        // tests may use null in assertions
        "unicorn/no-null": "off",
        // short names are acceptable in tests
        "unicorn/prevent-abbreviations": "off",
        "vitest/require-mock-type-parameters": "off",
        "vitest/require-top-level-describe": "off",
    },
});
