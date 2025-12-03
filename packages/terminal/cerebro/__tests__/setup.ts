import { beforeAll } from "vitest";

// Set default terminal width for consistent test output
// eslint-disable-next-line vitest/require-top-level-describe
beforeAll(() => {
    if (!process.env.CEREBRO_TERMINAL_WIDTH) {
        process.env.CEREBRO_TERMINAL_WIDTH = "80";
    }
});
