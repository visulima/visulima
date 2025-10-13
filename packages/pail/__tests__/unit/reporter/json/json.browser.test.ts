import { describe, expect, it, vi } from "vitest";

import JsonReporter from "../../../../src/reporter/json/json.browser";
import type { ReadonlyMeta } from "../../../../src/types";

const baseMeta = {
    badge: "informational",
    context: [],
    date: new Date(),
    error: undefined,
    groups: ["group1"],
    message: "Test message",
    prefix: undefined,
    scope: ["scope1"],
    suffix: undefined,
    traceError: undefined,
};

describe("jsonReporter browser", () => {
    it("should correctly format meta data and call _log when log is called", () => {
        expect.assertions(1);

        const reporter = new JsonReporter();
        const meta = { ...baseMeta, label: " test ", type: { level: "informational", name: "test" } };
        const stringifyMock = vi.fn().mockReturnValue(JSON.stringify(meta));

        reporter.setStringify(stringifyMock);

        const logSpy = vi.spyOn(reporter, "_log" as any).mockImplementation(() => true);

        reporter.log(meta as unknown as ReadonlyMeta<string>);

        expect(logSpy).toHaveBeenCalledExactlyOnceWith(
            `{"badge":"informational","context":[],"date":"${
                meta.date.toISOString()
            }","groups":["group1"],"message":"Test message","scope":["scope1"],"label":" test ","type":{"level":"informational","name":"test"}}`,
            "informational",
        );
    });

    it("should correctly set the stringify function when setStringify is called", () => {
        expect.assertions(1);

        const reporter = new JsonReporter();
        const stringifyFunction = vi.fn();

        reporter.setStringify(stringifyFunction);

        // @ts-expect-error - just for testing
        expect(reporter.stringify).toBe(stringifyFunction);
    });

    it("should trim label if present when log is called", () => {
        expect.assertions(1);

        const reporter = new JsonReporter();
        const meta = { ...baseMeta, label: " test ", type: { level: "informational", name: "test" } };
        const stringifyMock = vi.fn().mockReturnValue(JSON.stringify(meta));

        reporter.setStringify(stringifyMock);
        reporter.log(meta as unknown as ReadonlyMeta<string>);

        expect(stringifyMock).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ label: "test" }));
    });

    it("should format file property correctly if present when log is called", () => {
        expect.assertions(1);

        const reporter = new JsonReporter();
        const meta = { ...baseMeta, file: { column: 5, line: 10, name: "test.js" }, label: "test", type: { level: "informational", name: "test" } };
        const stringifyMock = vi.fn().mockReturnValue(JSON.stringify(meta));

        reporter.setStringify(stringifyMock);
        reporter.log(meta as unknown as ReadonlyMeta<string>);

        expect(stringifyMock).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ file: "test.js:10:5" }));
    });

    it("should handle meta without file property when log is called", () => {
        expect.assertions(1);

        const reporter = new JsonReporter();
        const meta = { ...baseMeta, label: "test", type: { level: "informational", name: "test" } };
        const stringifyMock = vi.fn().mockReturnValue(JSON.stringify(meta));

        reporter.setStringify(stringifyMock);
        reporter.log(meta as unknown as ReadonlyMeta<string>);

        expect(stringifyMock).toHaveBeenCalledExactlyOnceWith(expect.not.objectContaining({ file: expect.anything() }));
    });

    it("should handle meta without label property when log is called", () => {
        expect.assertions(1);

        const reporter = new JsonReporter();
        const meta = { ...baseMeta, label: undefined, type: { level: "informational", name: "test" } };
        const stringifyMock = vi.fn().mockReturnValue(JSON.stringify(meta));

        reporter.setStringify(stringifyMock);
        reporter.log(meta as unknown as ReadonlyMeta<string>);

        expect(stringifyMock).toHaveBeenCalledExactlyOnceWith(expect.not.objectContaining({ label: expect.anything() }));
    });

    it("should handle meta with empty label when log is called", () => {
        expect.assertions(1);

        const reporter = new JsonReporter();
        const meta = { ...baseMeta, label: "", type: { level: "informational", name: "test" } };
        const stringifyMock = vi.fn().mockReturnValue(JSON.stringify(meta));

        reporter.setStringify(stringifyMock);
        reporter.log(meta as unknown as ReadonlyMeta<string>);

        expect(stringifyMock).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ label: "" }));
    });
});
