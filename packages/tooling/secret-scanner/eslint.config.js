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
            "data",
            "docs/**/*.md",
            "todo/**",
            "scripts/__tests__/**",
            "index.js",
            "index.d.ts",
            "vitest.config.ts",
            "packem.config.ts",
            ".secretlintrc.cjs",
            "package.json",
            "README.md",
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
        rules: {
            // Prettier owns formatting — these stylistic rules conflict with it.
            "@stylistic/max-statements-per-line": "off",
            "@stylistic/no-extra-parens": "off",
            "@stylistic/quotes": "off",
            // Vitest assertion patterns like `findings[0]!.ruleId` are idiomatic.
            "@typescript-eslint/no-non-null-assertion": "off",

            // The NAPI binding surface returns `unknown`; casting through
            // `as unknown as Native.ScanOptions["config"]` is deliberate.
            "@typescript-eslint/no-unnecessary-condition": "off",

            "@typescript-eslint/no-unsafe-argument": "off",
            "@typescript-eslint/no-unsafe-assignment": "off",
            "@typescript-eslint/no-unsafe-call": "off",
            "@typescript-eslint/no-unsafe-member-access": "off",
            "@typescript-eslint/no-unsafe-return": "off",
            // Some public-API functions return `Promise<T>` for API consistency even when
            // the native call underneath is synchronous. The `async` marker keeps the
            // signature uniform across `scan`/`scanFiles`/`scanString`/`inspectRuleset`.
            "@typescript-eslint/require-await": "off",

            // We interpolate numbers (counts, line numbers) into template strings freely;
            // wrapping each in `String(...)` is pure noise.
            "@typescript-eslint/restrict-template-expressions": "off",

            // Export positions are interleaved with types/helpers for readability;
            // forcing every export to the bottom hurts our layout.
            "import/exports-last": "off",

            // We `import type * as Native from "../index.js"` for the NAPI surface.
            "import/no-namespace": "off",
            "import/prefer-default-export": "off",

            // `execFileSync("git", ...)` legitimately relies on PATH; the rule is
            // a lint for shell-like paths, not for a binary we expect to be installed.
            "sonarjs/no-os-command-from-path": "off",

            // `tmpDir`, `cacheDir`, `nativeMod` etc. are clear in context and used
            // consistently across tests; the unicorn rename suggestions are churny.
            "unicorn/prevent-abbreviations": "off",
        },
    },
    {
        files: ["__tests__/**/*"],
        rules: {
            // Tiny inline regexes in test assertions aren't worth module-scoping.
            "e18e/prefer-static-regex": "off",
            // Random-looking strings in fixtures trip the built-in secret detectors.
            "no-secrets/no-secrets": "off",

            "sonarjs/no-hardcoded-secrets": "off",
            // Tests guard on `if (!api) return;` before asserting when the native binding
            // isn't compiled locally. Both rules fight that pattern.
            "vitest/no-conditional-expect": "off",
            "vitest/no-conditional-in-test": "off",

            "vitest/require-top-level-describe": "off",
        },
    },
);
