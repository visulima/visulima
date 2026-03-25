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

// Packages removed during migration
const REPLACED_PACKAGES = ["husky", "lint-staged"] as const;

// Default staged config when none exists
const DEFAULT_STAGED_CONFIG: Record<string, string> = { "*": "vis check --fix" };

export {
    DEFAULT_STAGED_CONFIG,
    LINT_STAGED_ALL_CONFIG_FILES,
    LINT_STAGED_JSON_CONFIG_FILES,
    LINT_STAGED_OTHER_CONFIG_FILES,
    REPLACED_PACKAGES,
    STALE_LINT_STAGED_PATTERNS,
};
