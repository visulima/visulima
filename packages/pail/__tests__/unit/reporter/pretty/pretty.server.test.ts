import { stderr, stdout } from "node:process";

import { blueBright, grey, red } from "@visulima/colorize";
import { stringify } from "safe-stable-stringify";
import terminalSize from "terminal-size";
import { describe, expect, it, vi } from "vitest";

import { dateFormatter } from "../../../../src/reporter/pretty/abstract-pretty-reporter";
import PrettyReporter from "../../../../src/reporter/pretty/pretty.server";

vi.mock("terminal-size", () => {
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

        prettyReporter.log(meta);

        expect(stdoutSpy).toHaveBeenCalledWith(
            `    ${grey("[Group1]") + " " + grey(dateFormatter(date))} ${blueBright("INFO") + blueBright("LABEL")} ${grey("....")} ${grey("[Scope1 > Scope2]")} ${grey(". [Prefix]")} ${grey(".......")}\n\n    This is a sample message\n    ${grey("Suffix")}\n\n`,
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

        prettyReporter.log(meta);

        expect(stderrSpy).toHaveBeenCalledWith(
            `    ${grey("[Group1]") + " " + grey(dateFormatter(date))} ${red("ERROR") + red("LABEL")} ${grey("....")} ${grey("[Scope1 > Scope2]")} ${grey(". [Prefix]")} ${grey("......")}\n\n    This is an error message\n    ${grey("Suffix")}\n\n`,
        );

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

        prettyReporter.log(meta);

        // eslint-disable-next-line @typescript-eslint/unbound-method
        expect(newStdout.write).toHaveBeenCalledWith(
            `    ${grey("[Group1]") + " " + grey(dateFormatter(date))} ${blueBright("INFO") + blueBright("LABEL")} ${grey("....")} ${grey("[Scope1 > Scope2]")} ${grey(". [Prefix]")} ${grey(".......")}\n\n    This is a sample message\n    ${grey("Suffix")}\n\n`,
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

        prettyReporter.log(meta);

        // eslint-disable-next-line @typescript-eslint/unbound-method
        expect(newStderr.write).toHaveBeenCalledWith(
            `    ${grey("[Group1]") + " " + grey(dateFormatter(date))} ${red("ERROR") + red("LABEL")} ${grey("....")} ${grey("[Scope1 > Scope2]")} ${grey(". [Prefix]")} ${grey("......")}\n\n    This is an error message\n    ${grey("Suffix")}\n\n`,
        );
    });

    it("should handle undefined or null message gracefully when log is called", () => {
        expect.assertions(1);

        const prettyReporter = new PrettyReporter();

        prettyReporter.setStringify(stringify);

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

        prettyReporter.log(meta);

        expect(stdoutSpy).toHaveBeenCalledWith(
            `    ${grey("[Group1]") + " " + grey(dateFormatter(date))} ${blueBright("INFO") + blueBright("LABEL")} ${grey("....")} ${grey("[Scope1 > Scope2]")} ${grey(". [Prefix]")} ${grey(".......")}\n\n    null\n    ${grey("Suffix")}\n\n`,
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
        const formattedMessage = prettyReporter._formatMessage(meta);
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

        prettyReporter.log(meta);

        expect(writeStreamSpy).toHaveBeenCalledWith(expect.any(String), "informational");
    });

    // _formatMessage method handles large messages that exceed terminal width
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
        const formattedMessage = prettyReporter._formatMessage(meta);

        expect(formattedMessage).toContain(largeMessage.slice(0, terminalSize().columns - 3));
    });

    // _formatMessage method handles missing optional meta properties like badge, label, and file
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
        const formattedMessage = prettyReporter._formatMessage(meta);

        expect(formattedMessage).toBeDefined();
    });
});
