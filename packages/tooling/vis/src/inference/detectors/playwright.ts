import type { Detector } from "../types";

export const playwrightDetector: Detector = {
    configFiles: ["playwright.config.ts", "playwright.config.js", "playwright.config.mjs", "playwright.config.mts", "playwright.config.cjs"],
    detect: ({ matchedConfigs }) => {
        const configRef = matchedConfigs[0] ? `{projectRoot}/${matchedConfigs[0]}` : undefined;

        return {
            targets: {
                // `test:e2e` keeps the bare `test` slot free for vitest /
                // jest. Playwright projects almost always coexist with a
                // unit-test runner, so a unique target name avoids the
                // first-detector-wins collision.
                "test:e2e": {
                    command: "playwright test",
                    description: "playwright test (inferred)",
                    inputs: [
                        "{projectRoot}/e2e/**/*",
                        "{projectRoot}/tests/**/*",
                        "{projectRoot}/__tests__/**/*",
                        "{projectRoot}/src/**/*",
                        ...(configRef ? [configRef] : []),
                        "{projectRoot}/package.json",
                    ],
                    outputs: ["{projectRoot}/playwright-report", "{projectRoot}/test-results"],
                    type: "test",
                },
            },
        };
    },
    fallbackDependency: "@playwright/test",
    name: "playwright",
};
