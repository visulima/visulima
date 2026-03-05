import { defineConfig } from "@anolilab/lint-staged-config";

// Examples are standalone apps requiring their own `pnpm install` before
// type-checking works; exclude them from lint-staged TypeScript checks.
const config = defineConfig({ typescript: { extensions: ["cts", "ts", "mts", "tsx", "ctsx"], exclude: ["/examples/"] } });

// Exclude Playwright e2e spec files from being run through vitest.
// These files use Playwright's test.describe() which is incompatible with vitest.
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
