/* eslint-disable vitest/prefer-expect-assertions, vitest/prefer-strict-equal -- ported from the reference implementation's suite; kept close to the original for easy comparison */
import { beforeEach, describe, expect, it } from "vitest";

import { CronFieldCollection } from "../src/cron-field-collection";
import type { DayOfMonthRange, DayOfWeekRange, HourRange, MonthRange, SixtyRange } from "../src/fields/index";
import { CronDayOfMonth, CronDayOfWeek, CronHour, CronMinute, CronMonth, CronSecond } from "../src/fields/index";

describe(CronFieldCollection, () => {
    describe("getters", () => {
        it("should access fields and assert correct types", () => {
            const cronFields = new CronFieldCollection({
                dayOfMonth: new CronDayOfMonth([15]),
                dayOfWeek: new CronDayOfWeek([1, 2, 3, 4, 5]),
                hour: new CronHour([9]),
                minute: new CronMinute([0, 30]),
                month: new CronMonth([1]),
                second: new CronSecond([0]),
            });

            expect(cronFields.second).toBeInstanceOf(CronSecond);
            expect(cronFields.minute).toBeInstanceOf(CronMinute);
            expect(cronFields.hour).toBeInstanceOf(CronHour);
            expect(cronFields.dayOfMonth).toBeInstanceOf(CronDayOfMonth);
            expect(cronFields.month).toBeInstanceOf(CronMonth);
            expect(cronFields.dayOfWeek).toBeInstanceOf(CronDayOfWeek);
        });
    });

    describe("serialize", () => {
        it("should serialize collection", () => {
            const expected = {
                dayOfMonth: {
                    values: [1, 15],
                    wildcard: false,
                },
                dayOfWeek: {
                    values: [1, 2, 3, 4, 5],
                    wildcard: false,
                },
                hour: {
                    values: [9, 11, 13, 15, 17],
                    wildcard: false,
                },
                minute: {
                    values: [0, 30],
                    wildcard: false,
                },
                month: {
                    values: [1, 3, 5, 7, 9, 11],
                    wildcard: false,
                },
                second: {
                    values: [...Array.from({ length: 60 }).keys()],
                    wildcard: true,
                },
            };
            const cronFields = new CronFieldCollection({
                dayOfMonth: new CronDayOfMonth(<DayOfMonthRange[]>expected.dayOfMonth.values),
                dayOfWeek: new CronDayOfWeek(<DayOfWeekRange[]>expected.dayOfWeek.values),
                hour: new CronHour(<HourRange[]>expected.hour.values),
                minute: new CronMinute(<SixtyRange[]>expected.minute.values),
                month: new CronMonth(<MonthRange[]>expected.month.values),
                second: new CronSecond(<SixtyRange[]>expected.second.values),
            });

            expect(cronFields.stringify()).toBe("0,30 9-17/2 1,15 */2 1-5");
            expect(cronFields.stringify(true)).toBe("* 0,30 9-17/2 1,15 */2 1-5");
            expect(cronFields.serialize()).toEqual(expected);
        });

        it("should serialize fields to an object", () => {
            const cronFields = new CronFieldCollection({
                dayOfMonth: new CronDayOfMonth([15]),
                dayOfWeek: new CronDayOfWeek([1, 2, 3, 4, 5]),
                hour: new CronHour([9]),
                minute: new CronMinute([0, 30]),
                month: new CronMonth([1]),
                second: new CronSecond([0]),
            });

            expect(cronFields.dayOfMonth.serialize()).toEqual({
                values: [15],
                wildcard: false,
            });
        });
    });

    describe("constructor validation", () => {
        it("should throw error when second field is missing", () => {
            expect(
                () =>
                    new CronFieldCollection({
                        dayOfMonth: new CronDayOfMonth([1]),
                        dayOfWeek: new CronDayOfWeek([1]),
                        hour: new CronHour([12]),
                        minute: new CronMinute([0]),
                        month: new CronMonth([1]),
                    } as never),
            ).toThrow("Validation error, Field second is missing");
        });

        it("should throw error when minute field is missing", () => {
            expect(
                () =>
                    new CronFieldCollection({
                        dayOfMonth: new CronDayOfMonth([1]),
                        dayOfWeek: new CronDayOfWeek([1]),
                        hour: new CronHour([12]),
                        month: new CronMonth([1]),
                        second: new CronSecond([0]),
                    } as never),
            ).toThrow("Validation error, Field minute is missing");
        });

        it("should throw error when hour field is missing", () => {
            expect(
                () =>
                    new CronFieldCollection({
                        dayOfMonth: new CronDayOfMonth([1]),
                        dayOfWeek: new CronDayOfWeek([1]),
                        minute: new CronMinute([0]),
                        month: new CronMonth([1]),
                        second: new CronSecond([0]),
                    } as never),
            ).toThrow("Validation error, Field hour is missing");
        });

        it("should throw error when dayOfMonth field is missing", () => {
            expect(
                () =>
                    new CronFieldCollection({
                        dayOfWeek: new CronDayOfWeek([1]),
                        hour: new CronHour([12]),
                        minute: new CronMinute([0]),
                        month: new CronMonth([1]),
                        second: new CronSecond([0]),
                    } as never),
            ).toThrow("Validation error, Field dayOfMonth is missing");
        });

        it("should throw error when month field is missing", () => {
            expect(
                () =>
                    new CronFieldCollection({
                        dayOfMonth: new CronDayOfMonth([1]),
                        dayOfWeek: new CronDayOfWeek([1]),
                        hour: new CronHour([12]),
                        minute: new CronMinute([0]),
                        second: new CronSecond([0]),
                    } as never),
            ).toThrow("Validation error, Field month is missing");
        });

        it("should throw error when dayOfWeek field is missing", () => {
            expect(
                () =>
                    new CronFieldCollection({
                        dayOfMonth: new CronDayOfMonth([1]),
                        hour: new CronHour([12]),
                        minute: new CronMinute([0]),
                        month: new CronMonth([1]),
                        second: new CronSecond([0]),
                    } as never),
            ).toThrow("Validation error, Field dayOfWeek is missing");
        });

        it("should throw error for invalid day of month definition", () => {
            expect(
                () =>
                    new CronFieldCollection({
                        dayOfMonth: new CronDayOfMonth([31]), // February only has 28/29 days
                        dayOfWeek: new CronDayOfWeek([0, 1, 2, 3, 4, 5, 6], { wildcard: true }), // '*', no day-of-week rescue
                        hour: new CronHour([12]),
                        minute: new CronMinute([0]),
                        month: new CronMonth([2]), // February
                        second: new CronSecond([0]),
                    }),
            ).toThrow("Invalid explicit day of month definition");
        });

        it("should not throw when an out-of-range day of month is rescued by the day of week", () => {
            // Day of month and day of week combine with OR, so 31 February with a
            // restricted day of week is valid: it fires on those weekdays.
            expect(
                () =>
                    new CronFieldCollection({
                        dayOfMonth: new CronDayOfMonth([31]),
                        dayOfWeek: new CronDayOfWeek([1]), // Monday
                        hour: new CronHour([12]),
                        minute: new CronMinute([0]),
                        month: new CronMonth([2]),
                        second: new CronSecond([0]),
                    }),
            ).not.toThrow();
        });
    });

    describe("cronFieldCollection.compactField", () => {
        it("empty array", () => {
            const result = CronFieldCollection.compactField([]);

            expect(result).toEqual([]);
        });

        it("single element array", () => {
            const result = CronFieldCollection.compactField([1]);

            expect(result).toEqual([{ count: 1, start: 1 }]);
        });

        it("2 elements array", () => {
            const result = CronFieldCollection.compactField([1, 2]);

            expect(result).toEqual([
                { count: 1, start: 1 },
                { count: 1, start: 2 },
            ]);
        });

        it("2 elements array big step", () => {
            const result = CronFieldCollection.compactField([1, 5]);

            expect(result).toEqual([
                { count: 1, start: 1 },
                { count: 1, start: 5 },
            ]);
        });

        it("3 elements array 1 step", () => {
            const result = CronFieldCollection.compactField([1, 2, 3]);

            expect(result).toEqual([{ count: 3, end: 3, start: 1, step: 1 }]);
        });

        it("3 elements array 1 step, dangling extra at end", () => {
            const result = CronFieldCollection.compactField([1, 2, 3, 5]);

            expect(result).toEqual([
                { count: 3, end: 3, start: 1, step: 1 },
                { count: 1, start: 5 },
            ]);
        });

        it("3 elements array 1 step, dangling extra at end and beginning", () => {
            const result = CronFieldCollection.compactField([1, 4, 5, 6, 9]);

            expect(result).toEqual([
                { count: 1, start: 1 },
                { count: 3, end: 6, start: 4, step: 1 },
                { count: 1, start: 9 },
            ]);
        });

        it("2 ranges with dangling in the middle", () => {
            const result = CronFieldCollection.compactField([1, 2, 3, 6, 9, 11, 13]);

            expect(result).toEqual([
                { count: 3, end: 3, start: 1, step: 1 },
                { count: 1, start: 6 },
                { count: 3, end: 13, start: 9, step: 2 },
            ]);
        });

        it("with chars", () => {
            const result = CronFieldCollection.compactField(["L", "W"]);

            expect(result).toEqual([
                { count: 1, start: "L" },
                { count: 1, start: "W" },
            ]);
        });

        it("with chars and range", () => {
            const result = CronFieldCollection.compactField([1, "L", "W"]);

            expect(result).toEqual([
                { count: 1, start: 1 },
                { count: 1, start: "L" },
                { count: 1, start: "W" },
            ]);
        });

        it("with chars and range (v2)", () => {
            const result = CronFieldCollection.compactField([1, 2, "L", "W"]);

            expect(result).toEqual([
                { count: 1, start: 1 },
                { count: 1, start: 2 },
                { count: 1, start: "L" },
                { count: 1, start: "W" },
            ]);
        });

        it("with chars and range (v3)", () => {
            const result = CronFieldCollection.compactField([1, 2, 3, "L", "W"]);

            expect(result).toEqual([
                { count: 3, end: 3, start: 1, step: 1 },
                { count: 1, start: "L" },
                { count: 1, start: "W" },
            ]);
        });
    });

    describe("from", () => {
        let base: CronFieldCollection;

        beforeEach(() => {
            base = new CronFieldCollection({
                dayOfMonth: new CronDayOfMonth([1]),
                dayOfWeek: new CronDayOfWeek([1]),
                hour: new CronHour([12]),
                minute: new CronMinute([0]),
                month: new CronMonth([1]),
                second: new CronSecond([0]),
            });
        });

        it("should return same fields when no overrides provided", () => {
            const result = CronFieldCollection.from(base, {});

            expect(result.second).toBe(base.second);
            expect(result.minute).toBe(base.minute);
            expect(result.hour).toBe(base.hour);
            expect(result.dayOfMonth).toBe(base.dayOfMonth);
            expect(result.month).toBe(base.month);
            expect(result.dayOfWeek).toBe(base.dayOfWeek);
        });

        it("should use provided CronField instances", () => {
            const newHour = new CronHour([15]);
            const newMinute = new CronMinute([30]);

            const result = CronFieldCollection.from(base, {
                hour: newHour,
                minute: newMinute,
            });

            expect(result.hour).toBe(newHour);
            expect(result.minute).toBe(newMinute);
            expect(result.second).toBe(base.second);
        });

        it("should create new fields from raw values", () => {
            const result = CronFieldCollection.from(base, {
                hour: [15],
                minute: [30],
            });

            expect(result.hour).not.toBe(base.hour);
            expect(result.hour.values).toEqual([15]);
            expect(result.minute).not.toBe(base.minute);
            expect(result.minute.values).toEqual([30]);
        });

        it("should handle special characters (L)", () => {
            const dayOfWeek: (number | string)[] = ["5L"];
            const result = CronFieldCollection.from(base, {
                dayOfMonth: ["L"],
                dayOfWeek: dayOfWeek as DayOfWeekRange[],
            });

            expect(result.dayOfMonth).not.toBe(base.dayOfMonth);
            expect(result.dayOfMonth.values).toEqual(["L"]);
            expect(result.dayOfWeek).not.toBe(base.dayOfWeek);
            expect(result.dayOfWeek.values).toEqual(["5L"]);
            expect(result.stringify(true)).toBe("0 0 12 L 1 5L");
        });

        it("should throw when day of week is a standalone L", () => {
            expect(() => CronFieldCollection.from(base, { dayOfWeek: ["L"] })).toThrow("CronDayOfWeek Validation error, unexpected standalone L");
        });

        it("should handle mix of CronField instances and raw values", () => {
            const newHour = new CronHour([15]);

            const result = CronFieldCollection.from(base, {
                hour: newHour,
                minute: [30],
            });

            expect(result.hour).toBe(newHour);
            expect(result.minute).not.toBe(base.minute);
            expect(result.minute.values).toEqual([30]);
        });

        it("should handle multiple values in raw array", () => {
            const result = CronFieldCollection.from(base, {
                hour: [12, 15, 18],
                minute: [0, 15, 30, 45],
            });

            expect(result.hour).not.toBe(base.hour);
            expect(result.hour.values).toEqual([12, 15, 18]);
            expect(result.minute).not.toBe(base.minute);
            expect(result.minute.values).toEqual([0, 15, 30, 45]);
        });
    });
});
