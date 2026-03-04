const { defineConfig } = require("@anolilab/lint-staged-config");

const config = defineConfig();

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
    if (
        pattern === "**/?(*.){test,spec}.?(c|m)[jt]s?(x)" ||
        pattern === "**/__tests__/**/*.?(c|m)[jt]s?(x)"
    ) {
        config[pattern] = withE2eFilter(handler);
    }
}

module.exports = config;
