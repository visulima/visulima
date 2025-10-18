import { stderr, stdout } from "node:process";

import { blueBright, bold, grey, red } from "@visulima/colorize";
import { describe, expect, it, vi } from "vitest";

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
            `    ${`${grey("[Group1]")} ${grey(dateFormatter(date))}`} ${bold(blueBright("INFO")) + bold(blueBright("LABEL"))}         This is a sample message1\n`,
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
            `    ${`${grey("[Group1]")} ${grey(dateFormatter(date))}`} ${bold(blueBright("INFO")) + bold(blueBright("LABEL"))}     ${grey("[Scope1 > Scope2]")}     This is a sample message\n`,
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
            `    ${`${grey("[Group1]")} ${grey(dateFormatter(date))}`} ${bold(red("ERROR")) + bold(red("LABEL"))}         This is an error message\n`,
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
            `    ${`${grey("[Group1]")} ${grey(dateFormatter(date))}`} ${bold(blueBright("INFO")) + bold(blueBright("LABEL"))}         This is a sample message\n`,
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
            `    ${`${grey("[Group1]")} ${grey(dateFormatter(date))}`} ${bold(red("ERROR")) + bold(red("LABEL"))}         This is an error message\n`,
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

        expect(() => simpleReporter.log(meta as unknown as Meta<string>)).not.toThrow();

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
            `    ${`${grey("[Group1]")} ${grey(dateFormatter(date))}`} ${bold(blueBright("INFO")) + bold(blueBright("LABEL"))}           a  This is a sample message1\n`,
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
});
