import { createConfig } from "@anolilab/eslint-config";

/** @type {import("@anolilab/eslint-config").PromiseFlatConfigComposer} */
export default createConfig(
    {
        ignores: [
            "dist",
            "node_modules",
            "coverage",
            "__fixtures__",
            "examples",
            "vitest.config.ts",
            "packem.config.ts",
            ".secretlintrc.cjs",
            "package.json",
            "prettier.config.js",
            "**/README.md",
            "README.md",
            "CHANGELOG.md",
        ],
        typescript: {
            tsconfigPath: "./tsconfig.eslint.json",
        },
    },
    {
        files: ["**/*.ts"],
        rules: {
            // Stylistic conflicts with prettier — handled by prettier
            "@stylistic/brace-style": "off",
            "@stylistic/generator-star-spacing": "off",
            "@stylistic/indent": "off",
            "@stylistic/indent-binary-ops": "off",
            "@stylistic/no-extra-parens": "off",
            "@stylistic/operator-linebreak": "off",
            "@stylistic/quotes": "off",
            // Member ordering is consistent within file conventions
            "@typescript-eslint/adjacent-overload-signatures": "off",
            // await-thenable false positives on retried thenables
            "@typescript-eslint/await-thenable": "off",
            // Module boundary types are inferable from public API
            "@typescript-eslint/explicit-module-boundary-types": "off",
            // Member ordering follows logical grouping over alphabetical
            "@typescript-eslint/member-ordering": "off",
            // Custom naming conventions match ecosystem (S3, GCS APIs)
            "@typescript-eslint/naming-convention": "off",
            // base-to-string would force explicit conversion across logging code
            "@typescript-eslint/no-base-to-string": "off",
            // No-explicit-any used in adapter shims & SDK boundary types
            "@typescript-eslint/no-explicit-any": "off",
            // Floating promises - we use void prefix where intentional
            "@typescript-eslint/no-floating-promises": "off",
            // Allow controlled invalid void types in handler return signatures
            "@typescript-eslint/no-invalid-void-type": "off",
            // Mixed promise/value handlers are valid for express/connect APIs
            "@typescript-eslint/no-misused-promises": "off",
            // Spread of typed records is intentional in upload metadata
            "@typescript-eslint/no-misused-spread": "off",
            // Non-null assertions used where runtime guarantees a value
            "@typescript-eslint/no-non-null-assertion": "off",
            // Redundant type constituents are explicit by design
            "@typescript-eslint/no-redundant-type-constituents": "off",
            // No-shadow conflicts with destructuring patterns
            "@typescript-eslint/no-shadow": "off",
            // this-alias is used in builder/iterator patterns
            "@typescript-eslint/no-this-alias": "off",
            // Defensive null checks remain intentional
            "@typescript-eslint/no-unnecessary-condition": "off",
            // Type conversions are intentional and clarify intent
            "@typescript-eslint/no-unnecessary-type-conversion": "off",
            // Unnecessary type parameters help document call shape
            "@typescript-eslint/no-unnecessary-type-parameters": "off",
            // Unsafe-* rules fire on cloud-SDK responses with weak types
            "@typescript-eslint/no-unsafe-argument": "off",
            "@typescript-eslint/no-unsafe-assignment": "off",
            "@typescript-eslint/no-unsafe-call": "off",
            "@typescript-eslint/no-unsafe-member-access": "off",
            "@typescript-eslint/no-unsafe-return": "off",
            // Use-before-define common with co-located helpers
            "@typescript-eslint/no-use-before-define": "off",
            // Only-throw-error is too strict given throwErrorCode helpers
            "@typescript-eslint/only-throw-error": "off",
            // ?? vs || — || is widely used to coerce empty strings/zeros
            "@typescript-eslint/prefer-nullish-coalescing": "off",
            // Optional chains preserved for readability
            "@typescript-eslint/prefer-optional-chain": "off",
            // Async functions used for interface conformance
            "@typescript-eslint/require-await": "off",
            // restrict-plus-operands fires on stream chunk math
            "@typescript-eslint/restrict-plus-operands": "off",
            // Template expressions handle dynamic types throughout
            "@typescript-eslint/restrict-template-expressions": "off",
            // Unknown in catch is enforced selectively
            "@typescript-eslint/use-unknown-in-catch-callback-variable": "off",
            "antfu/consistent-list-newline": "off",
            // Ban dependencies - storage SDKs are intentional
            "e18e/ban-dependencies": "off",
            // Static regex optimization not critical
            "e18e/prefer-static-regex": "off",
            "generator-star-spacing": "off",
            // Inline exports preferred for co-located declarations
            "import/exports-last": "off",
            // Workspace deps may be missing in package.json
            "import/no-extraneous-dependencies": "off",
            // Default export preference not enforced
            "import/prefer-default-export": "off",
            // JSDoc rules are stylistic and not enforced
            "jsdoc/check-param-names": "off",
            "jsdoc/informative-docs": "off",
            "jsdoc/match-description": "off",
            "jsdoc/no-undefined-types": "off",
            "jsdoc/require-returns-check": "off",
            // Node builtins - we target modern Node
            "n/no-unsupported-features/node-builtins": "off",
            // await in loop used for sequential storage operations
            "no-await-in-loop": "off",
            // Confusing arrow conflicts with prettier formatting
            "no-confusing-arrow": "off",
            // Loops are required for stream chunking
            "no-loops/no-loops": "off",
            // Secrets detection false positives in storage code
            "no-secrets/no-secrets": "off",
            // Underscore-prefixed identifiers used for internal markers
            "no-underscore-dangle": "off",
            // void operator used to mark fire-and-forget cache writes
            "no-void": "off",
            // Promise patterns are deliberately handled
            "promise/always-return": "off",
            "promise/catch-or-return": "off",
            // Capture groups are documented in regex
            "regexp/no-unused-capturing-group": "off",
            // Cognitive complexity high in storage state machines
            "sonarjs/cognitive-complexity": "off",
            // Deprecation warnings come from upstream SDKs
            "sonarjs/deprecation": "off",
            // Different-types comparison is for compat coercion
            "sonarjs/different-types-comparison": "off",
            // Switch statements may have many cases (transformer ops)
            "sonarjs/max-switch-cases": "off",
            "sonarjs/no-all-duplicated-branches": "off",
            // Nested conditionals OK in storage routing
            "sonarjs/no-alphabetical-sort": "off",
            "sonarjs/no-async-constructor": "off",
            "sonarjs/no-clear-text-protocols": "off",
            "sonarjs/no-identical-functions": "off",
            "sonarjs/no-redundant-optional": "off",
            "sonarjs/no-try-promise": "off",
            "sonarjs/no-unused-vars": "off",
            "sonarjs/prefer-regexp-exec": "off",
            "sonarjs/prefer-single-boolean-return": "off",
            "sonarjs/redundant-type-aliases": "off",
            // Slow regex - inputs are bounded HTTP headers
            "sonarjs/slow-regex": "off",
            "sonarjs/use-type-alias": "off",
            // void operator usage flagged by sonarjs
            "sonarjs/void-use": "off",
            // null checks vs explicit length
            "unicorn/explicit-length-check": "off",
            // null is used for JSON serialization compatibility
            "unicorn/no-null": "off",
            // this-assignment is needed in iterator/builder patterns
            "unicorn/no-this-assignment": "off",
            // EventEmitter is the public API consumers depend on
            "unicorn/prefer-event-target": "off",
            // String slice vs substring — substring is fine for inputs
            "unicorn/prefer-string-slice": "off",
            // Unused imports handled by TypeScript
            "unused-imports/no-unused-vars": "off",
        },
    },
    {
        files: ["__tests__/**"],
        rules: {
            // Stylistic — tests sometimes group declarations on a single line
            "@stylistic/max-statements-per-line": "off",
            // void expression OK in arrow callbacks during tests
            "@typescript-eslint/no-confusing-void-expression": "off",
            "@typescript-eslint/unbound-method": "off",
            // Tests use SDKs not declared in package.json
            "import/no-extraneous-dependencies": "off",
            // Tests use console for diagnostics
            "no-console": "off",
            // Promise executor returns common in throwing test setups
            "no-promise-executor-return": "off",
            // Underscore identifiers in test fixtures (e.g., function_)
            "no-underscore-dangle": "off",
            // Tests assert via custom matchers; expect-expect false positives
            "sonarjs/assertions-in-tests": "off",
            // Unused dead store false positives in test setup
            "sonarjs/no-dead-store": "off",
            // Redundant undefined args appear in spy/mock setups
            "sonarjs/no-undefined-argument": "off",
            // Pseudo-random in test fixtures (test data generation)
            "sonarjs/pseudo-random": "off",
            "vitest/expect-expect": "off",
            // Tests intentionally call expect inside conditional branches
            "vitest/no-conditional-expect": "off",
            "vitest/no-conditional-in-test": "off",
            "vitest/no-disabled-tests": "off",
            "vitest/prefer-called-exactly-once-with": "off",
            "vitest/prefer-expect-assertions": "off",
            "vitest/prefer-hooks-in-order": "off",
            "vitest/prefer-snapshot-hint": "off",
            "vitest/prefer-strict-equal": "off",
            "vitest/require-hook": "off",
            "vitest/require-mock-type-parameters": "off",
            "vitest/require-to-throw-message": "off",
            "vitest/unbound-method": "off",
        },
    },
    {
        files: ["src/**"],
        rules: {
            // Switch statements in transformers cover all known step kinds
            "default-case": "off",
            // Accessor pair grouping conflicts with logical class grouping
            "grouped-accessor-pairs": "off",
            // `import * as z from "zod"` is the form required by zod/consistent-import
            "import/no-namespace": "off",
            "n/no-unsupported-features/node-builtins": "off",
            // Mutation of nitro/headers/file params is intentional builder pattern
            "no-param-reassign": "off",
            // Pre/post-increment used in parsers and counters
            "no-plusplus": "off",
            // Useless catch wrappers are intentional re-thrown debugging aids
            "no-useless-catch": "off",
            // Symptom errors retain compatibility with upstream consumers
            "preserve-caught-error": "off",
        },
    },
    {
        // sonarjs expects camelCase filenames matching the class; the project standard is kebab-case
        files: ["src/openapi/*.ts", "src/storage/gcs/gcs-storage.ts", "src/handler/multipart/multipart.ts"],
        rules: {
            "sonarjs/file-name-differ-from-class": "off",
        },
    },
    {
        // "idrive-e2" is the provider's product name and cannot be renamed
        files: ["src/storage/aws/clients/idrive-e2.ts"],
        rules: {
            "unicorn/prevent-abbreviations": "off",
        },
    },
);
