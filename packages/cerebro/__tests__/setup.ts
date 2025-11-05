import { beforeAll } from "vitest";

// Set default terminal width for consistent test output
beforeAll(() => {
    if (!process.env.CEREBRO_TERMINAL_WIDTH) {
        process.env.CEREBRO_TERMINAL_WIDTH = "80";
    }
});

