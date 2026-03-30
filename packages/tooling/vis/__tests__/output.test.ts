import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
    badge,
    error,
    fail,
    failure,
    getVersion,
    info,
    injectVersion,
    note,
    pass,
    printBanner,
    printStartup,
    separator,
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
            expect.assertions(2);

            info("test message");

            expect(stderrSpy).toHaveBeenCalledTimes(1);

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

    describe("pass / fail", () => {
        it("should write pass: prefix", () => {
            expect.assertions(1);

            pass("all files formatted");

            const output = stderrSpy.mock.calls[0]?.[0] as string;

            expect(output).toContain("pass:");
        });

        it("should write fail: prefix", () => {
            expect.assertions(1);

            fail("3 files have issues");

            const output = stderrSpy.mock.calls[0]?.[0] as string;

            expect(output).toContain("fail:");
        });
    });
});

describe("branding", () => {
    let stderrSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        stderrSpy = vi.spyOn(process.stderr, "write").mockReturnValue(true);
    });

    afterEach(() => {
        stderrSpy.mockRestore();
        delete process.env.VIS_VERSION;
    });

    describe("getVersion", () => {
        it("should return VIS_VERSION env var when set", () => {
            expect.assertions(1);

            process.env.VIS_VERSION = "2.0.0-test";

            expect(getVersion()).toBe("2.0.0-test");
        });

        it("should return a version string when env var not set", () => {
            expect.assertions(1);

            delete process.env.VIS_VERSION;

            const version = getVersion();

            expect(typeof version).toBe("string");
        });
    });

    describe("badge", () => {
        it("should return a string containing VIS", () => {
            expect.assertions(1);

            const result = badge();

            // Badge contains ANSI codes, but should include VIS text
            expect(result).toContain("VIS");
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

    describe("separator", () => {
        it("should return a string of repeated dash characters", () => {
            expect.assertions(1);

            const sep = separator();

            // Should be at least 10 chars (dash might be multi-byte)
            expect(sep.length).toBeGreaterThan(10);
        });
    });

    describe("printBanner", () => {
        it("should not print when stderr is not a TTY", () => {
            expect.assertions(1);

            const origIsTTY = process.stderr.isTTY;

            Object.defineProperty(process.stderr, "isTTY", { configurable: true, value: false });

            printBanner("build");

            expect(stderrSpy).not.toHaveBeenCalled();

            Object.defineProperty(process.stderr, "isTTY", { configurable: true, value: origIsTTY });
        });
    });

    describe("printStartup", () => {
        it("should not print when stderr is not a TTY", () => {
            expect.assertions(1);

            const origIsTTY = process.stderr.isTTY;

            Object.defineProperty(process.stderr, "isTTY", { configurable: true, value: false });

            printStartup();

            expect(stderrSpy).not.toHaveBeenCalled();

            Object.defineProperty(process.stderr, "isTTY", { configurable: true, value: origIsTTY });
        });
    });
});
