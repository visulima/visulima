import { beforeAll } from "vitest";

// Force these BEFORE any beforeAll runs so colorize's module-load detection
// sees FORCE_COLOR=1. setupFiles execute before test modules import, so the
// top-level assignment is what matters; the beforeAll is a belt-and-braces
// fallback for re-evaluated workers.
process.env.CEREBRO_TERMINAL_WIDTH ??= "80";
process.env.FORCE_COLOR = "1";
delete process.env.NO_COLOR;

// eslint-disable-next-line vitest/require-top-level-describe
beforeAll(() => {
    process.env.CEREBRO_TERMINAL_WIDTH ??= "80";
    process.env.FORCE_COLOR = "1";
    delete process.env.NO_COLOR;
});
