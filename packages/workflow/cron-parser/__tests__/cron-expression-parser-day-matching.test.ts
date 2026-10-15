/* eslint-disable vitest/prefer-equality-matcher, vitest/prefer-expect-assertions, vitest/prefer-strict-equal, vitest/require-to-throw-message -- ported from the reference implementation's suite; kept close to the original for easy comparison */
import { describe, expect, it } from "vitest";

import CronDate from "../src/cron-date";
import { parse } from "../src/cron-expression-parser";
import type { CronFieldCollection } from "../src/cron-field-collection";

describe(parse, () => {
    it("day of month and week are both set", () => {
        const interval = parse("10 2 12 8 0");
        let next = interval.next();

        expect(next.getDay() === 0 || next.getDate() === 12).toBe(true);
        expect(next.getMonth()).toBe(7);

        next = interval.next();

        expect(next.getDay() === 0 || next.getDate() === 12).toBe(true);
        expect(next.getMonth()).toBe(7);

        next = interval.next();

        expect(next.getDay() === 0 || next.getDate() === 12).toBe(true);
        expect(next.getMonth()).toBe(7);

        next = interval.next();

        expect(next.getDay() === 0 || next.getDate() === 12).toBe(true);
        expect(next.getMonth()).toBe(7);
    });

    it("day of month combined with nth day of week (OR)", () => {
        // Day of month 8 OR the 3rd Friday of the month; the two combine with OR.
        const expectedDates = [
            "2024-01-08T00:00:00.000Z",
            "2024-01-19T00:00:00.000Z",
            "2024-02-08T00:00:00.000Z",
            "2024-02-16T00:00:00.000Z",
            "2024-03-08T00:00:00.000Z",
            "2024-03-15T00:00:00.000Z",
        ];
        const interval = parse("0 0 0 8 * 5#3", {
            currentDate: "2024-01-01T00:00:00.000Z",
            tz: "UTC",
        });

        for (const expectedDate of expectedDates) {
            expect(interval.next().toISOString()).toEqual(expectedDate);
        }
    });

    it("day of month is unspecified", () => {
        // At 02:10:00am, on every Wednesday, every month
        const expectedDates = [
            "2023-05-03T02:10:00.000Z",
            "2023-05-10T02:10:00.000Z",
            "2023-05-17T02:10:00.000Z",
            "2023-05-24T02:10:00.000Z",
            "2023-05-31T02:10:00.000Z",
            "2023-06-07T02:10:00.000Z",
            "2023-06-14T02:10:00.000Z",
            "2023-06-21T02:10:00.000Z",
            "2023-06-28T02:10:00.000Z",
            "2023-07-05T02:10:00.000Z",
        ];

        const options = {
            currentDate: "2023-04-29T00:00:00.000",
            tz: "UTC",
        };
        const interval = parse("10 2 ? * 3", options);

        for (const expectedDate of expectedDates) {
            expect(interval.next().toISOString()).toEqual(expectedDate);
        }
    });

    it("day of week is unspecified", () => {
        const interval = parse("10 2 3,6 * ?");
        let next = interval.next();

        expect(next.getDate() === 3 || next.getDate() === 6).toBe(true);

        let previousDate = next.getDate();

        next = interval.next();

        expect((next.getDate() === 3 || next.getDate() === 6) && next.getDate() !== previousDate).toBe(true);

        previousDate = next.getDate();

        next = interval.next();

        expect(next).toBeDefined();
        expect((next.getDate() === 3 || next.getDate() === 6) && next.getDate() !== previousDate).toBe(true);

        previousDate = next.getDate();

        next = interval.next();

        expect(next).toBeDefined();
        expect((next.getDate() === 3 || next.getDate() === 6) && next.getDate() !== previousDate).toBe(true);
    });

    it("day of month and week are both set and dow is 7", () => {
        const interval = parse("10 2 12 8 7");

        let next = interval.next();

        expect(next.getDay() === 0 || next.getDate() === 12).toBe(true);
        expect(next.getMonth()).toBe(7);

        next = interval.next();

        expect(next.getDay() === 0 || next.getDate() === 12).toBe(true);
        expect(next.getMonth()).toBe(7);

        next = interval.next();

        expect(next.getDay() === 0 || next.getDate() === 12).toBe(true);
        expect(next.getMonth()).toBe(7);

        next = interval.next();

        expect(next.getDay() === 0 || next.getDate() === 12).toBe(true);
        expect(next.getMonth()).toBe(7);
    });

    it("day of month is wildcard, month and day of week are both set", () => {
        const options = {
            currentDate: new CronDate("Mon, 31 May 2021 12:00:00"),
        };
        const interval = parse("0 0 * 6 2", options);
        const expectedDayMatches = [1, 8, 15, 22, 29];

        for (const dayOfMonth of expectedDayMatches) {
            const next = interval.next();

            expect(next.getDay()).toBe(2);
            expect(next.getDate()).toEqual(dayOfMonth);
            expect(next.getMonth()).toBe(5);
        }
    });

    it("day of month contains multiple ranges and day of week is wildcard", () => {
        const options = {
            currentDate: new CronDate("Sat, 1 Dec 2012 14:38:53"),
        };
        const interval = parse("0 0 0 2-4,7-31 * *", options);

        let next = interval.next();

        expect(next.getDate()).toBe(2);
        expect(next.getMonth()).toBe(11);

        next = interval.next();

        expect(next.getDate()).toBe(3);
        expect(next.getMonth()).toBe(11);

        next = interval.next();

        expect(next.getDate()).toBe(4);
        expect(next.getMonth()).toBe(11);

        next = interval.next();

        expect(next.getDate()).toBe(7);
        expect(next.getMonth()).toBe(11);

        next = interval.next();

        expect(next.getDate()).toBe(8);
        expect(next.getMonth()).toBe(11);
        expect(() => interval.next()).not.toThrow();
    });

    it("day of month and week are both set and dow is 6,0", () => {
        const options = {
            currentDate: new CronDate("Wed, 26 Dec 2012 14:38:53"),
        };
        const interval = parse("10 2 12 8 6,0", options);

        let next = interval.next();

        expect(next.getDay() === 6 || next.getDate() === 12).toBe(true);
        expect(next.getMonth()).toBe(7);

        next = interval.next();

        expect(next.getDay() === 0 || next.getDate() === 12).toBe(true);
        expect(next.getMonth()).toBe(7);

        next = interval.next();

        expect(next.getDay() === 6 || next.getDate() === 12).toBe(true);
        expect(next.getMonth()).toBe(7);

        next = interval.next();

        expect(next.getDay() === 0 || next.getDate() === 12).toBe(true);
        expect(next.getMonth()).toBe(7);
    });

    it("day of month and week are both set and dow is 6-7", () => {
        // if both "day of month" (field 3) and "day of week" (field 5) are restricted (not contain "*"), then one or both must match the current day.
        // At 02:10 AM, on day 12 of the month, Saturday through Sunday, only in August
        const expectedDates = [
            "2013-08-03T02:10:00.000Z", // - Saturday
            "2013-08-04T02:10:00.000Z", // - Sunday
            "2013-08-10T02:10:00.000Z", // - Saturday
            "2013-08-11T02:10:00.000Z", // - Sunday
            "2013-08-12T02:10:00.000Z", // - Monday - 12th of month
            "2013-08-17T02:10:00.000Z", // - Saturday
            "2013-08-18T02:10:00.000Z", // - Sunday
            "2013-08-24T02:10:00.000Z", // - Saturday
            "2013-08-25T02:10:00.000Z", // - Sunday
            "2013-08-31T02:10:00.000Z", // - Saturday
            "2014-08-02T02:10:00.000Z", // - Saturday
            "2014-08-03T02:10:00.000Z", // - Sunday
            "2014-08-09T02:10:00.000Z", // - Saturday
            "2014-08-10T02:10:00.000Z", // - Sunday
            "2014-08-12T02:10:00.000Z", // - Tuesday - 12th of month
        ];

        const options = {
            currentDate: new CronDate("Wed, 26 Dec 2012 14:38:53"),
            tz: "UTC",
        };
        const interval = parse("10 2 12 8 6-7", options);

        let next = interval.next();

        for (const expectedDate of expectedDates) {
            expect(next.toISOString()).toEqual(expectedDate);

            next = interval.next();
        }
    });

    it("day of month validation should be ignored when day of month is wildcard and month is set", () => {
        const options = {
            currentDate: new CronDate("2020-05-01T15:00:00.000"),
        };
        const interval = parse("* * * * 2 *", options);
        const next = interval.next();

        expect(next.getHours()).toBe(0);
        expect(next.getDate()).toBe(1);
        expect(next.getMonth() + 1).toBe(2);
    });

    it("day and date in week should match", () => {
        const interval = parse("0 1 1 1 * 1");

        let next = interval.next();

        expect(next.getHours()).toBe(1);
        expect(next.getDay() === 1 || next.getDate() === 1).toBe(true);

        next = interval.next();

        expect(next.getHours()).toBe(1);
        expect(next.getDay() === 1 || next.getDate() === 1).toBe(true);

        next = interval.next();

        expect(next.getHours()).toBe(1);
        expect(next.getDay() === 1 || next.getDate() === 1).toBe(true);
    });

    it("should sort ranges and values in ascending order", () => {
        const options = {
            currentDate: new CronDate("Wed, 26 Dec 2012 14:38:53"),
        };
        const interval = parse("0 12,13,10,1-3 * * *", options);
        const expectedHours = [1, 2, 3, 10, 12, 13];

        for (const expectedHour of expectedHours) {
            const next = interval.next();

            expect(next.getHours()).toEqual(expectedHour);
        }
    });

    it("dow 6,7 6,0 0,6 7,6 should be equivalent", () => {
        const options = {
            currentDate: new CronDate("Wed, 26 Dec 2012 14:38:53"),
        };

        const expressions = ["30 16 * * 6,7", "30 16 * * 6,0", "30 16 * * 0,6", "30 16 * * 7,6"];

        for (const expression of expressions) {
            const interval = parse(expression, options);
            let next = interval.next();

            expect(next.getDay() === 6).toBe(true);

            next = interval.next();

            expect(next.getDay() === 0).toBe(true);

            next = interval.next();

            expect(next.getDay() === 6).toBe(true);
        }
    });

    it("hour 0 9,11,1 * * * and 0 1,9,11 * * * should be equivalent", () => {
        const options = {
            currentDate: new CronDate("Wed, 26 Dec 2012 00:00:00"),
        };
        const expressions = ["0 9,11,1 * * *", "0 1,9,11 * * *"];

        for (const expression of expressions) {
            const interval = parse(expression, options);
            let next = interval.next();

            expect(next.getHours()).toBe(1);

            next = interval.next();

            expect(next.getHours()).toBe(9);

            next = interval.next();

            expect(next.getHours()).toBe(11);

            next = interval.next();

            expect(next.getHours()).toBe(1);

            next = interval.next();

            expect(next.getHours()).toBe(9);

            next = interval.next();

            expect(next.getHours()).toBe(11);
        }
    });

    it("it will work with #139 issue case", () => {
        const options = {
            currentDate: new Date("2018-11-15T16:15:33.522Z"),
            tz: "Europe/Madrid",
        };
        const interval = parse("0 0 0 1,2 * *", options);
        const next = interval.next();

        expect(next.getFullYear()).toBe(2018);
        expect(next.getDate()).toBe(1);
        expect(next.getMonth()).toBe(11);
    });

    it("should work for valid first/second/third/fourth/fifth occurrence dayOfWeek (# char)", () => {
        const options = {
            currentDate: new CronDate("2019-04-30"),
        };

        const expectedFirstDates = [new CronDate("2019-05-05"), new CronDate("2019-06-02"), new CronDate("2019-07-07"), new CronDate("2019-08-04")];
        const expectedSecondDates = [new CronDate("2019-05-12"), new CronDate("2019-06-09"), new CronDate("2019-07-14"), new CronDate("2019-08-11")];
        const expectedThirdDates = [new CronDate("2019-05-19"), new CronDate("2019-06-16"), new CronDate("2019-07-21"), new CronDate("2019-08-18")];
        const expectedFourthDates = [new CronDate("2019-05-26"), new CronDate("2019-06-23"), new CronDate("2019-07-28"), new CronDate("2019-08-25")];
        const expectedFifthDates = [new CronDate("2019-06-30"), new CronDate("2019-09-29"), new CronDate("2019-12-29"), new CronDate("2020-03-29")];

        const allExpectedDates = [expectedFirstDates, expectedSecondDates, expectedThirdDates, expectedFourthDates, expectedFifthDates];
        const expressions = ["0 0 0 ? * 0#1", "0 0 0 ? * 0#2", "0 0 0 ? * 0#3", "0 0 0 ? * 0#4", "0 0 0 ? * 0#5"];

        for (const [index, expression] of expressions.entries()) {
            const interval = parse(expression, options);
            const expectedDates = allExpectedDates[index] as CronDate[];

            for (const expectedDate of expectedDates) {
                const date = interval.next();

                expect(date.toISOString()).toEqual(expectedDate.toISOString());
            }

            expectedDates
                .slice(0, -1)
                .toReversed()
                .forEach((expected) => {
                    const date = interval.prev();

                    expect(date.toISOString()).toEqual(expected.toISOString());
                });
        }
    });

    it("should work for valid second sunday in May", () => {
        const options = {
            currentDate: new CronDate("2023-05-06T00:00:00.000Z"),
            tz: "UTC",
        };
        const expectedDates = [
            new CronDate("2023-05-14T00:00:00.000Z"),
            new CronDate("2024-05-12T00:00:00.000Z"),
            new CronDate("2025-05-11T00:00:00.000Z"),
            new CronDate("2026-05-10T00:00:00.000Z"),
            new CronDate("2027-05-09T00:00:00.000Z"),
            new CronDate("2028-05-14T00:00:00.000Z"),
        ];

        const interval = parse("0 0 0 ? MAY 0#2", options);

        for (const expectedDate of expectedDates) {
            const next = interval.next();

            expect(next.toISOString()).toEqual(expectedDate.toISOString());
        }

        expectedDates
            .slice(0, -1)
            .toReversed()
            .forEach((expected) => {
                const next = interval.prev();

                expect(next.toISOString()).toEqual(expected.toISOString());
            });
    });

    it("should work for valid second sunday at noon in May", () => {
        const options = {
            currentDate: new CronDate("2019-05-12T11:59:00.000"),
        };
        const expected = new CronDate("2019-05-12T12:00:00.000");
        const interval = parse("0 0 12 ? MAY 0#2", options);
        const next = interval.next();

        expect(next.toISOString()).toEqual(expected.toISOString());
    });

    it("should work for valid second sunday at noon in May (UTC+3)", () => {
        const options = {
            currentDate: new CronDate("2019-05-12T11:59:00.000", "Europe/Sofia"),
        };
        const expected = new CronDate("2019-05-12T12:00:00.000", "Europe/Sofia");
        const interval = parse("0 0 12 ? MAY 0#2", options);
        const next = interval.next();

        expect(next.toISOString()).toEqual(expected.toISOString());
    });

    it("should work with both dayOfMonth and nth occurrence of dayOfWeek", () => {
        const options = {
            currentDate: new CronDate("2019-04-01"),
        };

        const expectedDates = [
            new CronDate("2019-04-16"),
            new CronDate("2019-04-17"),
            new CronDate("2019-04-18"),
            new CronDate("2019-05-15"),
            new CronDate("2019-05-16"),
            new CronDate("2019-05-18"),
        ];

        const interval = parse("0 0 0 16,18 * 3#3", options);

        for (const expectedDate of expectedDates) {
            const next = interval.next();

            expect(next.toISOString()).toEqual(expectedDate.toISOString());
        }

        expectedDates
            .slice(0, -1)
            .toReversed()
            .forEach((expected) => {
                const next = interval.prev();

                expect(next.toISOString()).toEqual(expected.toISOString());
            });
    });

    it("should correctly determine if a given expression includes a CronDate (#153 and #299)", () => {
        const expression = "* * 1-6 ? * *"; // 1am to 6am every day
        const goodDate = new CronDate("2019-01-01T01:00:00.000");
        const badDateBefore = new CronDate("2019-01-01T00:00:00.000");
        const badDateAfter = new CronDate("2019-01-01T07:00:00.000");
        const interval = parse(expression);

        expect(interval.includesDate(goodDate)).toBe(true);
        expect(interval.includesDate(badDateBefore)).toBe(false);
        expect(interval.includesDate(badDateAfter)).toBe(false);
        expect(() => interval.includesDate(new Date("invalid"))).toThrow();
    });

    it("correctly handle 0 12 1-31 * 1 (#284)", () => {
        // At 12:00 on Monday.
        const options = {
            currentDate: new CronDate("Sun, 30 Oct 2022 14:00:00", "UTC"),
        };
        const expression = "0 12 1-31 * 1";
        const interval = parse(expression, options);
        const expectedDates = [31, 1, 2, 3, 4, 5, 6, 7];

        for (const expectedDate of expectedDates) {
            expect(interval.next().getUTCDate()).toEqual(expectedDate);
        }

        expect(interval.toString()).toEqual(expression);
    });

    it("fields are accessible", () => {
        const interval = parse("0 1 2 3 * 1-3,5");

        expect(interval).toBeDefined();
        expect(interval.fields["dummy" as keyof CronFieldCollection]).toBeUndefined();
        expect(interval.fields.second.values).toEqual([0]);
        expect(interval.fields.minute.values).toEqual([1]);
        expect(interval.fields.hour.values).toEqual([2]);
        expect(interval.fields.dayOfMonth.values).toEqual([3]);
        expect(interval.fields.month.values).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
        expect(interval.fields.dayOfWeek.values).toEqual([1, 2, 3, 5]);
    });

    it("day-of-week step does not add Sunday when the step never reaches 7", () => {
        const dow = (expr: string) => parse(expr).fields.dayOfWeek.values;

        expect(dow("0 0 * * 2/2")).toEqual([2, 4, 6]);
        expect(dow("0 0 * * 2-7/2")).toEqual([2, 4, 6]);
        expect(dow("0 0 * * 4/2")).toEqual([4, 6]);
        expect(dow("0 0 * * 1/2")).toEqual([0, 1, 3, 5, 7]);
        expect(dow("0 0 * * 6/1")).toEqual([0, 6, 7]);
        expect(dow("0 0 * * 0/2")).toEqual([0, 2, 4, 6]);
    });
});
