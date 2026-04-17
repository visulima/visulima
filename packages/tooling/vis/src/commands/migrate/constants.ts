// All known lint-staged config file names.
// JSON-parseable ones come first so they can be auto-migrated.
const LINT_STAGED_JSON_CONFIG_FILES = [".lintstagedrc.json", ".lintstagedrc"] as const;

const LINT_STAGED_OTHER_CONFIG_FILES = [
    ".lintstagedrc.yaml",
    ".lintstagedrc.yml",
    ".lintstagedrc.mjs",
    "lint-staged.config.mjs",
    ".lintstagedrc.cjs",
    "lint-staged.config.cjs",
    ".lintstagedrc.js",
    "lint-staged.config.js",
    ".lintstagedrc.ts",
    "lint-staged.config.ts",
    ".lintstagedrc.mts",
    "lint-staged.config.mts",
    ".lintstagedrc.cts",
    "lint-staged.config.cts",
] as const;

const LINT_STAGED_ALL_CONFIG_FILES: ReadonlyArray<string> = [...LINT_STAGED_JSON_CONFIG_FILES, ...LINT_STAGED_OTHER_CONFIG_FILES];

// Lint-staged invocation patterns — replaced in-place with `vis staged`.
// The optional prefix group captures env var assignments like `NODE_OPTIONS=... `.
const STALE_LINT_STAGED_PATTERNS: ReadonlyArray<RegExp> = [
    // eslint-disable-next-line sonarjs/regex-complexity -- pattern must match all common package runner prefixes
    /^((?:[A-Z_][A-Z0-9_]*(?:=\S*)?\s+)*)(pnpm|pnpm exec|npx|yarn|yarn run|npm exec|npm run|bunx|bun run|bun x)\s+lint-staged\b/,
    /^((?:[A-Z_][A-Z0-9_]*(?:=\S*)?\s+)*)lint-staged\b/,
];

// All known nano-staged config file names.
// JSON-parseable ones come first so they can be auto-migrated.
const NANO_STAGED_JSON_CONFIG_FILES = [".nano-staged.json", ".nanostagedrc"] as const;

const NANO_STAGED_OTHER_CONFIG_FILES = [
    ".nano-staged.mjs",
    ".nano-staged.cjs",
    ".nano-staged.js",
    "nano-staged.config.mjs",
    "nano-staged.config.cjs",
    "nano-staged.config.js",
    "nano-staged.config.mts",
    "nano-staged.config.cts",
    "nano-staged.config.ts",
] as const;

const NANO_STAGED_ALL_CONFIG_FILES: ReadonlyArray<string> = [...NANO_STAGED_JSON_CONFIG_FILES, ...NANO_STAGED_OTHER_CONFIG_FILES];

// Nano-staged invocation patterns — replaced in-place with `vis staged`.
const STALE_NANO_STAGED_PATTERNS: ReadonlyArray<RegExp> = [
    // eslint-disable-next-line sonarjs/regex-complexity -- pattern must match all common package runner prefixes
    /^((?:[A-Z_][A-Z0-9_]*(?:=\S*)?\s+)*)(pnpm|pnpm exec|npx|yarn|yarn run|npm exec|npm run|bunx|bun run|bun x)\s+nano-staged\b/,
    /^((?:[A-Z_][A-Z0-9_]*(?:=\S*)?\s+)*)nano-staged\b/,
];

// Packages removed during migration
const REPLACED_PACKAGES = ["husky", "lint-staged", "nano-staged"] as const;

// Husky script patterns — shared between hook/migrate and migrate/deps
const HUSKY_STANDALONE_RE = /\(is-ci \|\| husky \|\| exit 0\)\s*&&\s*/g;
const HUSKY_INSTALL_AND_RE = /\bhusky(?:\s+install)?\s*&&\s*/g;

const AND_HUSKY_INSTALL_RE = /\s*&&\s*husky(?:\s+install)?/g;

const OR_HUSKY_INSTALL_RE = /\s*\|\|\s*husky(?:\s+install)?/g;

const HUSKY_SCRIPT_PATTERNS: ReadonlyArray<RegExp> = [HUSKY_STANDALONE_RE, HUSKY_INSTALL_AND_RE, AND_HUSKY_INSTALL_RE, OR_HUSKY_INSTALL_RE];

/**
 * Remove husky references from a single script value.
 * Returns the cleaned script, or undefined if the entire script should be removed.
 */
const cleanHuskyFromScript = (scriptValue: string): string | undefined => {
    // Remove standalone husky commands entirely
    if (scriptValue === "husky" || scriptValue === "husky install") {
        return undefined;
    }

    let cleaned = scriptValue;

    for (const pattern of HUSKY_SCRIPT_PATTERNS) {
        cleaned = cleaned.replace(pattern, "");
    }

    cleaned = cleaned.trim();

    return cleaned === scriptValue ? scriptValue : cleaned || undefined;
};

export {
    cleanHuskyFromScript,
    HUSKY_SCRIPT_PATTERNS,
    LINT_STAGED_ALL_CONFIG_FILES,
    LINT_STAGED_JSON_CONFIG_FILES,
    LINT_STAGED_OTHER_CONFIG_FILES,
    NANO_STAGED_ALL_CONFIG_FILES,
    NANO_STAGED_JSON_CONFIG_FILES,
    NANO_STAGED_OTHER_CONFIG_FILES,
    REPLACED_PACKAGES,
    STALE_LINT_STAGED_PATTERNS,
    STALE_NANO_STAGED_PATTERNS,
};
