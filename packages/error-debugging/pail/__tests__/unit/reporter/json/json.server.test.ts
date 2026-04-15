import { describe, expect, it, vi } from "vitest";

import JsonReporter from "../../../../src/reporter/json/json-reporter.server";

const baseMeta = {
    badge: "informational",
    context: [],
    date: new Date(),
    error: undefined,
    file: { column: 1, line: 1, name: "test.js" },
    groups: ["group1"],
    label: "Test Label",
    message: "Test message",
    prefix: undefined,
    scope: ["scope1"],
    suffix: undefined,
    traceError: undefined,
};

describe("jsonReporter server", () => {
    it("should log messages to stdout for non-error levels", () => {
        expect.assertions(1);

        const reporter = new JsonReporter();
        const mockStdout = { write: vi.fn() } as unknown as NodeJS.WriteStream;

        reporter.setStdout(mockStdout);
        reporter.setStringify(JSON.stringify);

        reporter.log({ ...baseMeta, message: "test message", type: { level: "informational", name: "informational" } });

        expect(mockStdout.write).toHaveBeenCalledExactlyOnceWith(expect.stringContaining("test message"));
    });

    it("should log messages to stderr for error levels", () => {
        expect.assertions(1);

        const reporter = new JsonReporter();
        const mockStderr = { write: vi.fn() } as unknown as NodeJS.WriteStream;

        reporter.setStderr(mockStderr);
        reporter.setStringify(JSON.stringify);
        reporter.log({ ...baseMeta, message: "test error", type: { level: "error", name: "informational" } });

        expect(mockStderr.write).toHaveBeenCalledExactlyOnceWith(expect.stringContaining("test error"));
    });

    it("should trim label property in log metadata", () => {
        expect.assertions(1);

        const reporter = new JsonReporter();
        const mockStdout = { write: vi.fn() } as unknown as NodeJS.WriteStream;

        reporter.setStdout(mockStdout);
        reporter.setStringify(JSON.stringify);
        reporter.log({ ...baseMeta, label: "  label  ", message: "test message", type: { level: "informational", name: "informational" } });

        expect(mockStdout.write).toHaveBeenCalledExactlyOnceWith(expect.stringContaining("\"label\":\"label\""));
    });

    it("should handle undefined or null values in log metadata gracefully", () => {
        expect.assertions(1);

        const reporter = new JsonReporter();
        const mockStdout = { write: vi.fn() } as unknown as NodeJS.WriteStream;

        reporter.setStdout(mockStdout);
        reporter.setStringify(JSON.stringify);
        reporter.log({ ...baseMeta, message: null, type: { level: "informational", name: "informational" } });

        expect(mockStdout.write).toHaveBeenCalledExactlyOnceWith(expect.stringContaining("null"));
    });

    it("should handle empty string values in log metadata", () => {
        expect.assertions(1);

        const reporter = new JsonReporter();
        const mockStdout = { write: vi.fn() } as unknown as NodeJS.WriteStream;

        reporter.setStdout(mockStdout);
        reporter.setStringify(JSON.stringify);
        reporter.log({ ...baseMeta, message: "", type: { level: "informational", name: "informational" } });

        expect(mockStdout.write).toHaveBeenCalledExactlyOnceWith(expect.stringContaining("\"\""));
    });

    it("should handle log levels not in ExtendedRfc5424LogLevels", () => {
        expect.assertions(1);

        const reporter = new JsonReporter<"custom">();
        const mockStdout = { write: vi.fn() } as unknown as NodeJS.WriteStream;

        reporter.setStdout(mockStdout);
        reporter.setStringify(JSON.stringify);
        reporter.log({ ...baseMeta, message: "custom level message", type: { level: "custom", name: "custom" } });

        expect(mockStdout.write).toHaveBeenCalledExactlyOnceWith(expect.stringContaining("custom level message"));
    });

    it("should handle missing file property in log metadata", () => {
        expect.assertions(1);

        const reporter = new JsonReporter();
        const mockStdout = { write: vi.fn() } as unknown as NodeJS.WriteStream;

        reporter.setStdout(mockStdout);
        reporter.setStringify(JSON.stringify);
        reporter.log({ ...baseMeta, message: "message without file", type: { level: "informational", name: "informational" } });

        expect(mockStdout.write).toHaveBeenCalledExactlyOnceWith(expect.stringContaining("message without file"));
    });

    it("should handle missing label property in log metadata", () => {
        expect.assertions(1);

        const reporter = new JsonReporter();
        const mockStdout = { write: vi.fn() } as unknown as NodeJS.WriteStream;

        reporter.setStdout(mockStdout);
        reporter.setStringify(JSON.stringify);
        reporter.log({ ...baseMeta, message: "message without label", type: { level: "informational", name: "informational" } });

        expect(mockStdout.write).toHaveBeenCalledExactlyOnceWith(expect.stringContaining("message without label"));
    });
});
