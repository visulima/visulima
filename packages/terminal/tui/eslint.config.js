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
            "prettier.config.js",
            "**/*.js",
            "**/*.d.ts",
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
                    defaultProject: "tsconfig.eslint.json",
                },
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
        },
    },
    {
        files: ["**/*.tsx"],
        rules: {
            // PascalCase is the standard naming convention for React component files
            "unicorn/filename-case": ["error", { cases: { kebabCase: true, pascalCase: true } }],
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
).then((configs) => {
    // Remove "project" from the shared config — it conflicts with our projectService setting
    for (const config of configs) {
        if (config.languageOptions?.parserOptions?.project !== undefined) {
            delete config.languageOptions.parserOptions.project;
        }
    }

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
