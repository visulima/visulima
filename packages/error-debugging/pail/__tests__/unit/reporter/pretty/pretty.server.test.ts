import { stderr, stdout } from "node:process";

import { blueBright, bold, grey, red } from "@visulima/colorize";
import type { InteractiveManager } from "@visulima/interactive-manager";
import terminalSize from "terminal-size";
import { describe, expect, it, vi } from "vitest";

import { EMPTY_SYMBOL } from "../../../../src/constants";
import { dateFormatter } from "../../../../src/reporter/pretty/abstract-pretty-reporter";
import { PrettyReporter } from "../../../../src/reporter/pretty/pretty-reporter.server";
import type { ReadonlyMeta } from "../../../../src/types";

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

describe("prettyReporter", () => {
    it("should format and write messages correctly to stdout", () => {
        expect.assertions(1);

        const prettyReporter = new PrettyReporter();
        const meta = {
            badge: "INFO",
            date,
            groups: ["Group1"],
            label: "Label",
            message: "This is a sample message",
            prefix: "Prefix",
            scope: ["Scope1", "Scope2"],
            suffix: "Suffix",
            type: {
                level: "informational",
                name: "info",
            },
        };
        const stdoutSpy = vi.spyOn(stdout, "write").mockImplementation(() => true);

        prettyReporter.log(meta as ReadonlyMeta<string>);

        expect(stdoutSpy).toHaveBeenCalledExactlyOnceWith(
            `    ${grey("[Group1]")} ${grey(dateFormatter(date))} ${blueBright("INFO") + blueBright("LABEL")} ${grey("....")} ${grey("[Scope1 > Scope2]")} ${grey(". [Prefix]")} ${grey(".......")}\n\n    This is a sample message\n    ${grey("Suffix")}\n`,
        );

        stdoutSpy.mockRestore();
    });

    it("should format and write error messages correctly to stderr", () => {
        expect.assertions(1);

        const prettyReporter = new PrettyReporter();
        const meta = {
            badge: "ERROR",
            date,
            groups: ["Group1"],
            label: "Label",
            message: "This is an error message",
            prefix: "Prefix",
            scope: ["Scope1", "Scope2"],
            suffix: "Suffix",
            type: {
                level: "error",
                name: "error",
            },
        };
        const stderrSpy = vi.spyOn(stderr, "write").mockImplementation(() => true);

        prettyReporter.log(meta as ReadonlyMeta<string>);

        expect(stderrSpy).toHaveBeenCalledExactlyOnceWith(
            `    ${grey("[Group1]")} ${grey(dateFormatter(date))} ${red("ERROR") + red("LABEL")} ${grey("....")} ${grey("[Scope1 > Scope2]")} ${grey(". [Prefix]")} ${grey("......")}\n\n    This is an error message\n    ${grey("Suffix")}\n`,
        );

        stderrSpy.mockRestore();
    });

    it.each(["warning", "critical", "alert", "emergency"])("should route %s-level output to stderr (RFC 5424 severity)", (level) => {
        expect.assertions(2);

        const prettyReporter = new PrettyReporter();
        const meta = {
            badge: "",
            date,
            groups: [],
            label: "",
            message: `${level} message`,
            type: {
                level,
                name: level,
            },
        };
        const stdoutSpy = vi.spyOn(stdout, "write").mockImplementation(() => true);
        const stderrSpy = vi.spyOn(stderr, "write").mockImplementation(() => true);

        prettyReporter.log(meta as ReadonlyMeta<string>);

        expect(stderrSpy).toHaveBeenCalledTimes(1);
        expect(stdoutSpy).not.toHaveBeenCalled();

        stdoutSpy.mockRestore();
        stderrSpy.mockRestore();
    });

    it("should update the stdout stream correctly when setStdout is called", () => {
        expect.assertions(1);

        const prettyReporter = new PrettyReporter();
        const newStdout = { write: vi.fn() } as unknown as NodeJS.WriteStream;

        prettyReporter.setStdout(newStdout);

        const meta = {
            badge: "INFO",
            date,
            groups: ["Group1"],
            label: "Label",
            message: "This is a sample message",
            prefix: "Prefix",
            scope: ["Scope1", "Scope2"],
            suffix: "Suffix",
            type: {
                level: "informational",
                name: "info",
            },
        };

        prettyReporter.log(meta as ReadonlyMeta<string>);

        expect(newStdout.write).toHaveBeenCalledExactlyOnceWith(
            `    ${grey("[Group1]")} ${grey(dateFormatter(date))} ${blueBright("INFO") + blueBright("LABEL")} ${grey("....")} ${grey("[Scope1 > Scope2]")} ${grey(". [Prefix]")} ${grey(".......")}\n\n    This is a sample message\n    ${grey("Suffix")}\n`,
        );
    });

    it("should update the stderr stream correctly when setStderr is called", () => {
        expect.assertions(1);

        const prettyReporter = new PrettyReporter();
        const newStderr = { write: vi.fn() } as unknown as NodeJS.WriteStream;

        prettyReporter.setStderr(newStderr);

        const meta = {
            badge: "ERROR",
            date,
            groups: ["Group1"],
            label: "Label",
            message: "This is an error message",
            prefix: "Prefix",
            scope: ["Scope1", "Scope2"],
            suffix: "Suffix",
            type: {
                level: "error",
                name: "error",
            },
        };

        prettyReporter.log(meta as ReadonlyMeta<string>);

        expect(newStderr.write).toHaveBeenCalledExactlyOnceWith(
            `    ${grey("[Group1]")} ${grey(dateFormatter(date))} ${red("ERROR") + red("LABEL")} ${grey("....")} ${grey("[Scope1 > Scope2]")} ${grey(". [Prefix]")} ${grey("......")}\n\n    This is an error message\n    ${grey("Suffix")}\n`,
        );
    });

    it("should handle undefined and null message gracefully when log is called", () => {
        expect.assertions(1);

        const prettyReporter = new PrettyReporter();

        const meta = {
            badge: "INFO",
            date,
            groups: ["Group1"],
            label: "Label",
            message: null,
            prefix: "Prefix",
            scope: ["Scope1", "Scope2"],
            suffix: "Suffix",
            type: {
                level: "informational",
                name: "info",
            },
        };
        const stdoutSpy = vi.spyOn(stdout, "write").mockImplementation(() => true);

        prettyReporter.log(meta as ReadonlyMeta<string>);

        expect(stdoutSpy).toHaveBeenCalledExactlyOnceWith(
            `    ${grey("[Group1]")} ${grey(dateFormatter(date))} ${blueBright("INFO") + blueBright("LABEL")} ${grey("....")} ${grey("[Scope1 > Scope2]")} ${grey(". [Prefix]")} ${grey(".......")}\n\n    ${bold("null")}\n    ${grey("Suffix")}\n`,
        );

        stdoutSpy.mockRestore();
    });

    it("should handle empty meta properties correctly when _formatMessage is called", () => {
        expect.assertions(1);

        const prettyReporter = new PrettyReporter();
        const meta = {
            badge: undefined,
            date: undefined,
            groups: [],
            label: undefined,
            message: "",
            prefix: undefined,
            scope: [],
            suffix: undefined,
            type: {
                level: "informational",
                name: "info",
            },
        };
        // @ts-expect-error - The spy is private
        const formattedMessage = prettyReporter._formatMessage(meta as ReadonlyMeta<string>);

        expect(formattedMessage).toBeDefined();
    });

    it("should handle non-tty streams correctly when _log is called", () => {
        expect.assertions(1);

        const prettyReporter = new PrettyReporter();
        const meta = {
            badge: "INFO",
            date,
            groups: ["Group1"],
            label: "Label",
            message: "This is a sample message",
            prefix: "Prefix",
            scope: ["Scope1", "Scope2"],
            suffix: "Suffix",
            type: {
                level: "informational",
                name: "info",
            },
        };
        const stdoutMock = { isTTY: false, write() {} } as unknown as NodeJS.WriteStream;

        prettyReporter.setStdout(stdoutMock);

        const writeStreamSpy = vi.spyOn(prettyReporter as any, "_log");

        prettyReporter.log(meta as ReadonlyMeta<string>);

        expect(writeStreamSpy).toHaveBeenCalledExactlyOnceWith(expect.any(String), "informational");
    });

    it("should handle large messages that exceed terminal width when _formatMessage is called", () => {
        expect.assertions(1);

        const prettyReporter = new PrettyReporter();
        const largeMessage = "A".repeat(1000);
        const meta = {
            badge: undefined,
            date: undefined,
            groups: [],
            label: undefined,
            message: largeMessage,
            prefix: undefined,
            scope: [],
            suffix: undefined,
            type: {
                level: "informational",
                name: "info",
            },
        };
        // @ts-expect-error - The spy is private
        const formattedMessage = prettyReporter._formatMessage(meta);

        expect(formattedMessage).toContain(largeMessage.slice(0, terminalSize().columns - 3));
    });

    it("should handle missing optional meta properties like badge, label, and file when _formatMessage is called", () => {
        expect.assertions(1);

        const prettyReporter = new PrettyReporter();
        const meta = {
            badge: undefined,
            date,
            groups: [],
            label: undefined,
            message: "This is a sample message",
            prefix: undefined,
            scope: [],
            suffix: undefined,
            type: {
                level: "informational",
                name: "info",
            },
        };
        // @ts-expect-error - The spy is private
        const formattedMessage = prettyReporter._formatMessage(meta as ReadonlyMeta<string>);

        expect(formattedMessage).toBeDefined();
    });

    it("should not strip spaces from messages", () => {
        expect.assertions(1);

        const prettyReporter = new PrettyReporter();
        const meta = {
            badge: "INFO",
            date,
            groups: [],
            label: "Label",
            message: "  a  This is a sample message",
            prefix: "Prefix",
            scope: ["Scope1", "Scope2"],
            suffix: "Suffix",
            type: {
                level: "informational",
                name: "info",
            },
        };
        const stdoutSpy = vi.spyOn(stdout, "write").mockImplementation(() => true);

        prettyReporter.log(meta as ReadonlyMeta<string>);

        expect(stdoutSpy).toHaveBeenCalledExactlyOnceWith(
            `${grey(dateFormatter(date))} ${blueBright("INFO") + blueBright("LABEL")} ${grey("....")} ${grey("[Scope1 > Scope2]")} ${grey(". [Prefix]")} ${grey(".....................")}\n\n  a  This is a sample message\n${grey("Suffix")}\n`,
        );

        stdoutSpy.mockRestore();
    });

    it("should route through the interactive manager when interactive and the stream is a TTY", () => {
        expect.assertions(2);

        const prettyReporter = new PrettyReporter();
        const update = vi.fn();
        const ttyStream = { isTTY: true, write: vi.fn() } as unknown as NodeJS.WriteStream;

        prettyReporter.setStdout(ttyStream);
        prettyReporter.setInteractiveManager({ update } as unknown as InteractiveManager);
        prettyReporter.setIsInteractive(true);

        prettyReporter.log({ ...baseInfoMeta, message: "interactive line" } as ReadonlyMeta<string>);

        expect(update).toHaveBeenCalledTimes(1);
        expect(ttyStream.write).not.toHaveBeenCalled();
    });

    it("should respect a custom messageLength style when formatting", () => {
        expect.assertions(1);

        const prettyReporter = new PrettyReporter({ messageLength: 10 });
        const stdoutSpy = vi.spyOn(stdout, "write").mockImplementation(() => true);

        prettyReporter.log(baseInfoMeta as ReadonlyMeta<string>);

        expect(stdoutSpy).toHaveBeenCalledTimes(1);

        stdoutSpy.mockRestore();
    });

    it("should pad the badge column when no badge is present but a longest badge exists", () => {
        expect.assertions(1);

        const prettyReporter = new PrettyReporter();

        (prettyReporter as unknown as { loggerTypes: Record<string, unknown> }).loggerTypes = {
            info: { badge: "★", color: "blueBright", label: "INFO", logLevel: "informational" },
        };

        // @ts-expect-error - The spy is private
        const formatted = prettyReporter._formatMessage({ ...baseInfoMeta, badge: undefined } as ReadonlyMeta<string>);

        expect(formatted).toContain("base message");
    });

    it("should render the repeated counter", () => {
        expect.assertions(1);

        const prettyReporter = new PrettyReporter();

        // @ts-expect-error - The spy is private
        const formatted = prettyReporter._formatMessage({ ...baseInfoMeta, repeated: 3 } as ReadonlyMeta<string>);

        expect(formatted).toContain("[3x]");
    });

    it("should render context entries of mixed types", () => {
        expect.assertions(2);

        const prettyReporter = new PrettyReporter();
        const meta = { ...baseInfoMeta, context: [new Error("ctx error"), { key: "value" }, "plain string", 42] };

        // @ts-expect-error - The spy is private
        const formatted = prettyReporter._formatMessage(meta as ReadonlyMeta<string>);

        expect(formatted).toContain("ctx error");
        expect(formatted).toContain("plain string");
    });

    it("should render an error attached to the meta", () => {
        expect.assertions(1);

        const prettyReporter = new PrettyReporter();
        const meta = { ...baseInfoMeta, error: new Error("rendered error") };

        // @ts-expect-error - The spy is private
        const formatted = prettyReporter._formatMessage(meta as ReadonlyMeta<string>);

        expect(formatted).toContain("rendered error");
    });

    it("should render a traceError attached to the meta", () => {
        expect.assertions(1);

        const prettyReporter = new PrettyReporter();

        // @ts-expect-error - The spy is private
        const withTrace = prettyReporter._formatMessage({ ...baseInfoMeta, traceError: new Error("trace") } as ReadonlyMeta<string>);
        // @ts-expect-error - The spy is private
        const without = prettyReporter._formatMessage(baseInfoMeta as ReadonlyMeta<string>);

        expect(withTrace.length).toBeGreaterThan(without.length);
    });

    it("should render the caller file with dot padding when it fits", () => {
        expect.assertions(1);

        const prettyReporter = new PrettyReporter();
        const meta = { ...baseInfoMeta, file: { column: 1, line: 42, name: "app.ts" } };

        // @ts-expect-error - The spy is private
        const formatted = prettyReporter._formatMessage(meta as ReadonlyMeta<string>);

        expect(formatted).toContain("app.ts:42");
    });

    it("should render the caller file inline when it would exceed the line width", () => {
        expect.assertions(1);

        const prettyReporter = new PrettyReporter({ messageLength: 10 });
        const meta = { ...baseInfoMeta, file: { column: 1, line: 42, name: "some/very/long/path/app.ts" } };

        // @ts-expect-error - The spy is private
        const formatted = prettyReporter._formatMessage(meta as ReadonlyMeta<string>);

        expect(formatted).toContain("some/very/long/path/app.ts:42");
    });

    it("should render the caller file name without a line number", () => {
        expect.assertions(1);

        const prettyReporter = new PrettyReporter();
        const meta = { ...baseInfoMeta, file: { column: 1, name: "app.ts" } };

        // @ts-expect-error - The spy is private
        const formatted = prettyReporter._formatMessage(meta as ReadonlyMeta<string>);

        expect(formatted).toContain("app.ts");
    });

    it("should fall back to white for logger types without a color", () => {
        expect.assertions(1);

        const prettyReporter = new PrettyReporter();
        const meta = { ...baseInfoMeta, type: { level: "informational", name: "log" } };

        // @ts-expect-error - The spy is private
        const formatted = prettyReporter._formatMessage(meta as ReadonlyMeta<string>);

        expect(formatted).toContain("base message");
    });

    it("should accept a string date and format it", () => {
        expect.assertions(1);

        const prettyReporter = new PrettyReporter();
        const meta = { ...baseInfoMeta, date: "2021-09-16T09:16:52.000Z" };

        // @ts-expect-error - The spy is private
        const formatted = prettyReporter._formatMessage(meta as ReadonlyMeta<string>);

        expect(formatted).toContain(dateFormatter(date));
    });

    it("should underline the prefix and suffix when styles enable it", () => {
        expect.assertions(2);

        const prettyReporter = new PrettyReporter({ underline: { label: false, message: false, prefix: true, suffix: true } });
        const meta = { ...baseInfoMeta, prefix: "Prefix", suffix: "Suffix" };

        // @ts-expect-error - The spy is private
        const formatted = prettyReporter._formatMessage(meta as ReadonlyMeta<string>);

        expect(formatted).toContain("Prefix");
        expect(formatted).toContain("Suffix");
    });

    it("should tolerate an undefined trailing group entry", () => {
        expect.assertions(1);

        const prettyReporter = new PrettyReporter();
        const meta = { ...baseInfoMeta, groups: [undefined] };

        // @ts-expect-error - The spy is private
        const formatted = prettyReporter._formatMessage(meta as unknown as ReadonlyMeta<string>);

        expect(formatted).toContain("base message");
    });

    it("should render the caller line when the file has no name", () => {
        expect.assertions(1);

        const prettyReporter = new PrettyReporter();
        const meta = { ...baseInfoMeta, file: { column: 1, line: 42 } };

        // @ts-expect-error - The spy is private
        const formatted = prettyReporter._formatMessage(meta as ReadonlyMeta<string>);

        expect(formatted).toContain(":42");
    });

    it("should omit the message section when the message is the empty symbol", () => {
        expect.assertions(1);

        const prettyReporter = new PrettyReporter();
        const meta = { ...baseInfoMeta, message: EMPTY_SYMBOL };

        // @ts-expect-error - The spy is private
        const formatted = prettyReporter._formatMessage(meta as unknown as ReadonlyMeta<string>);

        expect(formatted).not.toContain("base message");
    });
});
