/* eslint-disable vitest/prefer-expect-assertions, vitest/prefer-strict-equal -- ported from the reference implementation's suite; kept close to the original for easy comparison */
import { beforeEach, describe, expect, it } from "vitest";

import CronExpressionParser from "../src";
import type { CronExpressionOptions } from "../src/cron-expression";
import { CronExpression, LOOPS_LIMIT_EXCEEDED_ERROR_MESSAGE, TIME_SPAN_OUT_OF_BOUNDS_ERROR_MESSAGE } from "../src/cron-expression";
import type { CronFields } from "../src/cron-field-collection";
import { CronFieldCollection } from "../src/cron-field-collection";
import { CronDayOfMonth, CronDayOfWeek, CronHour, CronMinute, CronMonth, CronSecond } from "../src/fields/index";

describe(CronExpression, () => {
    let fields: CronFieldCollection;
    let options: CronExpressionOptions;

    beforeEach(() => {
        fields = new CronFieldCollection({
            dayOfMonth: new CronDayOfMonth([1]),
            dayOfWeek: new CronDayOfWeek([0, 7]),
            hour: new CronHour([0]),
            minute: new CronMinute([0]),
            month: new CronMonth([1]),
            second: new CronSecond([0]),
        });
        options = {
            currentDate: new Date("2023-01-01T00:00:00Z"),
        };
    });

    it("should create a new CronExpression instance", () => {
        const cronExpression = new CronExpression(fields, options);

        expect(cronExpression).toBeInstanceOf(CronExpression);
    });

    it("should return the next scheduled date", () => {
        const cronExpression = new CronExpression(fields, options);
        const nextDate = cronExpression.next();

        expect(nextDate.toISOString()).toBe("2023-01-08T00:00:00.000Z");
    });

    it("should return the previous scheduled date", () => {
        const cronExpression = new CronExpression(fields, options);
        const previousDate = cronExpression.prev();

        expect(previousDate.toISOString()).toBe("2022-01-30T00:00:00.000Z");
    });

    it("should return true if there is a next scheduled date within bounds", () => {
        const cronExpression = new CronExpression(fields, options);

        expect(cronExpression.hasNext()).toBe(true);
    });

    it("should return false if there is no next scheduled date within bounds", () => {
        const cronExpression = new CronExpression(fields, {
            ...options,
            endDate: new Date("2023-01-02T00:00:00Z"),
        });

        expect(cronExpression.hasNext()).toBe(false);
    });

    it("should check if there is a previous scheduled date", () => {
        const cronExpression = new CronExpression(fields, options);

        expect(cronExpression.hasPrev()).toBe(true);
    });

    it("should take a specified number of steps forward", () => {
        const cronExpression = new CronExpression(fields, options);
        const dates = cronExpression.take(3);

        expect(dates).toHaveLength(3);
    });

    it("should take a specified number of steps backward", () => {
        const cronExpression = new CronExpression(fields, options);
        const dates = cronExpression.take(-3);

        expect(dates).toHaveLength(3);
    });

    it("should reset the current date to a new date", () => {
        const cronExpression = new CronExpression(fields, options);
        const newDate = new Date("2023-01-01T00:00:00Z");

        let nextDate = cronExpression.next().toISOString();

        expect(nextDate).toBe("2023-01-08T00:00:00.000Z");

        cronExpression.reset(newDate);
        nextDate = cronExpression.next().toISOString();

        expect(nextDate).toBe("2023-01-08T00:00:00.000Z");
    });

    it("should preserve timezone after reset (issue #406)", () => {
        // Regression test: reset() was silently dropping the tz from parse() options,
        // causing subsequent next()/prev() to evaluate cron fields in the host's
        // system local timezone instead of the originally-configured one.
        const cron = "0 9,12,15,18 * * 1-5";
        const tz = "Australia/Melbourne";

        const schedule = CronExpressionParser.parse(cron, { currentDate: "2026-05-06T00:00:00.000Z", tz });

        const first = schedule.next().toDate();

        // Melbourne is UTC+10 in May, so 2026-05-06T00:00:00Z = 10:00 Melbourne.
        // Next match is 12:00 Melbourne = 02:00 UTC.
        expect(first.toISOString()).toBe("2026-05-06T02:00:00.000Z");

        schedule.reset(first);
        const second = schedule.next().toDate();

        // After reset, next() should still be anchored in Australia/Melbourne.
        // 15:00 Melbourne = 05:00 UTC.
        expect(second.toISOString()).toBe("2026-05-06T05:00:00.000Z");
    });

    it("should preserve timezone after reset with explicit new date (issue #406)", () => {
        const cron = "0 9,12,15,18 * * 1-5";
        const tz = "America/New_York";

        const schedule = CronExpressionParser.parse(cron, { currentDate: "2026-05-06T00:00:00.000Z", tz });

        // Skip ahead to a specific date (May 7 is Thursday)
        schedule.reset(new Date("2026-05-07T00:00:00.000Z"));
        const next = schedule.next().toDate();

        // Late May NY is UTC-4 (EDT), so 9 AM NY = 13:00 UTC.
        expect(next.toISOString()).toBe("2026-05-07T13:00:00.000Z");
    });

    it("should return the string representation of the cron expression", () => {
        const cronExpression = new CronExpression(fields, options);

        expect(cronExpression.toString()).toBe("0 0 0 1 1 0");
    });

    it("should set milliseconds to 0 on next scheduled date (issue #363)", () => {
        const cronExpression = CronExpressionParser.parse("* * * * *", {
            currentDate: "2020-03-06T10:02:01.002Z",
        });
        const nextDate = cronExpression.next();

        expect(nextDate.toISOString()).toBe("2020-03-06T10:03:00.000Z");
    });

    it("should set milliseconds to 0 on previous scheduled date (issue #363)", () => {
        const cronExpression = CronExpressionParser.parse("* * * * *", {
            currentDate: "2020-03-06T10:02:01.002Z",
        });
        const previousDate = cronExpression.prev();

        expect(previousDate.toISOString()).toBe("2020-03-06T10:02:00.000Z");
    });

    describe("iteration jump flows", () => {
        // Each case starts mid-unit and has to land on the nearest allowed value, rolling the larger unit when none is left.
        it.each([
            ["10,20 * * * * *", "2023-01-01T00:00:12.000Z", 1, "2023-01-01T00:00:20.000Z"],
            ["10,20 * * * * *", "2023-01-01T00:00:18.000Z", -1, "2023-01-01T00:00:10.000Z"],
            ["0 10,20 * * * *", "2023-01-01T00:12:30.000Z", 1, "2023-01-01T00:20:00.000Z"],
            ["0 10 * * * *", "2023-01-01T00:59:30.000Z", 1, "2023-01-01T01:10:00.000Z"],
            ["0 0 9 * * *", "2023-01-01T10:00:00.000Z", 1, "2023-01-02T09:00:00.000Z"],
            ["0 0 5,10 * * *", "2023-01-01T06:00:00.000Z", 1, "2023-01-01T10:00:00.000Z"],
        ] as const)("%s from %s, direction %i, is %s", (expression, currentDate, direction, expected) => {
            const interval = CronExpressionParser.parse(expression, { currentDate: new Date(currentDate), tz: "UTC" });

            expect((direction === 1 ? interval.next() : interval.prev()).toISOString()).toBe(expected);
        });

        it("finds a run decades away without hitting the loop limit", () => {
            // The fifth Wednesday of February: 2040-02-29, then 2068-02-29.
            const interval = CronExpressionParser.parse("0 0 * 2 3#5", { currentDate: new Date("2040-03-01T00:00:00.000Z"), tz: "UTC" });

            expect(interval.next().toISOString()).toBe("2068-02-29T00:00:00.000Z");
            expect(interval.prev().toISOString()).toBe("2040-02-29T00:00:00.000Z");
        });
    });

    describe("iteration exclusivity", () => {
        it("when currentDate is exactly on a schedule, returns the next occurrence", () => {
            const interval = CronExpressionParser.parse("0 0 9 * * *", {
                currentDate: new Date("2023-01-01T09:00:00.000Z"),
            });

            expect(interval.next().toISOString()).toBe("2023-01-02T09:00:00.000Z");
        });

        it("when currentDate is exactly on a schedule, returns the previous occurrence", () => {
            const interval = CronExpressionParser.parse("0 0 9 * * *", {
                currentDate: new Date("2023-01-01T09:00:00.000Z"),
            });

            expect(interval.prev().toISOString()).toBe("2022-12-31T09:00:00.000Z");
        });
    });

    describe("next schedule bounds validation", () => {
        it("should use startDate as currentDate when currentDate is not provided", () => {
            const cronExpression = new CronExpression(fields, {
                startDate: "2022-01-01T00:00:00Z",
            });

            const nextDate = cronExpression.next();

            // startDate is an inclusive bound, so a run exactly on it is returned.
            expect(nextDate.toISOString()).toBe("2022-01-01T00:00:00.000Z");
        });

        it("should clamp currentDate to startDate when currentDate is before startDate", () => {
            const cronExpression = new CronExpression(fields, {
                currentDate: "2021-01-01T00:00:00Z",
                startDate: "2022-01-01T00:00:00Z",
            });

            const nextDate = cronExpression.next();

            expect(nextDate.toISOString()).toBe("2022-01-01T00:00:00.000Z");
        });

        it("should clamp currentDate to endDate when currentDate is after endDate", () => {
            const cronExpression = new CronExpression(fields, {
                currentDate: "2023-01-01T00:00:00Z",
                endDate: "2022-01-01T00:00:00Z",
            });

            const previousDate = cronExpression.prev();

            // endDate is inclusive as well, so the run exactly on it is the closest one back.
            expect(previousDate.toISOString()).toBe("2022-01-01T00:00:00.000Z");
        });

        it("should retain the current date when it is within the bounds", () => {
            const cronExpression = new CronExpression(fields, {
                ...options,
                currentDate: "2023-01-01T00:00:00Z",
                endDate: "2024-01-01T00:00:00Z",
                startDate: "2022-01-01T00:00:00Z",
            });

            expect(() => cronExpression.next()).not.toThrow();
            expect(() => cronExpression.prev()).not.toThrow();
        });

        it("should throw an error if the current date is after end date", () => {
            const cronExpression = new CronExpression(fields, {
                ...options,
                currentDate: "2022-01-01T00:00:00Z",
                endDate: "2022-01-01T00:00:00Z",
            });

            expect(() => cronExpression.next()).toThrow(TIME_SPAN_OUT_OF_BOUNDS_ERROR_MESSAGE);
        });

        it("should throw an error if the current date is before start date", () => {
            const cronExpression = new CronExpression(fields, {
                ...options,
                currentDate: "2022-01-01T00:00:00Z",
                startDate: "2022-01-01T00:00:00Z",
            });

            expect(() => cronExpression.prev()).toThrow(TIME_SPAN_OUT_OF_BOUNDS_ERROR_MESSAGE);
        });

        it("should throw when the previous occurrence would land inside a sub-second start date", () => {
            const cronExpression = CronExpressionParser.parse("* * * * * *", {
                currentDate: new Date("2025-01-01T10:00:05.500Z"),
                startDate: new Date("2025-01-01T10:00:05.200Z"),
                tz: "UTC",
            });

            expect(() => cronExpression.prev()).toThrow(TIME_SPAN_OUT_OF_BOUNDS_ERROR_MESSAGE);
        });

        it("should throw when no occurrence exists within the loop limit", () => {
            // Day 31 restricted to April and June, which only ever have 30 days, so
            // the expression can never match and iteration must not return a bogus date.
            const cronExpression = CronExpressionParser.parse("0 0 0 31 4,6 *", {
                currentDate: "2024-01-01T00:00:00Z",
                tz: "UTC",
            });

            expect(() => cronExpression.next()).toThrow(LOOPS_LIMIT_EXCEEDED_ERROR_MESSAGE);
        });
    });

    it("returns an occurrence on the end date when the current date carries milliseconds", () => {
        const interval = CronExpressionParser.parse("*/1 * * * * *", {
            currentDate: new Date("2025-01-01T00:00:09.151Z"),
            endDate: new Date("2025-01-01T00:00:10.000Z"),
            tz: "UTC",
        });

        expect(interval.next().toISOString()).toBe("2025-01-01T00:00:10.000Z");
    });

    it("keeps interleaved forward and backward iteration anchored to the last result", () => {
        const interval = CronExpressionParser.parse("*/5 * * * *", {
            currentDate: new Date("2025-01-01T12:02:00.000Z"),
            tz: "UTC",
        });

        expect(interval.next().toISOString()).toBe("2025-01-01T12:05:00.000Z");
        expect(interval.next().toISOString()).toBe("2025-01-01T12:10:00.000Z");
        expect(interval.prev().toISOString()).toBe("2025-01-01T12:05:00.000Z");
        expect(interval.next().toISOString()).toBe("2025-01-01T12:10:00.000Z");
    });

    describe("stringify", () => {
        it("stringify cron expression all stars no seconds 0 * * * * *", () => {
            const expected = "0 * * * * *";
            const interval = CronExpressionParser.parse("* * * * *", {});
            let text = interval.stringify(true);

            expect(text).toEqual(expected);

            text = CronExpression.fieldsToExpression(interval.fields).stringify(true);

            expect(text).toEqual(expected);
        });

        it("stringify cron expression all stars no seconds (discard seconds)", () => {
            const expected = "* * * * *";
            const interval = CronExpressionParser.parse("* * * * *", {});
            let text = interval.stringify();

            expect(text).toEqual(expected);

            text = CronExpression.fieldsToExpression(interval.fields).stringify();

            expect(text).toEqual(expected);
        });

        it("stringify cron expression all stars with seconds", () => {
            const expected = "* * * * * *";
            const interval = CronExpressionParser.parse("* * * * * *", {});
            let text = interval.stringify(true);

            expect(text).toEqual(expected);

            text = CronExpression.fieldsToExpression(interval.fields).stringify(true);

            expect(text).toEqual(expected);
        });

        it("stringify cron expression all stars with seconds (discard seconds)", () => {
            const expected = "* * * * *";
            const interval = CronExpressionParser.parse("* * * * * *", {});
            let text = interval.stringify();

            expect(text).toEqual(expected);

            text = CronExpression.fieldsToExpression(interval.fields).stringify();

            expect(text).toEqual(expected);
        });

        it("stringify cron expression", () => {
            const expected = "0 1,2,4-10,20-35/5,57 * * * *";
            const interval = CronExpressionParser.parse("1,2,4-10,20-35/5,57 * * * *", {});
            let text = interval.stringify(true);

            expect(text).toEqual(expected);

            text = CronExpression.fieldsToExpression(interval.fields).stringify(true);

            expect(text).toEqual(expected);
        });

        it("stringify cron expression (discard seconds)", () => {
            const expected = "1,2,4-10,20-35/5,57 * * * *";
            const interval = CronExpressionParser.parse("1,2,4-10,20-35/5,57 * * * *", {});
            let text = interval.stringify();

            expect(text).toEqual(expected);

            text = CronExpression.fieldsToExpression(interval.fields).stringify();

            expect(text).toEqual(expected);
        });

        it("stringify cron expression with star range step", () => {
            const expected = "0 */5 */2 1-31 * *";
            const interval = CronExpressionParser.parse("*/5 */2 */1 * *", {});
            let text = interval.stringify(true);

            expect(text).toEqual(expected);

            text = CronExpression.fieldsToExpression(interval.fields).stringify(true);

            expect(text).toEqual(expected);
        });

        it("stringify cron expression with multiple values and retain original value", () => {
            const expected = "0 * * * * 1,3,5";
            const interval = CronExpressionParser.parse("* * * * 1,3,5", {});
            let text = interval.stringify(true);

            expect(text).toEqual(expected);

            text = CronExpression.fieldsToExpression(interval.fields).stringify(true);

            expect(text).toEqual(expected);
        });

        it("correctly stringify cron expression * * * * 0,2,4 and convert value to range step", () => {
            const expected = "0 * * * * 0-4/2";
            const interval = CronExpressionParser.parse("* * * * 0,2,4", {});
            let text = interval.stringify(true);

            expect(text).toEqual(expected);

            text = CronExpression.fieldsToExpression(interval.fields).stringify(true);

            expect(text).toEqual(expected);
        });

        it("correctly stringify cron expression * * * * 0,2,4,6 convert value to */2 step", () => {
            const expected = "0 * * * * */2";
            const interval = CronExpressionParser.parse("* * * * 0,2,4,6", {});
            let text = interval.stringify(true);

            expect(text).toEqual(expected);

            text = CronExpression.fieldsToExpression(interval.fields).stringify(true);

            expect(text).toEqual(expected);
        });

        it("correctly stringify cron expression * * * * */2", () => {
            const expected = "0 * * * * */2";
            const interval = CronExpressionParser.parse("* * * * */2", {});
            let text = interval.stringify(true);

            expect(text).toEqual(expected);

            text = CronExpression.fieldsToExpression(interval.fields).stringify(true);

            expect(text).toEqual(expected);
        });

        it("stringify cron expression with star range step (discard seconds)", () => {
            const expected = "*/5 */2 1-31 * *";
            const interval = CronExpressionParser.parse("*/5 */2 */1 * *", {});
            let text = interval.stringify();

            expect(text).toEqual(expected);

            text = CronExpression.fieldsToExpression(interval.fields).stringify();

            expect(text).toEqual(expected);
        });

        it("stringify cron expression with semi range step", () => {
            const expected = "0 5-55/5 * * * *";
            const interval = CronExpressionParser.parse("5/5 * * * *", {});
            let text = interval.stringify(true);

            expect(text).toEqual(expected);

            text = CronExpression.fieldsToExpression(interval.fields).stringify(true);

            expect(text).toEqual(expected);
        });

        it("stringify cron expression with semi range step (discard seconds)", () => {
            const expected = "5-55/5 * * * *";
            const interval = CronExpressionParser.parse("5/5 * * * *", {});
            let text = interval.stringify();

            expect(text).toEqual(expected);

            text = CronExpression.fieldsToExpression(interval.fields).stringify();

            expect(text).toEqual(expected);
        });

        // https://github.com/harrisiirak/cron-parser/issues/279
        // A stepped range whose end coincides with `max - step + 1` must keep its
        // explicit range bounds. Emitting the bare `start/step` shorthand produces a
        // non-standard expression (crontab(5) only allows `*/step` or `first-last/step`)
        // that other parsers reject when `start` is not the field minimum.
        it("stringify keeps explicit range bounds for stepped ranges not starting at min", () => {
            // All inputs are five-field expressions, so `stringify()` (no seconds) is used.
            const cases: [string, string][] = [
                ["0 6-18/6 * * *", "0 6-18/6 * * *"], // hours 6,12,18 (end === max - step + 1)
                ["0 3,6,9,12,15,18,21 * * *", "0 3-21/3 * * *"], // produced invalid "3/3" before
                ["0 0 2/2 * *", "0 0 2-30/2 * *"], // day-of-month 2,4,...,30
            ];

            for (const [input, expected] of cases) {
                const stringified = CronExpressionParser.parse(input).stringify();

                expect(stringified).toEqual(expected);
                // Re-parsing the output and stringifying again must be stable (round-trips
                // to the same expression), proving no value information was lost.
                expect(CronExpressionParser.parse(stringified).stringify()).toEqual(expected);
            }
        });

        it("stringify cron expression with L", () => {
            const expected = "0 * * 1,4-10,L * *";
            const interval = CronExpressionParser.parse("* * 1,4-10,L * *", {});
            let text = interval.stringify(true);

            expect(text).toEqual(expected);

            text = CronExpression.fieldsToExpression(interval.fields).stringify(true);

            expect(text).toEqual(expected);
        });

        it("stringify cron expression with L (discard seconds)", () => {
            const expected = "* * 1,4-10,L * *";
            const interval = CronExpressionParser.parse("* * 1,4-10,L * *", {});
            let text = interval.stringify();

            expect(text).toEqual(expected);

            text = CronExpression.fieldsToExpression(interval.fields).stringify();

            expect(text).toEqual(expected);
        });

        it("stringify cron expression with weekday L", () => {
            const expected = "0 0 0 * * 1L";
            const interval = CronExpressionParser.parse(expected, {});
            let text = interval.stringify(true);

            expect(text).toEqual(expected);

            text = CronExpression.fieldsToExpression(interval.fields).stringify(true);

            expect(text).toEqual(expected);
        });

        it("stringify cron expression with multiple weekday, one of them with an L", () => {
            const expected = "0 0 0 * * 4,6L";
            const interval = CronExpressionParser.parse(expected, {});
            let text = interval.stringify(true);

            expect(text).toEqual(expected);

            text = CronExpression.fieldsToExpression(interval.fields).stringify(true);

            expect(text).toEqual(expected);
        });

        it("stringify cron expression with multiple weekday, two of them with an L", () => {
            const expected = "0 0 0 * * 1L,5L";
            const interval = CronExpressionParser.parse(expected, {});
            let text = interval.stringify(true);

            expect(text).toEqual(expected);

            text = CronExpression.fieldsToExpression(interval.fields).stringify(true);

            expect(text).toEqual(expected);
        });

        it("stringify cron expression with day of week #", () => {
            const expressions: string[] = [];

            for (let week = 1; week <= 5; week += 1) {
                for (let day = 0; day <= 6; day += 1) {
                    expressions.push(`* * * * * ${String(day)}#${String(week)}`);
                }
            }

            for (const expression of expressions) {
                const interval = CronExpressionParser.parse(expression, {});
                const text = interval.stringify(true);

                expect(text).toEqual(expression);
            }
        });

        it("stringify cron expression with ?", () => {
            const expected = "? ? * * ?";
            const interval = CronExpressionParser.parse(expected, {});
            const text = interval.stringify();

            expect(text).toEqual(expected);
        });

        it("stringify cron expression with wildcard day of month and single month value", () => {
            const expected = "* * * 4 *";
            const interval = CronExpressionParser.parse(expected, {});
            const text = interval.stringify();

            expect(text).toEqual(expected);
        });

        it("stringify cron expression with wildcard day of month and month range", () => {
            const expected = "* * * 4-6 *";
            const interval = CronExpressionParser.parse(expected, {});
            const text = interval.stringify();

            expect(text).toEqual(expected);
        });

        it("stringify cron expression with day of month range and single month value", () => {
            const expected = "* * 1-25 4 *";
            const interval = CronExpressionParser.parse(expected, {});
            const text = interval.stringify();

            expect(text).toEqual(expected);
        });

        it("stringify from fields out of order", () => {
            const expected = "1-5 1 1 1 1 1";
            const text = CronExpression.fieldsToExpression(
                new CronFieldCollection({
                    dayOfMonth: new CronDayOfMonth([1]),
                    dayOfWeek: new CronDayOfWeek([1]),
                    hour: new CronHour([1]),
                    minute: new CronMinute([1]),
                    month: new CronMonth([1]),
                    second: new CronSecond([5, 2, 1, 4, 3]),
                }),
            ).stringify(true);

            expect(text).toEqual(expected);
        });

        it("stringify from fields out of order (discard seconds)", () => {
            const expected = "1 1 1 1 1";
            const text = CronExpression.fieldsToExpression(
                new CronFieldCollection({
                    dayOfMonth: new CronDayOfMonth([1]),
                    dayOfWeek: new CronDayOfWeek([1]),
                    hour: new CronHour([1]),
                    minute: new CronMinute([1]),
                    month: new CronMonth([1]),
                    second: new CronSecond([5, 2, 1, 4, 3]),
                }),
            ).stringify();

            expect(text).toEqual(expected);
        });

        it("stringify cron expression with extended day of week range (0,7)", () => {
            const interval = CronExpressionParser.parse("* * * * *");

            let text = CronExpression.fieldsToExpression(
                new CronFieldCollection({
                    dayOfMonth: interval.fields.dayOfMonth,
                    dayOfWeek: new CronDayOfWeek([0, 1, 2, 3, 4, 5, 6]),
                    hour: interval.fields.hour,
                    minute: interval.fields.minute,
                    month: interval.fields.month,
                    second: interval.fields.second,
                }),
            ).stringify();

            expect(text).toBe("* * * * 0-6");

            text = CronExpression.fieldsToExpression(
                new CronFieldCollection({
                    dayOfMonth: interval.fields.dayOfMonth,
                    dayOfWeek: new CronDayOfWeek([0, 1, 2, 3, 4, 5, 6, 7]),
                    hour: interval.fields.hour,
                    minute: interval.fields.minute,
                    month: interval.fields.month,
                    second: interval.fields.second,
                }),
            ).stringify();

            expect(text).toBe("* * * * *");
        });

        it("stringify day of week that covers the whole week without collapsing it", () => {
            expect(CronExpressionParser.parse("0 0 16 * 0-6").stringify()).toBe("0 0 16 * 0-6");
            expect(CronExpressionParser.parse("0 0 16 * 0-7").stringify()).toBe("0 0 16 * 0-6");
            expect(CronExpressionParser.parse("0 0 16 * */1").stringify()).toBe("0 0 16 * 0-6");
        });

        it("stringify day of month that covers the whole month without collapsing it", () => {
            expect(CronExpressionParser.parse("0 0 1-31 * 5").stringify()).toBe("0 0 1-31 * 5");
        });

        it("stringify day field written as a wildcard collapses it", () => {
            expect(CronExpressionParser.parse("0 0 16 * *").stringify()).toBe("0 0 16 * *");
            expect(CronExpressionParser.parse("0 0 * * 5").stringify()).toBe("0 0 * * 5");
        });

        it("stringify question mark day of week is unchanged", () => {
            expect(CronExpressionParser.parse("0 0 16 * ?").stringify()).toBe("0 0 16 * ?");
        });

        it("parsing an expression from its own rendered form keeps the schedule", () => {
            const roundTripOptions = { currentDate: new Date("2026-01-01T00:00:00Z"), tz: "UTC" };
            const expression = CronExpressionParser.parse("0 0 16 * 0-6", roundTripOptions);
            const reparsed = CronExpressionParser.parse(expression.stringify(), roundTripOptions);

            expect(reparsed.take(5).map((date) => date.toISOString())).toEqual(expression.take(5).map((date) => date.toISOString()));
        });

        it("throw validation error - missing field (seconds)", () => {
            const input = <CronFields>{
                dayOfMonth: new CronDayOfMonth([1]),
                dayOfWeek: new CronDayOfWeek([1]),
                hour: new CronHour([1]),
                minute: new CronMinute([1]),
                month: new CronMonth([1]),
            };

            expect(() => CronExpression.fieldsToExpression(new CronFieldCollection(input))).toThrow("Validation error, Field second is missing");
        });
    });

    describe("includesDate", () => {
        it("should check if the cron expression includes a given date", () => {
            const cronExpression = new CronExpression(fields, options);

            expect(cronExpression.includesDate(new Date("2023-01-01T00:00:00.000Z"))).toBe(true);
            expect(cronExpression.includesDate(new Date("2024-01-01T00:00:00.000Z"))).toBe(true);
            expect(cronExpression.includesDate(new Date("2024-02-01T00:00:00.000Z"))).toBe(false);
        });

        it("should support last weekday of month", () => {
            const cronExpression = CronExpressionParser.parse("0 0 0 * * 1L", {
                currentDate: new Date("2023-01-01T00:00:00Z"),
            });

            expect(cronExpression.includesDate(new Date("2023-01-30T00:00:00Z"))).toBe(true);
            expect(cronExpression.includesDate(new Date("2023-01-23T00:00:00Z"))).toBe(false);
            expect(cronExpression.includesDate(new Date("2023-01-31T00:00:00Z"))).toBe(false);
        });

        it("should support nth day of week", () => {
            const cronExpression = CronExpressionParser.parse("0 0 0 * * 1#3", {
                currentDate: new Date("2023-01-01T00:00:00Z"),
            });

            expect(cronExpression.includesDate(new Date("2023-01-02T00:00:00Z"))).toBe(false);
            expect(cronExpression.includesDate(new Date("2023-01-09T00:00:00Z"))).toBe(false);
            expect(cronExpression.includesDate(new Date("2023-01-16T00:00:00Z"))).toBe(true);
            expect(cronExpression.includesDate(new Date("2023-01-23T00:00:00Z"))).toBe(false);
        });

        it("honors day of month when combined with an nth day of week", () => {
            // Day of month 8 OR the 3rd Friday of the month.
            const cronExpression = CronExpressionParser.parse("0 0 0 8 * 5#3", { tz: "UTC" });

            expect(cronExpression.includesDate(new Date("2024-01-08T00:00:00.000Z"))).toBe(true);
            expect(cronExpression.includesDate(new Date("2024-01-19T00:00:00.000Z"))).toBe(true);
            expect(cronExpression.includesDate(new Date("2024-01-12T00:00:00.000Z"))).toBe(false);
        });
    });

    describe("clock change handling - Europe/Rome (spring forward)", () => {
        const baseOptions = {
            currentDate: new Date("2025-03-29T00:00:00Z"),
            endDate: new Date("2025-03-31T00:00:00Z"),
            tz: "Europe/Rome",
        };

        const createInterval = (pattern: string) =>
            CronExpressionParser.parse(pattern, {
                ...baseOptions,
                currentDate: new Date(baseOptions.currentDate.getTime() - 1000),
            });

        it("should handle DST gap (02:30 does not exist)", () => {
            const interval = createInterval("30 2 * * 7");

            expect(interval.hasNext()).toBe(true);

            const next = interval.next().toDate();

            expect(next.toISOString()).toBe("2025-03-30T01:30:00.000Z");
            expect(interval.hasNext()).toBe(false);
        });

        it("should return valid occurrence after DST gap (03:00)", () => {
            const interval = createInterval("0 3 * * 7");

            expect(interval.hasNext()).toBe(true);

            const next = interval.next().toDate();

            expect(next.toISOString()).toBe("2025-03-30T01:00:00.000Z");
        });

        it("should return valid occurrence after DST gap (04:00)", () => {
            const interval = createInterval("0 4 * * 7");

            expect(interval.hasNext()).toBe(true);

            const next = interval.next().toDate();

            expect(next.toISOString()).toBe("2025-03-30T02:00:00.000Z");
        });

        it("should return valid occurrence after DST gap (05:00)", () => {
            const interval = createInterval("0 5 * * 7");

            expect(interval.hasNext()).toBe(true);

            const next = interval.next().toDate();

            expect(next.toISOString()).toBe("2025-03-30T03:00:00.000Z");
        });

        it("should not stop iteration after DST boundary", () => {
            const interval = createInterval("0 5 * * 7");
            const results: string[] = [];

            for (let i = 0; i < 2; i += 1) {
                if (interval.hasNext()) {
                    results.push(interval.next().toDate().toISOString());
                }
            }

            expect(results.length).toBeGreaterThan(0);
            expect(results[0]).toBe("2025-03-30T03:00:00.000Z");
        });

        it("should NOT return undefined after DST gap", () => {
            const interval = CronExpressionParser.parse("0 5 * * 7", {
                currentDate: new Date("2025-03-29T00:00:00Z"),
                endDate: new Date("2025-03-31T00:00:00Z"),
                tz: "Europe/Rome",
            });

            expect(interval.hasNext()).toBe(true);

            const next = interval.next();

            expect(next.toISOString()).toBe("2025-03-30T03:00:00.000Z");
        });

        it("iterator should remain stable across DST gap", () => {
            const interval = CronExpressionParser.parse("0 * * * 7", {
                currentDate: new Date("2025-03-29T00:00:00Z"),
                endDate: new Date("2025-03-31T00:00:00Z"),
                tz: "Europe/Rome",
            });
            const results: string[] = [];

            for (let i = 0; i < 10; i += 1) {
                if (!interval.hasNext()) {
                    break;
                }

                results.push(interval.next().toDate().toISOString());
            }

            expect(results).toEqual([
                "2025-03-29T23:00:00.000Z",
                "2025-03-30T00:00:00.000Z",
                "2025-03-30T01:00:00.000Z",
                "2025-03-30T02:00:00.000Z",
                "2025-03-30T03:00:00.000Z",
                "2025-03-30T04:00:00.000Z",
                "2025-03-30T05:00:00.000Z",
                "2025-03-30T06:00:00.000Z",
                "2025-03-30T07:00:00.000Z",
                "2025-03-30T08:00:00.000Z",
            ]);
        });

        it("europe/Rome vs UTC should differ correctly", () => {
            const rome = CronExpressionParser.parse("0 5 * * 7", {
                currentDate: new Date("2025-03-29T00:00:00Z"),
                endDate: new Date("2025-03-31T00:00:00Z"),
                tz: "Europe/Rome",
            });
            const utc = CronExpressionParser.parse("0 5 * * 7", {
                currentDate: new Date("2025-03-29T00:00:00Z"),
                endDate: new Date("2025-03-31T00:00:00Z"),
                tz: "UTC",
            });
            const romeNext = rome.next().toDate();
            const utcNext = utc.next().toDate();

            expect(romeNext.toISOString()).not.toBe(utcNext.toISOString());
        });
    });
});
