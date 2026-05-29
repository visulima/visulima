import { stderr, stdout } from "node:process";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { EMPTY_SYMBOL } from "../../../../src/constants";
import RawReporter from "../../../../src/reporter/raw/raw-reporter.server";
import type { ReadonlyMeta } from "../../../../src/types";

describe("raw-reporter", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.restoreAllMocks();
    });

    it("should log a message to stdout when given a message and no context or groups", () => {
        expect.assertions(1);

        const rawReporter = new RawReporter();

        rawReporter.setStdout(stdout);
        rawReporter.setStderr(stderr);

        const meta = {
            badge: "info",
            context: undefined,
            date: new Date(),
            error: undefined,
            groups: [],
            label: "label",
            message: "This is a message",
            prefix: "prefix",
            repeated: undefined,
            scope: ["scope1", "scope2"],
            suffix: "suffix",
            traceError: undefined,
            type: {
                level: "informational",
                name: "log",
            },
        };

        const stdoutWriteSpy = vi.spyOn(stdout, "write").mockImplementation(() => true);

        rawReporter.log(meta as unknown as ReadonlyMeta<string>);

        expect(stdoutWriteSpy).toHaveBeenCalledExactlyOnceWith("This is a message");
    });

    it("should log a message to stdout when given a message, groups and no context", () => {
        expect.assertions(1);

        const rawReporter = new RawReporter();

        rawReporter.setStdout(stdout);
        rawReporter.setStderr(stderr);

        const meta = {
            badge: "info",
            context: undefined,
            date: new Date(),
            error: undefined,
            groups: ["test"],
            label: "label",
            message: "This is a message",
            prefix: "prefix",
            repeated: undefined,
            scope: ["scope1", "scope2"],
            suffix: "suffix",
            traceError: undefined,
            type: {
                level: "informational",
                name: "log",
            },
        };

        const stdoutWriteSpy = vi.spyOn(stdout, "write").mockImplementation(() => true);

        rawReporter.log(meta as unknown as ReadonlyMeta<string>);

        expect(stdoutWriteSpy).toHaveBeenCalledExactlyOnceWith("    This is a message");
    });

    it("should log a message to stdout when given a message and context", () => {
        expect.assertions(1);

        const rawReporter = new RawReporter();

        rawReporter.setStdout(stdout);
        rawReporter.setStderr(stderr);

        const meta = {
            badge: "info",
            context: [1, 2, 3],
            date: new Date(),
            error: undefined,
            groups: [],
            label: "label",
            message: "This is a message",
            prefix: "prefix",
            repeated: undefined,
            scope: ["scope1", "scope2"],
            suffix: "suffix",
            traceError: undefined,
            type: {
                level: "informational",
                name: "log",
            },
        };

        const stdoutWriteSpy = vi.spyOn(stdout, "write").mockImplementation(() => true);

        rawReporter.log(meta as unknown as ReadonlyMeta<string>);

        expect(stdoutWriteSpy).toHaveBeenCalledExactlyOnceWith("This is a message 1 2 3");
    });

    it("should log a message to stderr when given a message with level 'error'", () => {
        expect.assertions(1);

        const rawReporter = new RawReporter();

        rawReporter.setStdout(stdout);
        rawReporter.setStderr(stderr);

        const meta = {
            badge: "info",
            context: undefined,
            date: new Date(),
            error: undefined,
            groups: [],
            label: "label",
            message: "This is an error message",
            prefix: "prefix",
            repeated: undefined,
            scope: ["scope1", "scope2"],
            suffix: "suffix",
            traceError: undefined,
            type: {
                level: "error",
                name: "log",
            },
        };

        const stderrWriteSpy = vi.spyOn(stderr, "write").mockImplementation(() => true);

        rawReporter.log(meta as unknown as ReadonlyMeta<string>);

        expect(stderrWriteSpy).toHaveBeenCalledExactlyOnceWith("This is an error message");
    });

    it("should log a message to stderr when given a message with level 'trace'", () => {
        expect.assertions(1);

        const rawReporter = new RawReporter();

        rawReporter.setStdout(stdout);
        rawReporter.setStderr(stderr);

        const meta = {
            badge: "info",
            context: undefined,
            date: new Date(),
            error: undefined,
            groups: [],
            label: "label",
            message: "This is a trace message",
            prefix: "prefix",
            repeated: undefined,
            scope: ["scope1", "scope2"],
            suffix: "suffix",
            traceError: undefined,
            type: {
                level: "trace",
                name: "log",
            },
        };

        const stderrWriteSpy = vi.spyOn(stderr, "write").mockImplementation(() => true);

        rawReporter.log(meta as unknown as ReadonlyMeta<string>);

        expect(stderrWriteSpy).toHaveBeenCalledExactlyOnceWith("This is a trace message");
    });

    it("should log a message to stdout when given an empty message", () => {
        expect.assertions(1);

        const rawReporter = new RawReporter();

        rawReporter.setStdout(stdout);
        rawReporter.setStderr(stderr);

        const meta = {
            badge: "info",
            context: undefined,
            date: new Date(),
            error: undefined,
            groups: [],
            label: "label",
            message: "",
            prefix: "prefix",
            repeated: undefined,
            scope: ["scope1", "scope2"],
            suffix: "suffix",
            traceError: undefined,
            type: {
                level: "informational",
                name: "log",
            },
        };

        const stdoutWriteSpy = vi.spyOn(stdout, "write").mockImplementation(() => true);

        rawReporter.log(meta as unknown as ReadonlyMeta<string>);

        expect(stdoutWriteSpy).toHaveBeenCalledExactlyOnceWith("");
    });

    it("should inspect object context values before writing", () => {
        expect.assertions(2);

        const rawReporter = new RawReporter();

        rawReporter.setStdout(stdout);
        rawReporter.setStderr(stderr);

        const meta = {
            badge: "info",
            context: [{ key: "value" }],
            date: new Date(),
            error: undefined,
            groups: [],
            label: "label",
            message: "This is a message",
            prefix: "prefix",
            repeated: undefined,
            scope: ["scope1", "scope2"],
            suffix: "suffix",
            traceError: undefined,
            type: {
                level: "informational",
                name: "log",
            },
        };

        const stdoutWriteSpy = vi.spyOn(stdout, "write").mockImplementation(() => true);

        rawReporter.log(meta as unknown as ReadonlyMeta<string>);

        const written = stdoutWriteSpy.mock.calls[0][0] as string;

        expect(written).toContain("key");
        expect(written).toContain("value");
    });

    it("should omit the message when it is the empty symbol", () => {
        expect.assertions(1);

        const rawReporter = new RawReporter();

        rawReporter.setStdout(stdout);
        rawReporter.setStderr(stderr);

        const meta = {
            badge: "info",
            context: undefined,
            date: new Date(),
            error: undefined,
            groups: [],
            label: "label",
            message: EMPTY_SYMBOL,
            prefix: "prefix",
            repeated: undefined,
            scope: ["scope1", "scope2"],
            suffix: "suffix",
            traceError: undefined,
            type: {
                level: "informational",
                name: "log",
            },
        };

        const stdoutWriteSpy = vi.spyOn(stdout, "write").mockImplementation(() => true);

        rawReporter.log(meta as unknown as ReadonlyMeta<string>);

        expect(stdoutWriteSpy).toHaveBeenCalledExactlyOnceWith("");
    });

    it("should route output through the interactive manager when interactive and the stream is a TTY", () => {
        expect.assertions(2);

        const rawReporter = new RawReporter();
        const update = vi.fn();
        const ttyStream = { isTTY: true, write: vi.fn() } as unknown as NodeJS.WriteStream;

        rawReporter.setStdout(ttyStream);
        rawReporter.setInteractiveManager({ update } as never);
        rawReporter.setIsInteractive(true);

        const meta = {
            badge: "info",
            context: undefined,
            date: new Date(),
            error: undefined,
            groups: [],
            label: "label",
            message: "interactive message",
            prefix: "prefix",
            repeated: undefined,
            scope: ["scope1", "scope2"],
            suffix: "suffix",
            traceError: undefined,
            type: {
                level: "informational",
                name: "log",
            },
        };

        rawReporter.log(meta as unknown as ReadonlyMeta<string>);

        expect(update).toHaveBeenCalledExactlyOnceWith("stdout", ["interactive message"], 0);
        expect(ttyStream.write).not.toHaveBeenCalled();
    });
});
