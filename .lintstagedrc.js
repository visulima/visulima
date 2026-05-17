import { defineConfig } from "@anolilab/lint-staged-config";

// Examples are standalone apps requiring their own `pnpm install` before
// type-checking works; exclude them from lint-staged TypeScript checks.
const config = defineConfig({ typescript: { extensions: ["cts", "ts", "mts", "tsx", "ctsx"], exclude: ["/examples/", "/apps/web/"] } });

// Exclude Playwright e2e spec files from being run through vitest.
// These files use Playwright's test.describe() which is incompatible with vitest.
// Exclude __fixtures__ directories from sort-package-json — they may contain
// intentionally malformed JSON used by tests.
const FIXTURES_PATH_PATTERN = /__fixtures__[/\\]/;
const originalPkgHandler = config["**/package.json"];

if (originalPkgHandler) {
    config["**/package.json"] = (files) => {
        const filtered = files.filter((f) => !FIXTURES_PATH_PATTERN.test(f));

        if (filtered.length === 0) {
            return [];
        }

        if (Array.isArray(originalPkgHandler)) {
            return originalPkgHandler.map((cmd) => `${cmd} ${filtered.join(" ")}`);
        }

        return originalPkgHandler(filtered);
    };
}

// Prettier-format staged Markdown / MDX at commit time. Every
// package's `lint:prettier` already covers `docs/` via `--check .`,
// but nothing enforced it on commit, so docs could silently drift out
// of compliance (vis/docs did). Prettier resolves each file's nearest
// `prettier.config.js` itself. CHANGELOG.md is prettier-ignored
// repo-wide; __fixtures__ may hold intentionally malformed content.
config["**/*.{md,mdx}"] = (files) => {
    const filtered = files.filter((f) => !FIXTURES_PATH_PATTERN.test(f) && !/[/\\]CHANGELOG\.md$/.test(f));

    if (filtered.length === 0) {
        return [];
    }

    return [`pnpm exec prettier --write ${filtered.map((f) => JSON.stringify(f)).join(" ")}`];
};

const E2E_PATH_PATTERN = /__tests__[/\\]e2e[/\\]/;

const withE2eFilter = (originalHandler) => (files) => {
    const filtered = files.filter((f) => !E2E_PATH_PATTERN.test(f));

    if (filtered.length === 0) {
        return [];
    }

    if (Array.isArray(originalHandler)) {
        return originalHandler.map((cmd) => `${cmd} ${filtered.join(" ")}`);
    }

    return originalHandler(filtered);
};

for (const [pattern, handler] of Object.entries(config)) {
    if (pattern === "**/?(*.){test,spec}.?(c|m)[jt]s?(x)" || pattern === "**/__tests__/**/*.?(c|m)[jt]s?(x)") {
        config[pattern] = withE2eFilter(handler);
    }
}

export default config;
