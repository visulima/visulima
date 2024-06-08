import { describe, expect, it, vi } from "vitest";

import RawReporter from "../../../../src/reporter/raw/raw.server";
import type { ReadonlyMeta } from "../../../../src/types";

describe("raw-reporter", () => {
    it("should log a message to stdout when given a message and no context or groups", () => {
        expect.assertions(1);

        const rawReporter = new RawReporter();

        rawReporter.setStdout(process.stdout);
        rawReporter.setStderr(process.stderr);
        rawReporter.setStringify(JSON.stringify);

        const meta: ReadonlyMeta = {
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

        const stdoutWriteSpy = vi.spyOn(process.stdout, "write");

        rawReporter.log(meta);

        expect(stdoutWriteSpy).toHaveBeenCalledWith("This is a message");
    });

    it("should log a message to stdout when given a message, groups and no context", () => {
        expect.assertions(1);

        const rawReporter = new RawReporter();

        rawReporter.setStdout(process.stdout);
        rawReporter.setStderr(process.stderr);
        rawReporter.setStringify(JSON.stringify);

        const meta: ReadonlyMeta = {
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

        const stdoutWriteSpy = vi.spyOn(process.stdout, "write");

        rawReporter.log(meta);

        expect(stdoutWriteSpy).toHaveBeenCalledWith("    This is a message");
    });

    it("should log a message to stdout when given a message and context", () => {
        expect.assertions(1);

        const rawReporter = new RawReporter();

        rawReporter.setStdout(process.stdout);
        rawReporter.setStderr(process.stderr);
        rawReporter.setStringify(JSON.stringify);

        const meta: ReadonlyMeta = {
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

        const stdoutWriteSpy = vi.spyOn(process.stdout, "write");

        rawReporter.log(meta);

        expect(stdoutWriteSpy).toHaveBeenCalledWith("This is a message 1 2 3");
    });

    it("should log a message to stderr when given a message with level 'error'", () => {
        expect.assertions(1);

        const rawReporter = new RawReporter();
        rawReporter.setStdout(process.stdout);
        rawReporter.setStderr(process.stderr);
        rawReporter.setStringify(JSON.stringify);

        const meta: ReadonlyMeta = {
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

        const stderrWriteSpy = vi.spyOn(process.stderr, "write");

        rawReporter.log(meta);

        expect(stderrWriteSpy).toHaveBeenCalledWith("This is an error message");
    });

    it("should log a message to stderr when given a message with level 'trace'", () => {
        expect.assertions(1);

        const rawReporter = new RawReporter();
        rawReporter.setStdout(process.stdout);
        rawReporter.setStderr(process.stderr);
        rawReporter.setStringify(JSON.stringify);

        const meta: ReadonlyMeta = {
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

        const stderrWriteSpy = vi.spyOn(process.stderr, "write");

        rawReporter.log(meta);

        expect(stderrWriteSpy).toHaveBeenCalledWith("This is a trace message");
    });

    it("should log a message to stdout when given an empty message", () => {
        expect.assertions(1);

        const rawReporter = new RawReporter();
        rawReporter.setStdout(process.stdout);
        rawReporter.setStderr(process.stderr);
        rawReporter.setStringify(JSON.stringify);

        const meta: ReadonlyMeta = {
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

        const stdoutWriteSpy = vi.spyOn(process.stdout, "write");

        rawReporter.log(meta);

        expect(stdoutWriteSpy).toHaveBeenCalledWith("");
    });
});
