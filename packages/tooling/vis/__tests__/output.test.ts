import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { error, failure, info, note, success, SYMBOLS, warn } from "../src/output";

describe("output module", () => {
    let stderrSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        stderrSpy = vi.spyOn(process.stderr, "write").mockReturnValue(true);
    });

    afterEach(() => {
        stderrSpy.mockRestore();
    });

    describe("symbols", () => {
        it("should export standard symbols", () => {
            expect.assertions(4);

            expect(SYMBOLS.success).toBe("\u2713");
            expect(SYMBOLS.failure).toBe("\u2717");
            expect(SYMBOLS.warning).toBe("\u26A0");
            expect(SYMBOLS.arrow).toBe("\u2192");
        });
    });

    describe("info", () => {
        it("should write to stderr with info: prefix", () => {
            expect.assertions(2);

            info("test message");

            expect(stderrSpy).toHaveBeenCalledTimes(1);

            const output = stderrSpy.mock.calls[0]?.[0] as string;

            expect(output).toContain("info:");
        });
    });

    describe("warn", () => {
        it("should write to stderr with warn: prefix", () => {
            expect.assertions(2);

            warn("warning message");

            expect(stderrSpy).toHaveBeenCalledTimes(1);

            const output = stderrSpy.mock.calls[0]?.[0] as string;

            expect(output).toContain("warn:");
        });
    });

    describe("error", () => {
        it("should write to stderr with error: prefix", () => {
            expect.assertions(2);

            error("error message");

            expect(stderrSpy).toHaveBeenCalledTimes(1);

            const output = stderrSpy.mock.calls[0]?.[0] as string;

            expect(output).toContain("error:");
        });
    });

    describe("note", () => {
        it("should write to stderr with note: prefix", () => {
            expect.assertions(2);

            note("supplementary info");

            expect(stderrSpy).toHaveBeenCalledTimes(1);

            const output = stderrSpy.mock.calls[0]?.[0] as string;

            expect(output).toContain("note:");
        });
    });

    describe("success", () => {
        it("should write to stderr with checkmark symbol", () => {
            expect.assertions(2);

            success("done");

            expect(stderrSpy).toHaveBeenCalledTimes(1);

            const output = stderrSpy.mock.calls[0]?.[0] as string;

            expect(output).toContain(SYMBOLS.success);
        });
    });

    describe("failure", () => {
        it("should write to stderr with X symbol", () => {
            expect.assertions(2);

            failure("failed");

            expect(stderrSpy).toHaveBeenCalledTimes(1);

            const output = stderrSpy.mock.calls[0]?.[0] as string;

            expect(output).toContain(SYMBOLS.failure);
        });
    });
});
