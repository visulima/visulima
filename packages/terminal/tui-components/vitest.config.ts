import { getVitestConfig } from "../../../tools/get-vitest-config";

const config = getVitestConfig({
    test: {
        setupFiles: ["./__tests__/setup.ts"],
        // Many component tests assert on emitted ANSI. Without this they inherit
        // the ambient terminal's color support and pass locally but fail wherever
        // TERM is absent — a git hook, a bare CI shell — where colorize renders
        // plain text and assertions like "these two gradients differ" collapse.
        env: {
            FORCE_COLOR: "3",
        },
        // type-fest is types-only; its package.json has no JS export under node/import conditions
        deps: {
            inline: [/type-fest/],
        },
        // Mirrors the tui package: render/resize/cursor tests are timing-sensitive
        // and PTY-backed cases pay a few seconds of tsx startup before asserting.
        testTimeout: 15_000,
        retry: process.env.CI ? 3 : 0,
    },
});

export default config;
