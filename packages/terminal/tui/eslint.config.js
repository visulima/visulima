import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { createConfig } from "@anolilab/eslint-config";
import eslintReactPlugin from "@eslint-react/eslint-plugin";

const __dirname = dirname(fileURLToPath(import.meta.url));

// @eslint-react/eslint-plugin v4 merged separate plugin namespaces (dom, naming-convention, web-api)
// into the single @eslint-react plugin. Build shims so the shared config's plugin references resolve.
function buildPluginShim(prefix) {
    const rules = {};

    for (const [name, rule] of Object.entries(eslintReactPlugin.rules ?? {})) {
        if (name.startsWith(`${prefix}-`)) {
            rules[name.slice(prefix.length + 1)] = rule;
        }
    }

    return { rules };
}

const reactDomShim = buildPluginShim("dom");
const reactNamingConventionShim = buildPluginShim("naming-convention");
const reactWebApiShim = buildPluginShim("web-api");

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
            "prettier.config.js",
            "**/*.js",
            "**/*.d.ts",
            "docs/**",
            "scripts/**",
        ],
        typescript: {
            tsconfigPath: "./tsconfig.eslint.json",
        },
    },
    {
        // Use the explicit tsconfig.eslint.json (which includes tests, examples,
        // and __bench__) instead of projectService, which auto-discovers the
        // nearest tsconfig.json — and that one only includes src/**.
        languageOptions: {
            parserOptions: {
                project: ["./tsconfig.eslint.json"],
                tsconfigRootDir: __dirname,
            },
        },
    },
    {
        files: ["src/**/*.ts", "src/**/*.tsx"],
        rules: {
            // TUI renderer classes use underscore-prefixed private fields (_frames, _lastFrame, etc.)
            "no-underscore-dangle": "off",
            // TUI rendering requires index arithmetic with ++ and --
            "no-plusplus": "off",
            // Ink framework uses custom aria-role and aria-state props for terminal accessibility, not standard HTML ARIA
            "jsx-a11y/aria-props": "off",
            // Prop spreading is the idiomatic pattern in React component libraries
            "react/jsx-props-no-spreading": "off",
            // Named exports are preferred over default exports in this codebase
            "import/prefer-default-export": "off",
            // Several small, zero-native deps (cli-boxes, is-in-ci, signal-exit,
            // patch-console, terminal-size, code-excerpt, tseep, @visulima/ansi,
            // @visulima/error, @visulima/string) are intentionally kept in
            // devDependencies and inlined into dist by packem to shrink the
            // consumer install. packem's own dependency validation is the real
            // guard against shipping an undeclared runtime dep, so this rule —
            // which can't tell an inlined devDep from a stray one — only produces
            // false positives here.
            "import/no-extraneous-dependencies": "off",
            // Node.js EventEmitter is the appropriate choice for terminal I/O, not web EventTarget
            "unicorn/prefer-event-target": "off",
            // TUI rendering mutates output/node objects by design (canvas cells, layout nodes)
            "no-param-reassign": "off",
            // Complex TUI rendering logic (layout, scrolling, diffing) inherently exceeds simple thresholds
            "sonarjs/cognitive-complexity": "off",
            // Native binding loader requires conditional require() for platform detection
            "global-require": "off",
            "@typescript-eslint/no-require-imports": "off",
            // Ink component class needs error boundary + multiple internal classes
            "max-classes-per-file": "off",
            // TUI renderer DOM nodes are guaranteed non-null in rendering context; assertions are safe
            "@typescript-eslint/no-non-null-assertion": "off",
            // Internal TUI classes — explicit accessibility modifiers add noise without value
            "@typescript-eslint/explicit-member-accessibility": "off",
            // Mixed export/implementation is clearer for related utility groups (e.g., color-utils)
            "import/exports-last": "off",
            // Template literals with numbers are safe and idiomatic for ANSI escape codes
            "@typescript-eslint/restrict-template-expressions": ["error", { allowNumber: true }],
            // Arrow functions are the standard pattern in this functional TUI codebase
            "func-style": "off",
            // Member ordering is not enforced — related methods are grouped by functionality
            "@typescript-eslint/member-ordering": "off",
            // Forward references between mutually recursive functions are intentional
            "@typescript-eslint/no-use-before-define": ["error", { functions: false }],
            // Internal TUI framework identifiers (e.g., `maxScrollbackLength`, `internal_maxPushedScrollTop`) trip the entropy heuristic in JSDoc references
            "no-secrets/no-secrets": "off",
            // JSDoc inside src is documentation, not strictly aligned indent
            "jsdoc/check-indentation": "off",
        },
    },
    {
        files: ["**/*.tsx"],
        rules: {
            // PascalCase is the standard naming convention for React component files
            "unicorn/filename-case": ["error", { cases: { kebabCase: true, pascalCase: true } }],
            // null is the canonical "render nothing" return for React components
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
        // Whitespace-sensitive JSX: these tests assert against rendered terminal
        // output, where `<Text>Foo: {bar}</Text>` produces a literal space that
        // disappears if the rule splits the children onto separate lines.
        files: [
            "__tests__/ink/fixtures/**/*.tsx",
            "__tests__/ink/components.test.tsx",
            "__tests__/ink/render.test.tsx",
            "__tests__/ink/render-to-string.test.tsx",
            "__tests__/ink/testing.test.tsx",
            "__tests__/ink/use-box-metrics.test.tsx",
            "__tests__/ink/measure-element.test.tsx",
            "__tests__/ink-compat.test.tsx",
            "examples/use-stdout.tsx",
            "examples/help.tsx",
        ],
        rules: {
            "@stylistic/jsx-one-expression-per-line": "off",
            "react/jsx-one-expression-per-line": "off",
            "@stylistic/jsx-child-element-spacing": "off",
        },
    },
    {
        files: ["__tests__/**/*.ts", "__tests__/**/*.tsx", "__bench__/**/*.ts", "__bench__/**/*.tsx"],
        rules: {
            // Test mocks are inherently untyped — vi.fn(), .mock.calls, as any casts
            "@stylistic/max-statements-per-line": "off",
            "@stylistic/no-extra-parens": "off",
            "@typescript-eslint/explicit-member-accessibility": "off",
            "@typescript-eslint/naming-convention": "off",
            "@typescript-eslint/no-explicit-any": "off",
            "@typescript-eslint/no-non-null-assertion": "off",
            "@typescript-eslint/no-unsafe-argument": "off",
            "@typescript-eslint/no-unsafe-assignment": "off",
            "@typescript-eslint/no-unsafe-call": "off",
            "@typescript-eslint/no-unsafe-member-access": "off",
            "@typescript-eslint/no-unsafe-return": "off",
            "@typescript-eslint/restrict-plus-operands": "off",
            "@typescript-eslint/restrict-template-expressions": "off",
            "@typescript-eslint/unbound-method": "off",
            "e18e/prefer-static-regex": "off",
            "no-bitwise": "off",
            "no-plusplus": "off",
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
            "vitest/no-conditional-in-test": "off",
            "vitest/no-conditional-tests": "off",
            "vitest/prefer-strict-equal": "off",
            "vitest/require-mock-type-parameters": "off",
            "vitest/unbound-method": "off",
            "vitest/no-conditional-expect": "off",
            "react-x/no-array-index-key": "off",
            "react-x/web-api-no-leaked-timeout": "off",
            "react-x/no-create-ref": "off",
            "react-web-api/no-leaked-timeout": "off",
            "react-hooks/exhaustive-deps": "off",
            "react/destructuring-assignment": "off",
            "react/function-component-definition": "off",
            "react/jsx-props-no-spreading": "off",
            "react/no-unescaped-entities": "off",
            "react/sort-comp": "off",
            "no-await-in-loop": "off",
            "no-promise-executor-return": "off",
            "no-underscore-dangle": "off",
            "jsx-a11y/anchor-is-valid": "off",
            "jsdoc/check-indentation": "off",
            "sonarjs/slow-regex": "off",
            "@typescript-eslint/await-thenable": "off",
            "@typescript-eslint/explicit-module-boundary-types": "off",
            "@typescript-eslint/no-confusing-void-expression": "off",
            "@typescript-eslint/no-shadow": "off",
            "@typescript-eslint/no-unnecessary-condition": "off",
            "@typescript-eslint/prefer-nullish-coalescing": "off",
            "@typescript-eslint/require-await": "off",
            "@typescript-eslint/restrict-plus-operands": "off",
            "consistent-return": "off",
            "default-case": "off",
            "import/exports-last": "off",
            "no-secrets/no-secrets": "off",
            "no-void": "off",
            "react-you-might-not-need-an-effect/no-event-handler": "off",
            "react-you-might-not-need-an-effect/no-initialize-state": "off",
            "sonarjs/cognitive-complexity": "off",
            "sonarjs/no-element-overwrite": "off",
            "sonarjs/no-nested-functions": "off",
            "sonarjs/no-unused-collection": "off",
            "sonarjs/void-use": "off",
            "unicorn/no-immediate-mutation": "off",
            "unused-imports/no-unused-vars": "off",
            "vitest/expect-expect": "off",
            "vitest/prefer-each": "off",
            "vitest/require-hook": "off",
            "vitest/require-top-level-describe": "off",
            "antfu/no-import-dist": "off",
            "func-style": "off",
            "no-useless-assignment": "off",
            "promise/always-return": "off",
            "promise/param-names": "off",
            "react-x/no-unused-props": "off",
            "react-x/set-state-in-effect": "off",
            "react-you-might-not-need-an-effect/no-chain-state-updates": "off",
            "react/no-unused-prop-types": "off",
            "react/style-prop-object": "off",
            "sonarjs/assertions-in-tests": "off",
            "sonarjs/no-dead-store": "off",
            "sonarjs/no-ignored-return": "off",
            "sonarjs/no-nested-conditional": "off",
            "sonarjs/pseudo-random": "off",
            "sonarjs/no-unused-vars": "off",
            "unicorn/no-array-reverse": "off",
            "unicorn/prefer-spread": "off",
            "@typescript-eslint/ban-ts-comment": "off",
        },
    },
    {
        // Examples are standalone demo scripts, not production code — they
        // intentionally exercise loose patterns, legacy React APIs, and
        // demo-style code that would be inappropriate in library source.
        files: ["examples/**/*.ts", "examples/**/*.tsx"],
        rules: {
            "@stylistic/max-statements-per-line": "off",
            "@stylistic/no-extra-parens": "off",
            "@typescript-eslint/ban-ts-comment": "off",
            "@typescript-eslint/no-explicit-any": "off",
            "@typescript-eslint/no-implied-eval": "off",
            "@typescript-eslint/no-misused-spread": "off",
            "@typescript-eslint/no-non-null-assertion": "off",
            "@typescript-eslint/no-shadow": "off",
            "@typescript-eslint/no-unnecessary-condition": "off",
            "@typescript-eslint/no-unsafe-argument": "off",
            "@typescript-eslint/no-unsafe-assignment": "off",
            "@typescript-eslint/no-unsafe-call": "off",
            "@typescript-eslint/no-unsafe-member-access": "off",
            "@typescript-eslint/no-unsafe-return": "off",
            "@typescript-eslint/require-await": "off",
            "@typescript-eslint/restrict-plus-operands": "off",
            "@typescript-eslint/restrict-template-expressions": "off",
            "consistent-return": "off",
            "default-case": "off",
            "jsdoc/check-indentation": "off",
            "jsdoc/escape-inline-tags": "off",
            "no-bitwise": "off",
            "no-confusing-arrow": "off",
            "no-console": "off",
            "no-plusplus": "off",
            "no-restricted-syntax": "off",
            "no-void": "off",
            "react-hooks/exhaustive-deps": "off",
            "react-perf/jsx-no-new-array-as-prop": "off",
            "react-perf/jsx-no-new-function-as-prop": "off",
            "react-perf/jsx-no-new-object-as-prop": "off",
            "react-refresh/only-export-components": "off",
            "react-x/no-array-index-key": "off",
            "react-x/no-forward-ref": "off",
            "react-x/no-unstable-default-props": "off",
            "react-x/set-state-in-effect": "off",
            "react-x/web-api-no-leaked-timeout": "off",
            "react-web-api/no-leaked-timeout": "off",
            "react-you-might-not-need-an-effect/no-initialize-state": "off",
            "react/destructuring-assignment": "off",
            "react/function-component-definition": "off",
            "react/jsx-props-no-spreading": "off",
            "react/no-unescaped-entities": "off",
            "react/sort-comp": "off",
            "sonarjs/cognitive-complexity": "off",
            "unicorn/no-immediate-mutation": "off",
            "unicorn/no-null": "off",
            "unused-imports/no-unused-vars": "off",
        },
    },
).then((configs) => {
    // Patch undefined plugin entries from @eslint-react/eslint-plugin v4
    for (const config of configs) {
        if (config.plugins) {
            if (config.plugins["react-dom"] === undefined) {
                config.plugins["react-dom"] = reactDomShim;
            }

            if (config.plugins["react-naming-convention"] === undefined) {
                config.plugins["react-naming-convention"] = reactNamingConventionShim;
            }

            if (config.plugins["react-web-api"] === undefined) {
                config.plugins["react-web-api"] = reactWebApiShim;
            }
        }

        // Remove rules that were renamed/removed in @eslint-react/eslint-plugin v4
        if (config.rules) {
            for (const key of Object.keys(config.rules)) {
                if (
                    key === "react-x/jsx-key-before-spread" ||
                    key === "react-x/jsx-shorthand-boolean" ||
                    key === "react-x/jsx-shorthand-fragment" ||
                    key === "react-x/no-children-prop" ||
                    key === "react-x/no-useless-fragment"
                ) {
                    delete config.rules[key];
                }
            }
        }
    }

    return configs;
});
