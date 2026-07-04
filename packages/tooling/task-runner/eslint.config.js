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
            "CHANGELOG.md",
            "AGENTS.md",
            "rfc",
            "prettier.config.js",
            "native/Cargo.toml",
            "native/deny.toml",
            "native/index.d.ts",
        ],
        typescript: {
            tsconfigPath: "./tsconfig.eslint.json",
        },
    },
    {
        files: ["__bench__/**/*"],
        rules: {
            "import/no-extraneous-dependencies": "off",
            "no-secrets/no-secrets": "off",
        },
    },
    {
        rules: {
            "@stylistic/max-statements-per-line": "off",
            "@stylistic/no-extra-parens": "off",
            // Stylistic rules
            "@stylistic/quotes": "off",
            // Intentional misused promises in event handlers
            "@typescript-eslint/no-misused-promises": "off",
            // Non-null assertions are used intentionally after validation checks
            "@typescript-eslint/no-non-null-assertion": "off",
            // Shadow is intentional in some callback contexts
            "@typescript-eslint/no-shadow": "off",
            // Intentional unnecessary conditions for defensive coding
            "@typescript-eslint/no-unnecessary-condition": "off",
            // This package extensively uses path.join() which returns untyped values
            "@typescript-eslint/no-unsafe-argument": "off",
            "@typescript-eslint/no-unsafe-assignment": "off",
            "@typescript-eslint/no-unsafe-call": "off",
            "@typescript-eslint/no-unsafe-member-access": "off",
            "@typescript-eslint/no-unsafe-return": "off",
            // Used before define is intentional for hoisted functions
            "@typescript-eslint/no-use-before-define": "off",
            // Nullish coalescing preference is a style choice
            "@typescript-eslint/prefer-nullish-coalescing": "off",
            // Intentional promise rejection with string messages
            "@typescript-eslint/prefer-promise-reject-errors": "off",
            // Async executors are used as callbacks that may not always await
            "@typescript-eslint/require-await": "off",
            // Template literals with numbers/undefined are intentional
            "@typescript-eslint/restrict-template-expressions": "off",
            // Static regex preference is a micro-optimization not needed here
            "e18e/prefer-static-regex": "off",
            // Exports order is not enforced in this package
            "import/exports-last": "off",
            // Single export files don't need default export
            "import/prefer-default-export": "off",
            "jsdoc/check-indentation": "off",
            "jsdoc/check-param-names": "off",
            "jsdoc/escape-inline-tags": "off",
            // JSDoc patterns
            "jsdoc/match-description": "off",
            // Confusing arrow is a style choice
            "no-confusing-arrow": "off",
            // for...of is preferred for readability in this codebase
            "no-for-of-array/no-for-of-array": "off",
            // Param reassign is intentional in some event handlers
            "no-param-reassign": "off",
            // Plusplus is used in loops
            "no-plusplus": "off",
            // Promise param names are a style choice
            "promise/param-names": "off",
            // Cognitive complexity suppressions would be too many
            "sonarjs/cognitive-complexity": "off",
            // Function return type flexibility is needed
            "sonarjs/function-return-type": "off",
            // Sort with alphabetical comparison is intentional for deterministic output
            "sonarjs/no-alphabetical-sort": "off",
            // Misleading array reverse is a false positive for .sort() usage
            "sonarjs/no-misleading-array-reverse": "off",
            // Nested conditionals are used for complex logic
            "sonarjs/no-nested-conditional": "off",
            // Nested functions are needed in some callback patterns
            "sonarjs/no-nested-functions": "off",
            // OS command from path is intentional for shell detection and process spawning
            "sonarjs/no-os-command-from-path": "off",
            // Undefined arguments are intentional
            "sonarjs/no-undefined-argument": "off",
            // Publicly writable directories are used for temp files in tests
            "sonarjs/publicly-writable-directories": "off",
            // Specific eslint-disable comments are handled case by case
            "unicorn/no-abusive-eslint-disable": "off",
            // Array callback references are intentional
            "unicorn/no-array-callback-reference": "off",
            // for...of loops are used for readability in this package
            "unicorn/no-array-sort": "off",
            // null is used intentionally in some APIs
            "unicorn/no-null": "off",
            // Abbreviations like 'e' for error are clear in context
            "unicorn/prevent-abbreviations": "off",
            // Conditional expect is needed in some test scenarios
            "vitest/no-conditional-expect": "off",
        },
    },
);
