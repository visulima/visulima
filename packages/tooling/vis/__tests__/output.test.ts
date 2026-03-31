import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
    error,
    failure,
    info,
    injectVersion,
    note,
    success,
    SYMBOLS,
    warn,
} from "../src/output";

describe("output module", () => {
    let stderrSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        stderrSpy = vi.spyOn(process.stderr, "write").mockReturnValue(true);
    });

    afterEach(() => {
        stderrSpy.mockRestore();
        delete process.env.VIS_VERSION;
    });

    describe("symbols", () => {
        it("should export standard symbols", () => {
            expect.assertions(5);

            expect(SYMBOLS.success).toBeDefined();
            expect(SYMBOLS.failure).toBeDefined();
            expect(SYMBOLS.warning).toBeDefined();
            expect(SYMBOLS.arrow).toBeDefined();
            expect(SYMBOLS.dash).toBeDefined();
        });
    });

    describe("info", () => {
        it("should write to stderr with info: prefix", () => {
            expect.assertions(1);

            info("test message");

            const output = stderrSpy.mock.calls[0]?.[0] as string;

            expect(output).toContain("info:");
        });
    });

    describe("warn", () => {
        it("should write to stderr with warn: prefix", () => {
            expect.assertions(1);

            warn("warning message");

            const output = stderrSpy.mock.calls[0]?.[0] as string;

            expect(output).toContain("warn:");
        });
    });

    describe("error", () => {
        it("should write to stderr with error: prefix", () => {
            expect.assertions(1);

            error("error message");

            const output = stderrSpy.mock.calls[0]?.[0] as string;

            expect(output).toContain("error:");
        });
    });

    describe("note", () => {
        it("should write to stderr with note: prefix", () => {
            expect.assertions(1);

            note("supplementary info");

            const output = stderrSpy.mock.calls[0]?.[0] as string;

            expect(output).toContain("note:");
        });
    });

    describe("success", () => {
        it("should write to stderr with checkmark symbol", () => {
            expect.assertions(1);

            success("done");

            const output = stderrSpy.mock.calls[0]?.[0] as string;

            expect(output).toContain(SYMBOLS.success);
        });
    });

    describe("failure", () => {
        it("should write to stderr with X symbol", () => {
            expect.assertions(1);

            failure("failed");

            const output = stderrSpy.mock.calls[0]?.[0] as string;

            expect(output).toContain(SYMBOLS.failure);
        });
    });

    describe("injectVersion", () => {
        it("should set VIS_VERSION environment variable", () => {
            expect.assertions(1);

            delete process.env.VIS_VERSION;
            injectVersion();

            expect(process.env.VIS_VERSION).toBeDefined();
        });
    });
});
