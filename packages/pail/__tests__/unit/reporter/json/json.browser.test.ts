import { describe, expect, it, vi } from "vitest";

import JsonReporter from "../../../../src/reporter/json/json.browser";
import type { Meta } from "../../../../src/types";

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

        const logSpy = vi.spyOn(reporter, "_log" as any);

        reporter.log(meta as Meta<never>);

        expect(logSpy).toHaveBeenCalledWith(
            '{"badge":"informational","context":[],"date":"' +
                meta.date.toISOString() +
                '","groups":["group1"],"message":"Test message","scope":["scope1"],"label":" test ","type":{"level":"informational","name":"test"}}',
            "informational",
        );
    });

    // setStringify method correctly sets the stringify function
    it("should correctly set the stringify function when setStringify is called", () => {
        expect.assertions(1);

        const reporter = new JsonReporter();
        const stringifyFunction = vi.fn();

        reporter.setStringify(stringifyFunction);

        // @ts-expect-error - just for testing
        expect(reporter.stringify).toBe(stringifyFunction);
    });

    // log method trims label if present
    it("should trim label if present when log is called", () => {
        expect.assertions(1);

        const reporter = new JsonReporter();
        const meta = { ...baseMeta, label: " test ", type: { level: "informational", name: "test" } };
        const stringifyMock = vi.fn().mockReturnValue(JSON.stringify(meta));

        reporter.setStringify(stringifyMock);
        reporter.log(meta as Meta<never>);

        expect(stringifyMock).toHaveBeenCalledWith(expect.objectContaining({ label: "test" }));
    });

    // log method formats file property correctly if present
    it("should format file property correctly if present when log is called", () => {
        expect.assertions(1);

        const reporter = new JsonReporter();
        // @ts-expect-error - expected typing
        const meta = { ...baseMeta, file: { column: 5, line: 10, name: "test.js" }, label: "test", type: { level: "informational", name: "test" } };
        const stringifyMock = vi.fn().mockReturnValue(JSON.stringify(meta));

        reporter.setStringify(stringifyMock);
        reporter.log(meta as Meta<never>);

        expect(stringifyMock).toHaveBeenCalledWith(expect.objectContaining({ file: "test.js:10:5" }));
    });

    // log method handles meta without file property
    it("should handle meta without file property when log is called", () => {
        expect.assertions(1);

        const reporter = new JsonReporter();
        const meta = { ...baseMeta, label: "test", type: { level: "informational", name: "test" } };
        const stringifyMock = vi.fn().mockReturnValue(JSON.stringify(meta));

        reporter.setStringify(stringifyMock);
        reporter.log(meta as Meta<never>);

        expect(stringifyMock).toHaveBeenCalledWith(expect.not.objectContaining({ file: expect.anything() }));
    });

    it("should handle meta without label property when log is called", () => {
        expect.assertions(1);

        const reporter = new JsonReporter();
        const meta = { ...baseMeta, label: undefined, type: { level: "informational", name: "test" } };
        const stringifyMock = vi.fn().mockReturnValue(JSON.stringify(meta));

        reporter.setStringify(stringifyMock);
        reporter.log(meta as Meta<never>);

        expect(stringifyMock).toHaveBeenCalledWith(expect.not.objectContaining({ label: expect.anything() }));
    });

    it("should handle meta with empty label when log is called", () => {
        expect.assertions(1);

        const reporter = new JsonReporter();
        const meta = { ...baseMeta, label: "", type: { level: "informational", name: "test" } };
        const stringifyMock = vi.fn().mockReturnValue(JSON.stringify(meta));

        reporter.setStringify(stringifyMock);
        reporter.log(meta as Meta<never>);

        expect(stringifyMock).toHaveBeenCalledWith(expect.objectContaining({ label: "" }));
    });
});
