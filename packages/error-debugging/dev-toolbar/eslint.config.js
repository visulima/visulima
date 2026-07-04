import { createConfig } from "@anolilab/eslint-config";

/** @type {import("@anolilab/eslint-config").PromiseFlatConfigComposer} */
export default createConfig(
    {
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
            "CHANGELOG.md",
            "prettier.config.js",
        ],
        typescript: {
            tsconfigPath: "./tsconfig.eslint.json",
        },
    },
    {
        // Overrides for browser code in src/
        files: ["src/**/*.{ts,tsx,js,jsx}"],
        rules: {
            // Multiple statements per line used in compact event handlers and one-liners
            "@stylistic/max-statements-per-line": "off",
            // Ternary expressions in JSX/template code are clearer inline
            "@stylistic/multiline-ternary": "off",
            // Extra parens used for readability in complex expressions
            "@stylistic/no-extra-parens": "off",
            // Naming conventions relaxed for DOM APIs and third-party interop
            "@typescript-eslint/naming-convention": "off",
            // Base-to-string conversions are intentional in template literals
            "@typescript-eslint/no-base-to-string": "off",
            // Void expression used intentionally
            "@typescript-eslint/no-confusing-void-expression": "off",
            // Explicit any used intentionally for dynamic DOM/plugin APIs
            "@typescript-eslint/no-explicit-any": "off",
            "@typescript-eslint/no-floating-promises": "off",
            // Promise handling patterns in event handlers and lifecycle hooks
            "@typescript-eslint/no-misused-promises": "off",
            // Non-null assertions used for DOM element access patterns
            "@typescript-eslint/no-non-null-assertion": "off",
            // Redundant type constituents in complex union types
            "@typescript-eslint/no-redundant-type-constituents": "off",
            // Condition checks are defensive for runtime safety in browser code
            "@typescript-eslint/no-unnecessary-condition": "off",
            // Type conversion is intentional
            "@typescript-eslint/no-unnecessary-type-conversion": "off",
            "@typescript-eslint/no-unsafe-argument": "off",
            // Interop with DOM APIs and Preact internals requires unsafe operations
            "@typescript-eslint/no-unsafe-assignment": "off",
            "@typescript-eslint/no-unsafe-call": "off",
            "@typescript-eslint/no-unsafe-member-access": "off",
            "@typescript-eslint/no-unsafe-return": "off",
            // Forward references used for component and helper organization
            "@typescript-eslint/no-use-before-define": "off",
            // Nullish coalescing not always suitable with falsy value semantics
            "@typescript-eslint/prefer-nullish-coalescing": "off",
            // Optional chain suggestions not always applicable
            "@typescript-eslint/prefer-optional-chain": "off",
            // Promise reject errors - relaxed for browser code
            "@typescript-eslint/prefer-promise-reject-errors": "off",
            // Async functions without await used for interface consistency
            "@typescript-eslint/require-await": "off",
            // Template expressions use numbers and other safe types
            "@typescript-eslint/restrict-template-expressions": "off",
            // Consistent return not always applicable
            "consistent-return": "off",
            // Default case not always needed in switch
            "default-case": "off",
            // Regex in function scope is acceptable for readability
            "e18e/prefer-static-regex": "off",
            // Exports-last not practical with mixed export patterns
            "import/exports-last": "off",
            // Extension handling managed by bundler
            "import/extensions": "off",
            // Single export files don't need default export
            "import/prefer-default-export": "off",
            "jsdoc/check-indentation": "off",
            "jsdoc/check-param-names": "off",
            "jsdoc/escape-inline-tags": "off",
            "jsdoc/informative-docs": "off",
            // JSDoc patterns are consistent within the project
            "jsdoc/match-description": "off",
            // Browser APIs that are not Node.js built-ins
            "n/no-unsupported-features/node-builtins": "off",
            // Confusing arrow is subjective
            "no-confusing-arrow": "off",
            // Dev-mode logging is intentional in toolbar code
            "no-console": "off",
            // Fallthrough in switch is intentional
            "no-fallthrough": "off",
            // For-of loops on arrays are idiomatic and readable
            "no-for-of-array/no-for-of-array": "off",
            // Param reassignment used for DOM manipulation and option normalization
            "no-param-reassign": "off",
            // Increment operators used in loops and counters
            "no-plusplus": "off",
            // document/window globals are expected in browser code
            "no-restricted-globals": "off",
            // Script URLs used intentionally in toolbar code
            "no-script-url": "off",
            // Google Fonts URL and CSS data URIs are not secrets
            "no-secrets/no-secrets": "off",
            // Underscore-prefixed properties used for internal/private APIs
            "no-underscore-dangle": "off",
            // Void operator used intentionally
            "no-void": "off",
            // Prefer const will be fixed individually
            "prefer-const": "off",
            // Promise patterns are intentional
            "promise/always-return": "off",
            "promise/no-nesting": "off",
            "promise/param-names": "off",
            "react-hooks/exhaustive-deps": "off",
            // Preact code - these React rules don't apply
            "react/no-array-index-key": "off",
            "react/no-danger": "off",
            // Complex functions in toolbar UI are inherently complex
            "sonarjs/cognitive-complexity": "off",
            // Deprecation warnings acknowledged - will update in future
            "sonarjs/deprecation": "off",
            // Different types comparison is intentional for loose equality checks
            "sonarjs/different-types-comparison": "off",
            // Function return type inference is sufficient
            "sonarjs/function-return-type": "off",
            // Misleading array reverse - intentional in-place mutation
            "sonarjs/no-misleading-array-reverse": "off",
            // Nested conditionals used for readability in some cases
            "sonarjs/no-nested-conditional": "off",
            // Nested functions used for closures in event handlers
            "sonarjs/no-nested-functions": "off",
            // Undefined argument is intentional
            "sonarjs/no-undefined-argument": "off",
            // Regexp exec vs match - both are valid
            "sonarjs/prefer-regexp-exec": "off",
            // Void use is intentional
            "sonarjs/void-use": "off",
            // Array reverse/sort in-place is intentional
            "unicorn/no-array-reverse": "off",
            // Await expression member access is clearer in some cases
            "unicorn/no-await-expression-member": "off",
            // null is required for DOM APIs and JSON compatibility
            "unicorn/no-null": "off",
            // getElementById is clearer than querySelector for ID lookups
            "unicorn/prefer-query-selector": "off",
            // Top-level await not suitable for library code
            "unicorn/prefer-top-level-await": "off",
            // Abbreviations are well-understood in UI/DOM context (el, ref, etc.)
            "unicorn/prevent-abbreviations": "off",
        },
    },
    {
        // Bin entry point overrides
        files: ["bin/**/*.{js,ts}"],
        rules: {
            "import/extensions": "off",
            "jsdoc/check-indentation": "off",
            "jsdoc/escape-inline-tags": "off",
            "no-console": "off",
            "unicorn/prefer-top-level-await": "off",
        },
    },
    {
        // Unbound method references are intentional for event listener registration
        files: ["src/apps/inspector/inspector-app.ts"],
        rules: {
            "@typescript-eslint/unbound-method": "off",
        },
    },
    {
        // jsdoc jsxImportSource tag is valid in Preact/React tsx files
        files: ["src/**/*.{tsx,jsx}"],
        rules: {
            "jsdoc/check-tag-names": [
                "error",
                {
                    definedTags: ["jsxImportSource", "font-face"],
                },
            ],
            // Preact files use descriptive file names, not class names
            "sonarjs/file-name-differ-from-class": "off",
        },
    },
    {
        // CSS file overrides
        files: ["src/ui/styles/main.css"],
        rules: {
            "css/use-layers": "off",
        },
    },
    {
        // Global variables with double underscores in virtual module declarations
        files: ["src/client/virtual-modules.d.ts"],
        rules: {
            "@typescript-eslint/naming-convention": "off",
            "no-underscore-dangle": "off",
            "vars-on-top": "off",
        },
    },
    {
        // Declaration files (.d.ts) don't have classes that need to match the filename
        files: ["src/**/*.d.ts"],
        rules: {
            "sonarjs/file-name-differ-from-class": "off",
        },
    },
    {
        // Test file overrides
        files: ["__tests__/**/*.{ts,tsx,js,jsx}"],
        rules: {
            // Multiple statements per line in compact test assertions
            "@stylistic/max-statements-per-line": "off",
            // test setup sometimes needs dynamic property deletion (e.g. localStorage)
            "@typescript-eslint/no-dynamic-delete": "off",
            // Test DOM queries commonly use non-null assertions
            "@typescript-eslint/no-explicit-any": "off",
            "@typescript-eslint/no-non-null-assertion": "off",
            // Condition checks are defensive in tests
            "@typescript-eslint/no-unnecessary-condition": "off",
            "@typescript-eslint/no-unsafe-assignment": "off",
            // Unsafe operations needed for mocking and test setup
            "@typescript-eslint/no-unsafe-call": "off",
            "@typescript-eslint/no-unsafe-member-access": "off",
            // Async test functions may not always use await directly
            "@typescript-eslint/require-await": "off",
            // Inline regexes are fine in test code
            "e18e/prefer-static-regex": "off",
            // import * as t from "@babel/types" pattern used in Babel-related tests
            "import/no-namespace": "off",
            // jsxImportSource is a valid tag in Preact test files
            "jsdoc/check-tag-names": [
                "error",
                {
                    definedTags: ["jsxImportSource"],
                },
            ],
            // Node.js builtins used in test environment
            "n/no-unsupported-features/node-builtins": "off",
            // For-of loops on arrays are acceptable in tests
            "no-for-of-array/no-for-of-array": "off",
            // loop counters are fine in tests
            "no-plusplus": "off",
            // Secret-like strings in test fixtures are not real secrets
            "no-secrets/no-secrets": "off",
            // Promise param names are fine in tests
            "promise/param-names": "off",
            // Assertions in tests are validated by vitest
            "sonarjs/assertions-in-tests": "off",
            // Array sort/reverse in tests is intentional
            "sonarjs/no-alphabetical-sort": "off",
            "sonarjs/no-misleading-array-reverse": "off",
            // Array sort in-place is fine in tests
            "unicorn/no-array-sort": "off",
            // tests may use null in assertions
            "unicorn/no-null": "off",
            // short names are acceptable in tests
            "unicorn/prevent-abbreviations": "off",
            // Expect in callbacks is valid pattern
            "vitest/expect-expect": "off",
            // Strict equal not always needed
            "vitest/prefer-strict-equal": "off",
            "vitest/require-mock-type-parameters": "off",
            // Throw message not always needed
            "vitest/require-to-throw-message": "off",
            "vitest/require-top-level-describe": "off",
        },
    },
);
