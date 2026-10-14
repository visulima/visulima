import { describe, expect, it } from "vitest";

import { CronExpressionParser } from "../src";
import { CronDayOfMonth } from "../src/fields";

/**
 * `W`, `LW` and `L-n` in the day of month field, from Quartz:
 * - `15W` is the weekday nearest the 15th that is still in the same month;
 * - `LW` is the last weekday of the month;
 * - `L-3` is three days before the last day of the month.
 *
 * The expected days come from a reference that reads the real calendar with `Date` and shares no code with the engine.
 */
const YEARS = Array.from({ length: 12 }, (_, index) => 2020 + index);

const lastDayOf = (year: number, month: number): number => new Date(Date.UTC(year, month, 0)).getUTCDate();

const isWeekday = (year: number, month: number, day: number): boolean => {
    const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();

    return weekday >= 1 && weekday <= 5;
};

/** The weekday of the month closest to `day`; none when the month is shorter than `day`. */
const nearestWeekday = (year: number, month: number, day: number): number | undefined => {
    const weekdays = Array.from({ length: lastDayOf(year, month) }, (_, index) => index + 1).filter((candidate) => isWeekday(year, month, candidate));

    if (day > lastDayOf(year, month)) {
        return undefined;
    }

    return weekdays.toSorted((a, b) => Math.abs(a - day) - Math.abs(b - day))[0];
};

const lastWeekday = (year: number, month: number): number =>
    Array.from({ length: lastDayOf(year, month) }, (_, index) => index + 1).findLast((candidate) => isWeekday(year, month, candidate)) as number;

/** The `year-month-day` of every run of an expression over the years, in time order. */
const runDays = (expression: string): string[] => {
    const interval = CronExpressionParser.parse(expression, { currentDate: "2019-12-31T00:00:00.000Z", tz: "UTC" });

    return interval
        .take(12 * YEARS.length)
        .map((run) => run.toISOString().slice(0, 10))
        .filter((day) => Number(day.slice(0, 4)) <= (YEARS.at(-1) as number));
};

const expectedDays = (pick: (year: number, month: number) => number | undefined): string[] =>
    YEARS.flatMap((year) =>
        Array.from({ length: 12 }, (_, index) => index + 1).flatMap((month) => {
            const day = pick(year, month);

            return day === undefined || day < 1 ? [] : [`${String(year)}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`];
        }),
    );

describe("the nearest weekday, nW", () => {
    it.each(Array.from({ length: 31 }, (_, index) => index + 1))("%iW matches the reference in every month of 12 years", (day) => {
        expect.assertions(1);

        expect(runDays(`0 0 ${String(day)}W * *`)).toStrictEqual(expectedDays((year, month) => nearestWeekday(year, month, day)));
    });

    it.each([
        // The 15th of 2026: Jan is a Thursday, Feb a Sunday, Mar a Sunday, Aug a Saturday.
        ["0 0 15W * *", ["2026-01-15", "2026-02-16", "2026-03-16", "2026-04-15", "2026-05-15", "2026-06-15", "2026-07-15", "2026-08-14"]],
        // The 1st of Aug 2026 is a Saturday: the Friday before is in July, so it is Monday the 3rd.
        ["0 0 1W 8 *", ["2026-08-03"]],
        // The 31st of Jan 2026 is a Saturday, so Friday the 30th; of Mar a Tuesday; of Aug a Monday.
        ["0 0 31W 1,3,8 *", ["2026-01-30", "2026-03-31", "2026-08-31"]],
        // The last day, Sunday 29 Mar 2026 is not the last day, but 30 Aug 2026 ends on Monday; Nov 2026 ends on Monday the 30th.
        ["0 0 30W 11 *", ["2026-11-30"]],
    ])("%s runs on %j in 2026", (expression, expected) => {
        expect.assertions(1);

        expect(
            runDays(expression)
                .filter((day) => day.startsWith("2026"))
                .slice(0, expected.length),
        ).toStrictEqual(expected);
    });

    it("never leaves the month: the Sunday that is the last day goes back to the Friday", () => {
        expect.assertions(1);

        // 31 May 2026 is a Sunday, the last day of May: the nearest weekday inside May is Friday the 29th.
        expect(runDays("0 0 31W 5 *").filter((day) => day.startsWith("2026"))).toStrictEqual(["2026-05-29"]);
    });

    it("skips a month that is shorter than the day", () => {
        expect.assertions(1);

        expect(
            runDays("0 0 31W * *")
                .filter((day) => day.startsWith("2026"))
                .map((day) => day.slice(5, 7)),
        ).toStrictEqual(["01", "03", "05", "07", "08", "10", "12"]);
    });
});

describe("the last weekday, LW", () => {
    it("matches the reference in every month of 12 years", () => {
        expect.assertions(1);

        expect(runDays("0 0 LW * *")).toStrictEqual(expectedDays((year, month) => lastWeekday(year, month)));
    });

    it.each([
        ["2026-01-30", "the 31st is a Saturday"],
        ["2026-02-27", "the 28th is a Saturday"],
        ["2026-03-31", "the 31st is a Tuesday"],
        ["2026-05-29", "the 31st is a Sunday"],
    ])("includes %s: %s", (day) => {
        expect.assertions(1);

        expect(runDays("0 0 LW * *")).toContain(day);
    });
});

describe("days before the last day, L-n", () => {
    it.each(Array.from({ length: 30 }, (_, index) => index + 1))("l-%i matches the reference in every month of 12 years", (offset) => {
        expect.assertions(1);

        expect(runDays(`0 0 L-${String(offset)} * *`)).toStrictEqual(expectedDays((year, month) => lastDayOf(year, month) - offset));
    });

    it("runs three days before the end of every month, as asked for with six fields", () => {
        expect.assertions(1);

        const interval = CronExpressionParser.parse("0 0 0 L-3 * *", { currentDate: "2026-01-01T00:00:00.000Z", tz: "UTC" });

        expect(interval.take(4).map((run) => run.toISOString().slice(0, 10))).toStrictEqual(["2026-01-28", "2026-02-25", "2026-03-28", "2026-04-27"]);
    });
});

describe("in a list and with the other fields", () => {
    it("takes numbers, ranges and the new forms together", () => {
        expect.assertions(1);

        const interval = CronExpressionParser.parse("0 0 1,10-12,15W,LW,L-3,L * *", { currentDate: "2026-01-31T12:00:00.000Z", tz: "UTC" });
        const february = interval
            .take(12)
            .map((run) => run.toISOString().slice(8, 10))
            .slice(0, 8);

        // 1, 10, 11, 12, 16 (15W: Sunday goes to Monday), 25 (L-3), 27 (LW: the 28th is a Saturday), 28 (L).
        expect(february).toStrictEqual(["01", "10", "11", "12", "16", "25", "27", "28"]);
    });

    it("combines with a day of week by OR, as a plain day of month does", () => {
        expect.assertions(1);

        // The last weekday of February 2026 is Friday the 27th, and every Monday is a run too.
        const interval = CronExpressionParser.parse("0 0 LW 2 1", { currentDate: "2026-02-01T00:00:00.000Z", tz: "UTC" });

        expect(interval.take(6).map((run) => run.toISOString().slice(0, 10))).toStrictEqual([
            "2026-02-02",
            "2026-02-09",
            "2026-02-16",
            "2026-02-23",
            "2026-02-27",
            "2027-02-01",
        ]);
    });

    it("works going backwards and for includesDate()", () => {
        expect.assertions(3);

        const interval = CronExpressionParser.parse("0 0 15W * *", { currentDate: "2026-03-01T00:00:00.000Z", tz: "UTC" });

        expect(interval.prev().toISOString()).toBe("2026-02-16T00:00:00.000Z");
        expect(interval.includesDate(new Date("2026-03-16T00:00:00.000Z"))).toBe(true);
        expect(interval.includesDate(new Date("2026-03-15T00:00:00.000Z"))).toBe(false);
    });
});

describe("writing an expression back", () => {
    it.each([
        ["0 0 15W * *", "0 0 15W * *"],
        ["0 0 LW * *", "0 0 LW * *"],
        ["0 0 L-3 * *", "0 0 L-3 * *"],
        ["0 0 05W * *", "0 0 5W * *"],
        ["0 0 1,15W,LW * *", "0 0 1,15W,LW * *"],
        ["0 0 L,L-2 * *", "0 0 L,L-2 * *"],
    ])("%s is written as %s", (expression, expected) => {
        expect.assertions(1);

        expect(CronExpressionParser.parse(expression).stringify()).toBe(expected);
    });

    it("reads back to the same schedule", () => {
        expect.assertions(1);

        const written = CronExpressionParser.parse("0 0 1,15W,LW,L-3 * *").stringify();
        const options = { currentDate: "2026-01-01T00:00:00.000Z", tz: "UTC" };

        expect(CronExpressionParser.parse(written, options).take(20)).toStrictEqual(CronExpressionParser.parse("0 0 1,15W,LW,L-3 * *", options).take(20));
    });
});

describe("what is not accepted", () => {
    it.each([
        ["0 0 0W * *", "expected a day from 1-31 before the W"],
        ["0 0 32W * *", "expected a day from 1-31 before the W"],
        ["0 0 L-0 * *", "expected an offset of 1-30 days from the last day"],
        ["0 0 L-31 * *", "expected an offset of 1-30 days from the last day"],
        ["0 0 W * *", "expected W only after a day"],
        ["0 0 15WW * *", "expected W only after a day"],
        ["0 0 1-5W * *", "expected W only after a day"],
        ["0 0 5W-7 * *", "expected W only after a day"],
        ["0 0 15W/2 * *", "expected W only after a day"],
        ["0 0 */2W * *", "expected W only after a day"],
        ["0 W * * *", "Invalid characters"],
        ["0 0 * * 5W", "Invalid characters"],
        ["0 0 * W *", "Invalid characters"],
    ])("rejects %s", (expression, message) => {
        expect.assertions(1);

        expect(() => CronExpressionParser.parse(expression)).toThrow(message);
    });

    it("rejects them on a field built by hand", () => {
        expect.assertions(4);

        expect(() => new CronDayOfMonth(["15W", "L-3", "LW"])).not.toThrow();
        expect(() => new CronDayOfMonth(["40W"])).toThrow("Validation error");
        expect(() => new CronDayOfMonth(["L-31"])).toThrow("Validation error");
        expect(() => new CronDayOfMonth(["W" as never])).toThrow("Validation error");
    });
});
