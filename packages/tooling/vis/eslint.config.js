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
            "__bench__",
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
            // Vendored CycloneDX schemas — kept verbatim per Apache-2.0 §4.2, so
            // project formatting rules don't apply. See __tests__/sbom/schemas/README.md.
            "__tests__/sbom/schemas/*.json",
            // Vendored upstream JSON schemas used by the report-validation
            // harness in __tests__/fixtures/schemas/load.ts. Refreshed via
            // scripts/refresh-vendored-schemas.ts and kept verbatim.
            "__tests__/fixtures/schemas/*.json",
        ],
        typescript: {
            tsconfigPath: "./tsconfig.eslint.json",
        },
    },
    {
        files: ["**/*.ts", "**/*.tsx"],
        rules: {
            // Extra parens are sometimes needed for clarity
            "@stylistic/no-extra-parens": "off",
            // Explicit member accessibility not required for internal CLI code
            "@typescript-eslint/explicit-member-accessibility": "off",
            // Explicit module boundary types not required
            "@typescript-eslint/explicit-module-boundary-types": "off",
            // Allow non-null assertions in CLI code where runtime context is known
            "@typescript-eslint/no-non-null-assertion": "off",
            // Allow unnecessary conditions for defensive programming
            "@typescript-eslint/no-unnecessary-condition": "off",
            // Type conversion is intentional
            "@typescript-eslint/no-unnecessary-type-conversion": "off",
            "@typescript-eslint/no-unsafe-assignment": "off",
            // CLI code intentionally uses `any` for dynamic PM runner interop
            "@typescript-eslint/no-unsafe-call": "off",
            "@typescript-eslint/no-unsafe-member-access": "off",
            // Use-before-define is too strict for co-located helpers
            "@typescript-eslint/no-use-before-define": "off",
            // Allow nullish coalescing preference to remain as-is
            "@typescript-eslint/prefer-nullish-coalescing": "off",
            // async functions without await are used for interface conformance
            "@typescript-eslint/require-await": "off",
            // Template expressions use dynamic values throughout CLI output
            "@typescript-eslint/restrict-template-expressions": "off",
            // Static regex optimization is not critical in CLI startup code
            "e18e/prefer-static-regex": "off",
            // Inline exports are used throughout for co-located declarations
            "import/exports-last": "off",
            // Extraneous deps are workspace-resolved
            "import/no-extraneous-dependencies": "off",
            // Default export preference not enforced for command modules
            "import/prefer-default-export": "off",
            // JSDoc indentation check not enforced
            "jsdoc/check-indentation": "off",
            // await in loop is used for sequential PM operations
            "no-await-in-loop": "off",
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
            // Super-linear backtracking - patterns are used on bounded input
            "regexp/no-super-linear-backtracking": "off",
            // Complex CLI commands naturally have high cognitive complexity
            "sonarjs/cognitive-complexity": "off",
            // Alphabetical sort patterns are acceptable
            "sonarjs/no-alphabetical-sort": "off",
            // Nested conditionals are acceptable in command handlers
            "sonarjs/no-nested-conditional": "off",
            // OS command from path is expected in CLI tool
            "sonarjs/no-os-command-from-path": "off",
            // Slow regex patterns are acceptable in CLI (not hot-path)
            "sonarjs/slow-regex": "off",
            // Array sort is used intentionally
            "unicorn/no-array-sort": "off",
            // null is used for JSON serialization and PM API compatibility
            "unicorn/no-null": "off",
            // Single-call preference not enforced
            "unicorn/prefer-single-call": "off",
            // Abbreviations are conventional in CLI tooling (e.g., pkg, cmd, args, env)
            "unicorn/prevent-abbreviations": "off",
        },
    },
    {
        files: ["**/*.test.ts"],
        rules: {
            // tests use tmpdir() for fixtures — safe outside test runner
            "sonarjs/publicly-writable-directories": "off",
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
            // React components use default exports and specific patterns
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
