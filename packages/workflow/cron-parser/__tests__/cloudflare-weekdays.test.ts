import { describe, expect, it } from "vitest";

import { CronParseError, parse } from "../src";
import { parse as parseCloudflare } from "../src/cloudflare";

const atStart = { currentDate: "2026-01-15T10:00:00Z", tz: "UTC" } as const;

const weekdaysOf = (expression: string): unknown => parseCloudflare(expression, atStart).fields.dayOfWeek.values;

const codeOf = (expression: string): string => {
    try {
        parseCloudflare(expression, atStart);
    } catch (error) {
        expect(error).toBeInstanceOf(CronParseError);

        return (error as CronParseError).code;
    }

    throw new Error(`Expected ${expression} to throw`);
};

// Cloudflare reads the weekdays 1 (Sunday) to 7 (Saturday); the parser hands them back on this package's 0-6 scale.
describe("the cloudflare weekday scale", () => {
    it("moves each numbered weekday back by one", () => {
        expect.hasAssertions();

        expect(weekdaysOf("0 0 * * 1")).toStrictEqual([0]);
        expect(weekdaysOf("0 0 * * 7")).toStrictEqual([6]);
        expect(weekdaysOf("0 0 * * 2-6")).toStrictEqual([1, 2, 3, 4, 5]);
    });

    it("reads a bare L as Saturday", () => {
        expect.hasAssertions();

        expect(weekdaysOf("0 0 * * L")).toStrictEqual([6]);
    });

    it("keeps steps and wildcards on the same days as before the move", () => {
        expect.hasAssertions();

        expect(weekdaysOf("0 0 * * 1/2")).toStrictEqual([0, 2, 4, 6]);
        expect(weekdaysOf("0 0 * * 1-7/2")).toStrictEqual([0, 2, 4, 6]);
        expect(weekdaysOf("0 0 * * *")).toStrictEqual([0, 1, 2, 3, 4, 5, 6]);
    });

    it("reads the names as Cloudflare does, so MON is the second day", () => {
        expect.hasAssertions();

        expect(weekdaysOf("0 0 * * SUN")).toStrictEqual([0]);
        expect(weekdaysOf("0 0 * * MON-FRI")).toStrictEqual([1, 2, 3, 4, 5]);
    });

    it("rejects a weekday outside 1-7, zero included", () => {
        expect.hasAssertions();

        expect(codeOf("0 0 * * 0")).toBe("FIELD_RANGE");
        expect(codeOf("0 0 * * 8")).toBe("FIELD_RANGE");
        expect(codeOf("0 0 * * 0L")).toBe("FIELD_RANGE");
        expect(codeOf("0 0 * * 8L")).toBe("FIELD_RANGE");
    });

    it("moves the number in front of an L and records the feature", () => {
        expect.hasAssertions();

        const expression = parseCloudflare("0 0 * * 5L", atStart);

        // Cloudflare's 5 is Thursday, which is 4 on this package's scale.
        expect(expression.fields.dayOfWeek.values).toStrictEqual(["4L"]);
        expect([...expression.usedFeatures]).toStrictEqual(["lastDayOfWeek"]);
    });

    it("keeps the Sunday-zero rule off the 1-7 scale, so a range to 7 has no extra Sunday", () => {
        expect.hasAssertions();

        expect(weekdaysOf("0 0 * * 6-7")).toStrictEqual([5, 6]);
    });

    it("leaves the default scale alone", () => {
        expect.hasAssertions();

        expect(parse("0 0 * * 0", atStart).fields.dayOfWeek.values).toStrictEqual([0]);
        expect(parse("0 0 * * 1-7", atStart).fields.dayOfWeek.values).toStrictEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    });
});
