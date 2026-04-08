import { getVitestConfig } from "../../../tools/get-vitest-config";

const config = getVitestConfig({
    test: {
        setupFiles: ["./__tests__/setup.ts"],
        // type-fest is types-only; its package.json has no JS export under node/import conditions
        deps: {
            inline: [/type-fest/],
        },
        // PTY-based tests spawn child processes with tsx transpilation which takes
        // 2-3 seconds just for startup. The default 5s timeout is too tight.
        testTimeout: 15_000,
        // Retry flaky timing-sensitive tests (render, resize, cursor) in CI
        retry: process.env.CI ? 3 : 0,
    },
});

export default config;
