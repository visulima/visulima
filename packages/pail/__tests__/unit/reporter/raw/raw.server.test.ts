import { stderr, stdout } from "node:process";

import { describe, expect, it, vi } from "vitest";

import RawReporter from "../../../../src/reporter/raw/raw.server";
import type { ReadonlyMeta } from "../../../../src/types";

describe("raw-reporter", () => {
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
});
