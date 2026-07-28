import { describe, expect, it } from "vitest";

import resolveWakeAt from "../src/duration";
import WorkflowError from "../src/errors";

describe(resolveWakeAt, () => {
    const base = 1_700_000_000_000;

    it("treats a raw number as relative milliseconds", () => {
        expect.assertions(1);

        expect(resolveWakeAt(5000, base)).toBe(base + 5000);
    });

    it("clamps negative millisecond durations to now", () => {
        expect.assertions(1);

        expect(resolveWakeAt(-100, base)).toBe(base);
    });

    it.each([
        ["milliseconds", 10, 10],
        ["ms", 10, 10],
        ["seconds", 2, 2000],
        ["minutes", 3, 180_000],
        ["hours", 1, 3_600_000],
        ["days", 1, 86_400_000],
        ["weeks", 1, 604_800_000],
    ] as const)("resolves %s units", (unit, amount, ms) => {
        expect.assertions(1);

        expect(resolveWakeAt({ amount, unit }, base)).toBe(base + ms);
    });

    it("resolves a cron expression to the next occurrence after the reference", () => {
        expect.assertions(1);

        const next = resolveWakeAt({ cron: "0 0 * * *" }, base);

        expect(next).toBeGreaterThan(base);
    });

    it("throws for a cron expression with no future occurrence", () => {
        expect.assertions(1);

        // 31st of February never happens.
        expect(() => resolveWakeAt({ cron: "0 0 31 2 *" }, base)).toThrow(WorkflowError);
    });

    it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])("throws for non-finite millisecond duration %s", (value) => {
        expect.assertions(1);

        expect(() => resolveWakeAt(value, base)).toThrow(WorkflowError);
    });

    it("throws for a non-finite structured amount", () => {
        expect.assertions(1);

        expect(() => resolveWakeAt({ amount: Number.NaN, unit: "minutes" }, base)).toThrow(WorkflowError);
    });

    it("throws for an unrecognised structured unit instead of yielding NaN", () => {
        expect.assertions(2);

        // A singular typo (or a loosely-typed JS caller) must fail loudly, not suspend forever with wakeAt = NaN.
        // @ts-expect-error -- intentionally testing an invalid unit reaching this published function from JS
        expect(() => resolveWakeAt({ amount: 5, unit: "minute" }, base)).toThrow(WorkflowError);
        // @ts-expect-error -- intentionally testing an invalid unit reaching this published function from JS
        expect(() => resolveWakeAt({ amount: 5, unit: "minute" }, base)).toThrow("Duration unit");
    });
});
