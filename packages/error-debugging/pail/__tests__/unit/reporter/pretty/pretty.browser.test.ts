import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EMPTY_SYMBOL } from "../../../../src/constants";
import PrettyReporter from "../../../../src/reporter/pretty/pretty-reporter.browser";
import type { ReadonlyMeta } from "../../../../src/types";

const date = new Date("2021-09-16T09:16:52.000Z");

const baseMeta = {
    badge: "INFO",
    context: [],
    date,
    error: undefined,
    groups: ["Group1"],
    label: "Label",
    message: "browser message",
    prefix: undefined,
    repeated: undefined,
    scope: ["Scope1", "Scope2"],
    suffix: undefined,
    type: { level: "informational", name: "info" },
};

const badgeLoggerTypes = {
    info: { badge: "★", color: "blueBright", label: "info", logLevel: "informational" },
};

describe("prettyReporter browser", () => {
    let logSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    });

    afterEach(() => {
        logSpy.mockRestore();
        vi.unstubAllGlobals();
    });

    describe("console (%c) output path", () => {
        it("should format a full message with the browser console styling path", () => {
            expect.assertions(1);

            const reporter = new PrettyReporter();
            const meta = {
                ...baseMeta,
                context: [{ requestId: "abc" }],
                prefix: "Prefix",
                suffix: "Suffix",
            };

            reporter.log(meta as unknown as ReadonlyMeta<string>);

            expect(logSpy).toHaveBeenCalledTimes(1);
        });

        it("should render the badge and label placeholders when both are missing", () => {
            expect.assertions(1);

            const reporter = new PrettyReporter();

            reporter.setLoggerTypes(badgeLoggerTypes as never);

            const meta = { ...baseMeta, badge: undefined, label: undefined };

            reporter.log(meta as unknown as ReadonlyMeta<string>);

            expect(logSpy).toHaveBeenCalledTimes(1);
        });

        it("should render the repeated counter alongside the label", () => {
            expect.assertions(1);

            const reporter = new PrettyReporter();
            const meta = { ...baseMeta, repeated: 3 };

            reporter.log(meta as unknown as ReadonlyMeta<string>);

            expect(logSpy).toHaveBeenCalledTimes(1);
        });

        it("should apply bold, underline, and non-uppercase label styles", () => {
            expect.assertions(1);

            const reporter = new PrettyReporter({
                bold: { label: true },
                underline: { label: true, message: false, prefix: false, suffix: false },
                uppercase: { label: false },
            });

            reporter.log(baseMeta as unknown as ReadonlyMeta<string>);

            expect(logSpy).toHaveBeenCalledTimes(1);
        });

        it("should fall back to white for a logger type without a color", () => {
            expect.assertions(1);

            const reporter = new PrettyReporter();

            reporter.setLoggerTypes({ info: { label: "info", logLevel: "informational" } } as never);

            reporter.log(baseMeta as unknown as ReadonlyMeta<string>);

            expect(logSpy).toHaveBeenCalledTimes(1);
        });

        it("should accept a string date and render a prefix without a scope", () => {
            expect.assertions(1);

            const reporter = new PrettyReporter();
            const meta = { ...baseMeta, date: "2021-09-16T09:16:52.000Z", prefix: "Prefix", scope: [] };

            reporter.log(meta as unknown as ReadonlyMeta<string>);

            expect(logSpy).toHaveBeenCalledTimes(1);
        });

        it("should render without a date when none is provided", () => {
            expect.assertions(1);

            const reporter = new PrettyReporter();
            const meta = { ...baseMeta, date: undefined };

            reporter.log(meta as unknown as ReadonlyMeta<string>);

            expect(logSpy).toHaveBeenCalledTimes(1);
        });

        it("should skip the badge placeholder when no logger type defines a badge", () => {
            expect.assertions(1);

            const reporter = new PrettyReporter();

            reporter.setLoggerTypes({ info: { label: "info", logLevel: "informational" } } as never);

            const meta = { ...baseMeta, badge: undefined };

            reporter.log(meta as unknown as ReadonlyMeta<string>);

            expect(logSpy).toHaveBeenCalledTimes(1);
        });

        it("should omit the message when it is the empty symbol", () => {
            expect.assertions(1);

            const reporter = new PrettyReporter();
            const meta = { ...baseMeta, message: EMPTY_SYMBOL };

            reporter.log(meta as unknown as ReadonlyMeta<string>);

            expect(logSpy).toHaveBeenCalledTimes(1);
        });

        it("should render without context when none is provided", () => {
            expect.assertions(1);

            const reporter = new PrettyReporter();
            const meta = { ...baseMeta, context: undefined };

            reporter.log(meta as unknown as ReadonlyMeta<string>);

            expect(logSpy).toHaveBeenCalledTimes(1);
        });
    });

    describe("dom (format) output path", () => {
        beforeEach(() => {
            vi.stubGlobal("window", {});
            vi.stubGlobal("document", {});
        });

        it("should format a full message including groups and an error in the DOM path", () => {
            expect.assertions(1);

            const reporter = new PrettyReporter({ underline: { label: false, message: false, prefix: true, suffix: true } });
            const meta = {
                ...baseMeta,
                context: [{ requestId: "abc" }],
                error: new Error("dom error"),
                prefix: "Prefix",
                suffix: "Suffix",
            };

            reporter.log(meta as unknown as ReadonlyMeta<string>);

            expect(logSpy).toHaveBeenCalledTimes(1);
        });

        it("should render the badge and label placeholders when both are missing in the DOM path", () => {
            expect.assertions(1);

            const reporter = new PrettyReporter();

            reporter.setLoggerTypes(badgeLoggerTypes as never);

            const meta = { ...baseMeta, badge: undefined, label: undefined };

            reporter.log(meta as unknown as ReadonlyMeta<string>);

            expect(logSpy).toHaveBeenCalledTimes(1);
        });

        it("should render the repeated counter in the DOM path", () => {
            expect.assertions(1);

            const reporter = new PrettyReporter();
            const meta = { ...baseMeta, repeated: 3 };

            reporter.log(meta as unknown as ReadonlyMeta<string>);

            expect(logSpy).toHaveBeenCalledTimes(1);
        });
    });
});
