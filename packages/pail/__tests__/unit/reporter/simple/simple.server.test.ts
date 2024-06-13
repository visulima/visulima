import { stderr, stdout } from "node:process";

import { blueBright, bold, grey, red } from "@visulima/colorize";
import { stringify } from "safe-stable-stringify";
import { describe, expect, it, vi } from "vitest";

import { dateFormatter } from "../../../../src/reporter/pretty/abstract-pretty-reporter";
import SimpleReporter from "../../../../src/reporter/simple/simple.server";

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

describe("simpleReporter", () => {
    it("should format and write messages correctly to stdout", () => {
        expect.assertions(1);

        const simpleReporter = new SimpleReporter();
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
        const stdoutSpy = vi.spyOn(stdout, "write");
        simpleReporter.log(meta);

        expect(stdoutSpy).toHaveBeenCalledWith(
            `    ${grey("[Group1]") + " " + grey(dateFormatter(date))} ${bold(blueBright("INFO")) + bold(blueBright("LABEL"))}         This is a sample message\n`,
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
        const stdoutSpy = vi.spyOn(stdout, "write");
        simpleReporter.log(meta);

        expect(stdoutSpy).toHaveBeenCalledWith(
            `    ${grey("[Group1]") + " " + grey(dateFormatter(date))} ${bold(blueBright("INFO")) + bold(blueBright("LABEL"))}     ${grey("[Scope1 > Scope2]")}     This is a sample message\n`,
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

        simpleReporter.log(meta);

        expect(stderrSpy).toHaveBeenCalledWith(
            `    ${grey("[Group1]") + " " + grey(dateFormatter(date))} ${bold(red("ERROR")) + bold(red("LABEL"))}         This is an error message\n`,
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

        simpleReporter.log(meta);

        // eslint-disable-next-line @typescript-eslint/unbound-method
        expect(newStdout.write).toHaveBeenCalledWith(
            `    ${grey("[Group1]") + " " + grey(dateFormatter(date))} ${bold(blueBright("INFO")) + bold(blueBright("LABEL"))}         This is a sample message\n`,
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

        simpleReporter.log(meta);

        // eslint-disable-next-line @typescript-eslint/unbound-method
        expect(newStderr.write).toHaveBeenCalledWith(
            `    ${grey("[Group1]") + " " + grey(dateFormatter(date))} ${bold(red("ERROR")) + bold(red("LABEL"))}         This is an error message\n`,
        );
    });

    it("should handle undefined or null meta fields gracefully", () => {
        expect.assertions(1);

        const simpleReporter = new SimpleReporter();
        simpleReporter.setStringify(stringify);

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

        expect(() => simpleReporter.log(meta)).not.toThrow();

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
        const formattedMessage = simpleReporter._formatMessage(meta);

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
        const formattedMessage = simpleReporter._formatMessage(meta);

        expect(formattedMessage.split("\n").length).toBeGreaterThan(1);
    });
});
