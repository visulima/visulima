import realTerminalSize from "terminal-size";
import { afterEach, describe, expect, it, vi } from "vitest";

import terminalSize, { DEFAULT_COLUMNS, DEFAULT_ROWS } from "../../src/vendor/terminal-size";

// The stubbed `process` must be torn down even if a test throws, so the rest of the
// suite (and the parity check below) sees the real host runtime again.
// eslint-disable-next-line vitest/require-top-level-describe
afterEach(() => {
    vi.unstubAllGlobals();
});

describe("vendored terminalSize", () => {
    it("prefers the stdout dimensions", () => {
        expect.assertions(1);

        vi.stubGlobal("process", { stderr: { columns: 10, rows: 10 }, stdout: { columns: 120, rows: 40 } });

        expect(terminalSize()).toStrictEqual({ columns: 120, rows: 40 });
    });

    it("falls back to stderr when stdout has no dimensions", () => {
        expect.assertions(1);

        vi.stubGlobal("process", { stderr: { columns: 100, rows: 30 }, stdout: {} });

        expect(terminalSize()).toStrictEqual({ columns: 100, rows: 30 });
    });

    it("falls back to the COLUMNS/LINES environment variables", () => {
        expect.assertions(1);

        vi.stubGlobal("process", { env: { COLUMNS: "133", LINES: "44" }, stderr: {}, stdout: {} });

        expect(terminalSize()).toStrictEqual({ columns: 133, rows: 44 });
    });

    it("returns the documented fallback on a runtime with no Node builtins", () => {
        expect.assertions(1);

        // No `getBuiltinModule`: the shape a Worker/Deno-Deploy style runtime presents.
        vi.stubGlobal("process", { env: {}, stderr: {}, stdout: {} });

        expect(terminalSize()).toStrictEqual({ columns: DEFAULT_COLUMNS, rows: DEFAULT_ROWS });
    });

    it("returns the documented fallback when there is no process at all", () => {
        expect.assertions(1);

        vi.stubGlobal("process", undefined);

        expect(terminalSize()).toStrictEqual({ columns: DEFAULT_COLUMNS, rows: DEFAULT_ROWS });
    });

    it("agrees with the upstream implementation on the host runtime", () => {
        expect.assertions(1);

        // Parity check against the real package (a devDependency, never shipped):
        // the port must not change what boxen measures on Node.
        expect(terminalSize()).toStrictEqual(realTerminalSize());
    });
});
