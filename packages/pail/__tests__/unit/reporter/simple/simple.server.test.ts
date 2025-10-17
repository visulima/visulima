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
});
