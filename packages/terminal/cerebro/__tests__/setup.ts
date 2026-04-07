import { beforeAll } from "vitest";

// Set default terminal width for consistent test output
// eslint-disable-next-line vitest/require-top-level-describe
beforeAll(() => {
    process.env.CEREBRO_TERMINAL_WIDTH ??= "80";
});
