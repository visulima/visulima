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
            "vitest.config.ts",
            "packem.config.ts",
            ".secretlintrc.cjs",
            "package.json",
            "README.md",
            "prettier.config.js",
            "examples",
            "index.js",
            "scripts",
            // Exclude markdown files — the markdown plugin extracts fenced code
            // blocks into virtual `<file>.md/<n>_<m>.ts` paths that aren't in
            // tsconfig.eslint.json, which turns every snippet into a parse error.
            "**/*.md",
        ],
        typescript: {
            tsconfigPath: "./tsconfig.eslint.json",
        },
    },
    {
        files: ["**/*.ts", "**/*.tsx"],
        rules: {
            // Max statements per line
            "@stylistic/max-statements-per-line": "off",
            // Extra parens are sometimes needed for clarity
            "@stylistic/no-extra-parens": "off",
            "@stylistic/quotes": "off",
            // Explicit member accessibility not required for internal CLI code
            "@typescript-eslint/explicit-member-accessibility": "off",
            // Explicit module boundary types not required
            "@typescript-eslint/explicit-module-boundary-types": "off",
            // Naming convention flexibility for PM interop
            "@typescript-eslint/naming-convention": "off",
            // base-to-string is too strict for CLI logging
            "@typescript-eslint/no-base-to-string": "off",
            // Allow non-null assertions in CLI code where runtime context is known
            "@typescript-eslint/no-non-null-assertion": "off",
            // Redundant type constituents
            "@typescript-eslint/no-redundant-type-constituents": "off",
            // require imports used for conditional loading
            "@typescript-eslint/no-require-imports": "off",
            // No-shadow is too strict for CLI commands
            "@typescript-eslint/no-shadow": "off",
            // Allow unnecessary conditions for defensive programming
            "@typescript-eslint/no-unnecessary-condition": "off",
            // Type conversion is intentional
            "@typescript-eslint/no-unnecessary-type-conversion": "off",
            // Unnecessary type parameters
            "@typescript-eslint/no-unnecessary-type-parameters": "off",
            "@typescript-eslint/no-unsafe-argument": "off",
            "@typescript-eslint/no-unsafe-assignment": "off",
            // CLI code intentionally uses `any` for dynamic PM runner interop
            "@typescript-eslint/no-unsafe-call": "off",
            "@typescript-eslint/no-unsafe-member-access": "off",
            "@typescript-eslint/no-unsafe-return": "off",
            // Use-before-define is too strict for co-located helpers
            "@typescript-eslint/no-use-before-define": "off",
            // Allow nullish coalescing preference to remain as-is
            "@typescript-eslint/prefer-nullish-coalescing": "off",
            // async functions without await are used for interface conformance
            "@typescript-eslint/require-await": "off",
            // Restrict plus operands
            "@typescript-eslint/restrict-plus-operands": "off",
            // Template expressions use dynamic values throughout CLI output
            "@typescript-eslint/restrict-template-expressions": "off",
            "antfu/if-newline": "off",
            // class-methods-use-this
            "class-methods-use-this": "off",
            // Default case not required in CLI switch statements
            "default-case": "off",
            // Ban dependencies - CLI tool has specific dep requirements
            "e18e/ban-dependencies": "off",
            // Static regex optimization is not critical in CLI startup code
            "e18e/prefer-static-regex": "off",
            // eqeqeq not enforced
            eqeqeq: "off",
            // require imports used for conditional loading
            "global-require": "off",
            // Inline exports are used throughout for co-located declarations
            "import/exports-last": "off",
            // Extraneous deps are workspace-resolved
            "import/no-extraneous-dependencies": "off",
            // Default export preference not enforced for command modules
            "import/prefer-default-export": "off",
            // JSDoc indentation check not enforced
            "jsdoc/check-indentation": "off",
            // JSDoc param names
            "jsdoc/check-param-names": "off",
            // JSDoc escape inline tags not enforced
            "jsdoc/escape-inline-tags": "off",
            // JSDoc description casing is not enforced
            "jsdoc/match-description": "off",
            // Node builtins
            "n/no-unsupported-features/node-builtins": "off",
            // await in loop is used for sequential PM operations
            "no-await-in-loop": "off",
            // Confusing arrow is a style preference
            "no-confusing-arrow": "off",
            // CLI tool uses console output extensively for user-facing messages
            "no-console": "off",
            // Performance-oriented for...of rule - not critical in CLI context
            "no-for-of-array/no-for-of-array": "off",
            // Lone blocks used for scoping
            "no-lone-blocks": "off",
            // Allow param reassignment for option normalization
            "no-param-reassign": "off",
            // CLI code uses postfix increment/decrement idiomatically
            "no-plusplus": "off",
            // Secrets detection false positives in CLI code
            "no-secrets/no-secrets": "off",
            // CLI help strings and SBOM hex fixtures legitimately contain `${…}`-shaped
            // literals (shell templates, placeholder tokens, example purls). They're
            // not template-literal mistakes.
            "no-template-curly-in-string": "off",
            // Underscore-prefixed variables used for unused params
            "no-underscore-dangle": "off",
            // Dead assignments are handled by TS; false-positive prone in CLI patterns
            // where we assign for the side-effect of capturing the discriminant.
            "no-useless-assignment": "off",
            // No useless concat
            "no-useless-concat": "off",
            // No void
            "no-void": "off",
            // prefer-const auto-fix conflicts
            "prefer-const": "off",
            // Preserve caught error
            "preserve-caught-error": "off",
            // Promise patterns are handled correctly
            "promise/always-return": "off",
            "promise/catch-or-return": "off",
            // Promise param names
            "promise/param-names": "off",
            // Super-linear backtracking - patterns are used on bounded input
            "regexp/no-super-linear-backtracking": "off",
            // Regexp unused capturing group
            "regexp/no-unused-capturing-group": "off",
            // Complex CLI commands naturally have high cognitive complexity
            "sonarjs/cognitive-complexity": "off",
            // Different types comparison is intentional for loose checks
            "sonarjs/different-types-comparison": "off",
            // Function return type
            "sonarjs/function-return-type": "off",
            // Alphabetical sort patterns are acceptable
            "sonarjs/no-alphabetical-sort": "off",
            // Clear text protocols detection
            "sonarjs/no-clear-text-protocols": "off",
            // Dead store
            "sonarjs/no-dead-store": "off",
            // Empty collection
            "sonarjs/no-empty-collection": "off",
            // Duplicate helpers across commands are deliberate: each CLI command
            // owns its own copy so refactors don't ripple unexpectedly.
            "sonarjs/no-identical-functions": "off",
            // Reverse/sort in place is idiomatic CLI code.
            "sonarjs/no-misleading-array-reverse": "off",
            // Nested conditionals are acceptable in command handlers
            "sonarjs/no-nested-conditional": "off",
            // OS command from path is expected in CLI tool
            "sonarjs/no-os-command-from-path": "off",
            // Redundant optional not enforced
            "sonarjs/no-redundant-optional": "off",
            // Undefined argument
            "sonarjs/no-undefined-argument": "off",
            // Sonar unused vars - handled by TS
            "sonarjs/no-unused-vars": "off",
            // OS command detection - this is a CLI tool
            "sonarjs/os-command": "off",
            // Prefer single boolean return
            "sonarjs/prefer-single-boolean-return": "off",
            // Pseudo random is acceptable in CLI
            "sonarjs/pseudo-random": "off",
            // tmpdir() paths in CLI code are fine — we don't run as root.
            "sonarjs/publicly-writable-directories": "off",
            // Slow regex patterns are acceptable in CLI (not hot-path)
            "sonarjs/slow-regex": "off",
            // Void use
            "sonarjs/void-use": "off",
            // Filename case is pre-existing and consistent within the package
            "unicorn/filename-case": "off",
            // Unicorn misc
            "unicorn/no-abusive-eslint-disable": "off",
            "unicorn/no-array-callback-reference": "off",
            "unicorn/no-array-reduce": "off",
            // Array sort is used intentionally
            "unicorn/no-array-sort": "off",
            "unicorn/no-await-expression-member": "off",
            // Immediate mutation patterns are used for config building
            "unicorn/no-immediate-mutation": "off",
            // null is used for JSON serialization and PM API compatibility
            "unicorn/no-null": "off",
            "unicorn/no-process-exit": "off",
            "unicorn/prefer-code-point": "off",
            "unicorn/prefer-math-trunc": "off",
            // Single-call preference not enforced
            "unicorn/prefer-single-call": "off",
            "unicorn/prefer-spread": "off",
            // Abbreviations are conventional in CLI tooling (e.g., pkg, cmd, args, env)
            "unicorn/prevent-abbreviations": "off",
            // Unused vars handled by TypeScript
            "unused-imports/no-unused-vars": "off",
        },
    },
    {
        files: ["**/*.test.ts"],
        rules: {
            "@typescript-eslint/no-explicit-any": "off",
            "sonarjs/assertions-in-tests": "off",
            "sonarjs/no-nested-functions": "off",
            "vitest/expect-expect": "off",
            "vitest/require-mock-type-parameters": "off",
        },
    },
    {
        files: ["**/*.tsx"],
        rules: {
            "react-hooks/exhaustive-deps": "off",
            "react-perf/jsx-no-new-function-as-prop": "off",
            // Inline `{…}` props are common in TUI layouts where re-creating the
            // object per render is cheap relative to other work.
            "react-perf/jsx-no-new-object-as-prop": "off",
            // Vis TUI components aren't hot-reloaded — Fast-Refresh constraints
            // don't apply.
            "react-refresh/only-export-components": "off",
            "react-x/no-array-index-key": "off",
            "react-x/set-state-in-effect": "off",
            "react-you-might-not-need-an-effect/no-adjust-state-on-prop-change": "off",
            "react-you-might-not-need-an-effect/no-event-handler": "off",
            // React components use default exports and specific patterns
            "react/function-component-definition": "off",
            "react/no-array-index-key": "off",
            "react/style-prop-object": "off",
        },
    },
    {
        files: ["scripts/**/*.ts"],
        rules: {
            "import/no-extraneous-dependencies": "off",
        },
    },
    {
        // JSON schemas / fixtures carry high-entropy SBOM sample hashes
        // (`gitoid:blob:sha256:…`) and identifier strings. They're not secrets.
        files: ["**/*.json"],
        rules: {
            "no-secrets/no-secrets": "off",
        },
    },
);
