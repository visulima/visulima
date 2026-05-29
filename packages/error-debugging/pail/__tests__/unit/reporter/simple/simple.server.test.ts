import { stderr, stdout } from "node:process";

import { blueBright, bold, grey, red } from "@visulima/colorize";
import type { InteractiveManager } from "@visulima/interactive-manager";
import { describe, expect, it, vi } from "vitest";

import { EMPTY_SYMBOL } from "../../../../src/constants";
import { dateFormatter } from "../../../../src/reporter/pretty/abstract-pretty-reporter";
import { SimpleReporter } from "../../../../src/reporter/simple/simple-reporter.server";
import type { Meta, ReadonlyMeta } from "../../../../src/types";

vi.mock(import("terminal-size"), () => {
    return {
        default: () => {
            return {
                columns: 80,
                rows: 24,
            };
        },
    };
});

const date = new Date("2021-09-16T09:16:52.000Z");

const baseInfoMeta = {
    badge: "INFO",
    date,
    groups: ["Group1"],
    label: "Label",
    message: "base message",
    type: {
        level: "informational",
        name: "info",
    },
};

describe("simpleReporter", () => {
    it("should format and write messages correctly to stdout", () => {
        expect.assertions(1);

        const simpleReporter = new SimpleReporter();
        const meta = {
            badge: "INFO",
            date,
            groups: ["Group1"],
            label: "Label",
            message: "This is a sample message1",
            type: {
                level: "informational",
                name: "info",
            },
        };
        const stdoutSpy = vi.spyOn(stdout, "write").mockImplementation(() => true);

        simpleReporter.log(meta as ReadonlyMeta<string>);

        expect(stdoutSpy).toHaveBeenCalledExactlyOnceWith(
            `    ${grey("[Group1]")} ${grey(dateFormatter(date))} ${bold(blueBright("INFO")) + bold(blueBright("LABEL"))}         This is a sample message1\n`,
        );

        stdoutSpy.mockRestore();
    });

    it("should format and write messages correctly to stdout with scope", () => {
        expect.assertions(1);

        const simpleReporter = new SimpleReporter();
        const meta = {
            badge: "INFO",
            date,
            groups: ["Group1"],
            label: "Label",
            message: "This is a sample message",
            scope: ["Scope1", "Scope2"],
            type: {
                level: "informational",
                name: "info",
            },
        };
        const stdoutSpy = vi.spyOn(stdout, "write").mockImplementation(() => true);

        simpleReporter.log(meta as ReadonlyMeta<string>);

        expect(stdoutSpy).toHaveBeenCalledExactlyOnceWith(
            `    ${grey("[Group1]")} ${grey(dateFormatter(date))} ${bold(blueBright("INFO")) + bold(blueBright("LABEL"))}     ${grey("[Scope1 > Scope2]")}     This is a sample message\n`,
        );

        stdoutSpy.mockRestore();
    });

    it("should format and write error messages correctly to stderr", () => {
        expect.assertions(1);

        const simpleReporter = new SimpleReporter();
        const meta = {
            badge: "ERROR",
            date,
            groups: ["Group1"],
            label: "Label",
            message: "This is an error message",
            type: {
                level: "error",
                name: "error",
            },
        };
        const stderrSpy = vi.spyOn(stderr, "write").mockImplementation(() => true);

        simpleReporter.log(meta as ReadonlyMeta<string>);

        expect(stderrSpy).toHaveBeenCalledExactlyOnceWith(
            `    ${grey("[Group1]")} ${grey(dateFormatter(date))} ${bold(red("ERROR")) + bold(red("LABEL"))}         This is an error message\n`,
        );

        stderrSpy.mockRestore();
    });

    it("should update the stdout stream correctly", () => {
        expect.assertions(1);

        const simpleReporter = new SimpleReporter();
        const newStdout = { write: vi.fn() } as unknown as NodeJS.WriteStream;

        simpleReporter.setStdout(newStdout);

        const meta = {
            badge: "INFO",
            date,
            groups: ["Group1"],
            label: "Label",
            message: "This is a sample message",
            type: {
                level: "informational",
                name: "info",
            },
        };

        simpleReporter.log(meta as ReadonlyMeta<string>);

        expect(newStdout.write).toHaveBeenCalledExactlyOnceWith(
            `    ${grey("[Group1]")} ${grey(dateFormatter(date))} ${bold(blueBright("INFO")) + bold(blueBright("LABEL"))}         This is a sample message\n`,
        );
    });

    it("should update the stderr stream correctly", () => {
        expect.assertions(1);

        const simpleReporter = new SimpleReporter();
        const newStderr = { write: vi.fn() } as unknown as NodeJS.WriteStream;

        simpleReporter.setStderr(newStderr);

        const meta = {
            badge: "ERROR",
            date,
            groups: ["Group1"],
            label: "Label",
            message: "This is an error message",
            type: {
                level: "error",
                name: "error",
            },
        };

        simpleReporter.log(meta as ReadonlyMeta<string>);

        expect(newStderr.write).toHaveBeenCalledExactlyOnceWith(
            `    ${grey("[Group1]")} ${grey(dateFormatter(date))} ${bold(red("ERROR")) + bold(red("LABEL"))}         This is an error message\n`,
        );
    });

    it("should handle undefined or null meta fields gracefully", () => {
        expect.assertions(1);

        const simpleReporter = new SimpleReporter();

        const meta = {
            badge: undefined,
            date: null,
            groups: [],
            label: null,
            message: null,
            type: {
                level: "informational",
                name: "info",
            },
        };
        const stdoutSpy = vi.spyOn(stdout, "write").mockImplementation(() => true);

        expect(() => {
            simpleReporter.log(meta as unknown as Meta<string>);
        }).not.toThrow();

        stdoutSpy.mockRestore();
    });

    it("should handle empty or missing context array correctly", () => {
        expect.assertions(1);

        const simpleReporter = new SimpleReporter();
        const meta = {
            badge: "INFO",
            context: [],
            date,
            groups: ["Group1"],
            label: "Label",
            message: "This is a sample message",
            type: {
                level: "informational",
                name: "info",
            },
        };

        // @ts-expect-error - just for testing
        const formattedMessage = simpleReporter.formatMessage(meta as ReadonlyMeta<string>);

        expect(formattedMessage).toContain("This is a sample message");
    });

    it("should handle large messages and wrap them correctly", () => {
        expect.assertions(1);

        const simpleReporter = new SimpleReporter({ messageLength: 20 });
        const meta = {
            badge: "INFO",
            date,
            groups: ["Group1"],
            label: "Label",
            message: "This is a very long sample message that should be wrapped correctly.",
            type: {
                level: "informational",
                name: "info",
            },
        };
        // @ts-expect-error - just for testing
        const formattedMessage = simpleReporter.formatMessage(meta as ReadonlyMeta<string>);

        expect(formattedMessage.split("\n").length).toBeGreaterThan(1);
    });

    it("should not strip spaces from messages", () => {
        expect.assertions(1);

        const simpleReporter = new SimpleReporter();
        const meta = {
            badge: "INFO",
            date,
            groups: ["Group1"],
            label: "Label",
            message: "  a  This is a sample message1",
            type: {
                level: "informational",
                name: "info",
            },
        };
        const stdoutSpy = vi.spyOn(stdout, "write").mockImplementation(() => true);

        simpleReporter.log(meta as ReadonlyMeta<string>);

        expect(stdoutSpy).toHaveBeenCalledExactlyOnceWith(
            `    ${grey("[Group1]")} ${grey(dateFormatter(date))} ${bold(blueBright("INFO")) + bold(blueBright("LABEL"))}           a  This is a sample message1\n`,
        );

        stdoutSpy.mockRestore();
    });

    it("should handle width-safe padding correctly with Unicode characters", () => {
        expect.assertions(1);

        // Create a reporter with custom types that include Unicode characters
        const simpleReporter = new SimpleReporter();

        // Override the logger types to include a wide Unicode character
        (simpleReporter as any).loggerTypes = {
            info: {
                color: "blueBright",
                label: "信息", // Chinese characters (3 bytes but 2 display width)
                logLevel: "informational",
            },
            warn: {
                color: "yellow",
                label: "WARN", // ASCII characters (4 bytes, 4 display width)
                logLevel: "warning",
            },
        };

        const meta = {
            badge: "信息",
            date,
            groups: [],
            label: "信息", // This should be padded to match the longest label width
            message: "Test message",
            type: {
                level: "informational",
                name: "info",
            },
        };
        const stdoutSpy = vi.spyOn(stdout, "write").mockImplementation(() => true);

        simpleReporter.log(meta as ReadonlyMeta<string>);

        // The padding should be calculated based on display width, not string length
        // "信息" has display width of 4, "WARN" has display width of 4
        // So there should be no padding needed
        const expectedOutput = `${grey(dateFormatter(date))} ${bold(blueBright("信息")) + bold(blueBright("信息"))} Test message\n`;

        expect(stdoutSpy).toHaveBeenCalledExactlyOnceWith(expectedOutput);

        stdoutSpy.mockRestore();
    });

    it("should handle width-safe padding with mixed character widths", () => {
        expect.assertions(1);

        // Create a reporter with types that have different display widths
        const simpleReporter = new SimpleReporter();

        (simpleReporter as any).loggerTypes = {
            debug: {
                color: "grey",
                label: "DBG", // 3 characters, 3 display width
                logLevel: "debug",
            },
            error: {
                color: "red",
                label: "🚨ERROR", // 7 characters but 7 display width (emoji + text)
                logLevel: "error",
            },
        };

        const meta = {
            badge: undefined,
            date,
            groups: [],
            label: "DBG", // Shorter label should be padded to match longest
            message: "Debug message",
            type: {
                level: "debug",
                name: "debug",
            },
        };
        const stdoutSpy = vi.spyOn(stdout, "write").mockImplementation(() => true);

        simpleReporter.log(meta as ReadonlyMeta<string>);

        // "🚨ERROR" has display width of 7, "DBG" has display width of 3
        // So "DBG" should be padded with 4 spaces to match, but there might be additional spacing
        const expectedOutput = `${grey(dateFormatter(date))} ${bold(grey("DBG"))}     Debug message\n`;

        expect(stdoutSpy).toHaveBeenCalledExactlyOnceWith(expectedOutput);

        stdoutSpy.mockRestore();
    });

    it("should route through the interactive manager when interactive and the stream is a TTY", () => {
        expect.assertions(2);

        const simpleReporter = new SimpleReporter();
        const update = vi.fn();
        const ttyStream = { isTTY: true, write: vi.fn() } as unknown as NodeJS.WriteStream;

        simpleReporter.setStdout(ttyStream);
        simpleReporter.setInteractiveManager({ update } as unknown as InteractiveManager);
        simpleReporter.setIsInteractive(true);

        simpleReporter.log({ ...baseInfoMeta, message: "interactive line" } as ReadonlyMeta<string>);

        expect(update).toHaveBeenCalledTimes(1);
        expect(ttyStream.write).not.toHaveBeenCalled();
    });

    it("should render context entries of mixed types", () => {
        expect.assertions(2);

        const simpleReporter = new SimpleReporter();
        const meta = { ...baseInfoMeta, context: [new Error("ctx error"), { key: "value" }, "plain string", 42] };

        // @ts-expect-error - testing protected method
        const formatted = simpleReporter.formatMessage(meta as ReadonlyMeta<string>);

        expect(formatted).toContain("ctx error");
        expect(formatted).toContain("plain string");
    });

    it("should render an error attached to the meta", () => {
        expect.assertions(1);

        const simpleReporter = new SimpleReporter();
        const meta = { ...baseInfoMeta, error: new Error("rendered error") };

        // @ts-expect-error - testing protected method
        const formatted = simpleReporter.formatMessage(meta as ReadonlyMeta<string>);

        expect(formatted).toContain("rendered error");
    });

    it("should render a traceError attached to the meta", () => {
        expect.assertions(1);

        const simpleReporter = new SimpleReporter();

        // @ts-expect-error - testing protected method
        const withTrace = simpleReporter.formatMessage({ ...baseInfoMeta, traceError: new Error("trace") } as ReadonlyMeta<string>);
        // @ts-expect-error - testing protected method
        const without = simpleReporter.formatMessage(baseInfoMeta as ReadonlyMeta<string>);

        expect(withTrace.length).toBeGreaterThan(without.length);
    });

    it("should render the repeated counter", () => {
        expect.assertions(1);

        const simpleReporter = new SimpleReporter();

        // @ts-expect-error - testing protected method
        const formatted = simpleReporter.formatMessage({ ...baseInfoMeta, repeated: 3 } as ReadonlyMeta<string>);

        expect(formatted).toContain("[3x]");
    });

    it("should render the prefix", () => {
        expect.assertions(1);

        const simpleReporter = new SimpleReporter();

        // @ts-expect-error - testing protected method
        const formatted = simpleReporter.formatMessage({ ...baseInfoMeta, prefix: "PFX" } as ReadonlyMeta<string>);

        expect(formatted).toContain("PFX");
    });

    it("should render the suffix", () => {
        expect.assertions(1);

        const simpleReporter = new SimpleReporter();

        // @ts-expect-error - testing protected method
        const formatted = simpleReporter.formatMessage({ ...baseInfoMeta, suffix: "SFX" } as ReadonlyMeta<string>);

        expect(formatted).toContain("SFX");
    });

    it("should render the caller file info", () => {
        expect.assertions(2);

        const simpleReporter = new SimpleReporter();
        const meta = { ...baseInfoMeta, file: { column: 1, line: 42, name: "app.ts" } };

        // @ts-expect-error - testing protected method
        const formatted = simpleReporter.formatMessage(meta as ReadonlyMeta<string>);

        expect(formatted).toContain("Caller:");
        expect(formatted).toContain("app.ts:42");
    });

    it("should pad the badge column when no badge is present but a longest badge exists", () => {
        expect.assertions(1);

        const simpleReporter = new SimpleReporter();

        (simpleReporter as unknown as { loggerTypes: Record<string, unknown> }).loggerTypes = {
            info: { badge: "★", color: "blueBright", label: "INFO", logLevel: "informational" },
        };

        // @ts-expect-error - testing protected method
        const formatted = simpleReporter.formatMessage({ ...baseInfoMeta, badge: undefined } as ReadonlyMeta<string>);

        expect(formatted).toContain("base message");
    });

    it("should fall back to white when the logger type has no color", () => {
        expect.assertions(1);

        const simpleReporter = new SimpleReporter();

        (simpleReporter as unknown as { loggerTypes: Record<string, unknown> }).loggerTypes = {
            info: { badge: "INFO", label: "INFO", logLevel: "informational" },
        };

        // @ts-expect-error - testing protected method
        const formatted = simpleReporter.formatMessage({ ...baseInfoMeta } as ReadonlyMeta<string>);

        expect(formatted).toContain("base message");
    });

    it("should accept a string date and parse it", () => {
        expect.assertions(1);

        const simpleReporter = new SimpleReporter();

        // @ts-expect-error - testing protected method
        const formatted = simpleReporter.formatMessage({ ...baseInfoMeta, date: "2021-09-16T09:16:52.000Z" } as unknown as ReadonlyMeta<string>);

        expect(formatted).toContain("base message");
    });

    it("should omit the message section when the message is the empty symbol", () => {
        expect.assertions(1);

        const simpleReporter = new SimpleReporter();

        // @ts-expect-error - testing protected method
        const formatted = simpleReporter.formatMessage({ ...baseInfoMeta, message: EMPTY_SYMBOL } as unknown as ReadonlyMeta<string>);

        expect(formatted).not.toContain("base message");
    });

    it("should underline prefix and suffix when configured", () => {
        expect.assertions(2);

        const simpleReporter = new SimpleReporter({ underline: { label: false, prefix: true, suffix: true } });

        // @ts-expect-error - testing protected method
        const formatted = simpleReporter.formatMessage({ ...baseInfoMeta, prefix: "PFX", suffix: "SFX" } as unknown as ReadonlyMeta<string>);

        expect(formatted).toContain("PFX");
        expect(formatted).toContain("SFX");
    });

    it("should render a caller line when the file has neither name nor line", () => {
        expect.assertions(1);

        const simpleReporter = new SimpleReporter();

        // @ts-expect-error - testing protected method
        const formatted = simpleReporter.formatMessage({ ...baseInfoMeta, file: {} } as unknown as ReadonlyMeta<string>);

        expect(formatted).toContain("Caller:");
    });

    it("should tolerate an undefined trailing group entry", () => {
        expect.assertions(1);

        const simpleReporter = new SimpleReporter();

        // @ts-expect-error - testing protected method
        const formatted = simpleReporter.formatMessage({ ...baseInfoMeta, groups: [undefined] } as unknown as ReadonlyMeta<string>);

        expect(formatted).toContain("base message");
    });
});
