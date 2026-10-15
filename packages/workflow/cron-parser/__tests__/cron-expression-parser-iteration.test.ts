/* eslint-disable vitest/prefer-equality-matcher, vitest/prefer-expect-assertions, vitest/prefer-strict-equal, vitest/require-to-throw-message -- ported from the reference implementation's suite; kept close to the original for easy comparison */
import { describe, expect, it } from "vitest";

import CronDate from "../src/cron-date";
import type { CronExpressionOptions } from "../src/cron-expression";
import { CronExpressionParser } from "../src/cron-expression-parser";

describe(CronExpressionParser, () => {
    describe("take multiple dates", () => {
        it("step", () => {
            const options = {
                currentDate: new CronDate("Wed, 26 Dec 2012 14:38:53"),
            };
            const interval = CronExpressionParser.parse("6/23 * * * *", options);

            let next = interval.next();

            expect(next.getMinutes()).toBe(52);

            next = interval.next();

            expect(next.getMinutes()).toBe(6);

            next = interval.next();

            expect(next.getMinutes()).toBe(29);

            next = interval.next();

            expect(next.getMinutes()).toBe(52);
        });

        it("range", () => {
            const interval = CronExpressionParser.parse("10-30 2 12 8 0");
            const intervals = interval.take(20);

            for (let c = intervals.length, i = 0; i < c; i += 1) {
                const next = intervals[i] as CronDate;

                expect(next.getDay() === 0 || next.getDate() === 12).toBe(true);
                expect(next.getMonth()).toBe(7);
                expect(next.getHours()).toBe(2);
                expect(next.getMinutes()).toEqual(10 + i);
            }
        });

        it("incremental range with step", () => {
            const interval = CronExpressionParser.parse("10-30/2 2 12 8 0");
            const intervals = interval.take(10);

            for (let c = intervals.length, i = 0; i < c; i += 1) {
                const next = intervals[i] as CronDate;

                expect(next).toBeDefined();
                expect(next.getDay() === 0 || next.getDate() === 12).toBe(true);
                expect(next.getMonth()).toBe(7);
                expect(next.getHours()).toBe(2);
                expect(next.getMinutes()).toEqual(10 + i * 2);
            }
        });

        it("limited with start and end date", () => {
            const options = <CronExpressionOptions>{
                currentDate: new CronDate("Wed, 26 Dec 2012 14:38:53"),
                endDate: new CronDate("Wed, 26 Dec 2012 16:40:00"),
                startDate: new CronDate("Wed, 26 Dec 2012 12:40:00"),
                tz: "UTC",
            };

            const interval = CronExpressionParser.parse("*/20 * * * *", options);
            const expected = [
                "2012-12-26T14:40:00.000Z",
                "2012-12-26T15:00:00.000Z",
                "2012-12-26T15:20:00.000Z",
                "2012-12-26T15:40:00.000Z",
                "2012-12-26T16:00:00.000Z",
            ];

            for (const date of interval.take(5)) {
                expect(date.toISOString()).toEqual(expected.shift());
            }
        });
    });

    it("valid ES6 iterator should be returned", () => {
        const options = {
            currentDate: new CronDate("Wed, 26 Dec 2012 14:38:53"),
            endDate: new CronDate("Wed, 26 Dec 2012 15:40:00"),
        };

        const interval = CronExpressionParser.parse("*/25 * * * *", options);
        const iterator = interval[Symbol.iterator]();

        let value: IteratorResult<CronDate> = iterator.next();

        expect(value).not.toBeNull();
        expect(value.value).toBeDefined();
        expect(value.done).toBe(false);

        value = iterator.next();

        expect(value).not.toBeNull();
        expect(value.value).toBeDefined();
        expect(value.done).toBe(false);

        value = iterator.next();

        expect(value).not.toBeNull();
        expect(value.value).toBeDefined();
        expect(value.done).toBe(false);

        value = iterator.next();

        expect(value).not.toBeNull();
        expect(value.value).toBeUndefined();
        expect(value.done).toBe(true);
    });

    it("valid ES6 iterator works with for..of loop", () => {
        const options = {
            currentDate: new CronDate("Wed, 26 Dec 2012 14:38:53"),
            endDate: new CronDate("Wed, 26 Dec 2012 15:40:00"),
        };
        const interval = CronExpressionParser.parse("*/25 * * * *", options);

        const dates = [];

        for (const date of interval) {
            dates.push(date);
        }

        expect(dates).toHaveLength(3);
    });

    it("empty expression", () => {
        const interval = CronExpressionParser.parse("");
        const date = new CronDate();

        date.addMinute();

        const next = interval.next();

        expect(next).toBeInstanceOf(CronDate);
        expect(date.getMinutes()).toEqual(date.getMinutes());
    });

    it("default expression", () => {
        const interval = CronExpressionParser.parse("* * * * *");
        const date = new CronDate();

        date.addMinute();

        const next = interval.next();

        expect(next).toBeInstanceOf(CronDate);
        expect(date.getMinutes()).toEqual(date.getMinutes());
    });

    it("default expression (tab as field separator)", () => {
        const interval = CronExpressionParser.parse("*\t*\t*\t*\t*");
        const date = new CronDate();

        date.addMinute();

        const next = interval.next();

        expect(next).toBeInstanceOf(CronDate);
        expect(date.getMinutes()).toEqual(date.getMinutes());
    });

    it("default expression (mixed tab and space usage)", () => {
        const interval = CronExpressionParser.parse("* \t    *\t \t  *   *  \t \t  *");
        const date = new CronDate();

        date.addMinute();

        const next = interval.next();

        expect(next).toBeInstanceOf(CronDate);
        expect(date.getMinutes()).toEqual(date.getMinutes());
    });

    it("incremental minutes expression test", () => {
        const interval = CronExpressionParser.parse("*/3 * * * *");
        const next = interval.next();

        expect(next).toBeInstanceOf(CronDate);
        expect(next.getMinutes() % 3).toBe(0);
    });

    it("fixed expression test", () => {
        const interval = CronExpressionParser.parse("10 2 12 8 0");
        const next = interval.next();

        expect(next).toBeInstanceOf(CronDate);
        expect(next.getDay() === 0 || next.getDate() === 12).toBe(true);
        expect(next.getMonth()).toBe(7);
        expect(next.getHours()).toBe(2);
        expect(next.getMinutes()).toBe(10);
    });

    it("range test with non-standard value and repeat (second) from a CronDate", () => {
        const options = {
            currentDate: new CronDate("Wed, 26 Dec 2012 14:38:53"),
        };
        const interval = CronExpressionParser.parse("0/30 * * * * ?", options);

        let next = interval.next();

        expect(next.getSeconds()).toBe(0);

        next = interval.next();

        expect(next.getSeconds()).toBe(30);

        next = interval.next();

        expect(next.getSeconds()).toBe(0);
    });

    it("range test with non-standard value and repeat (second)", () => {
        const options = {
            currentDate: new CronDate("Wed, 26 Dec 2012 14:38:00"),
        };
        const interval = CronExpressionParser.parse("1/2 * * * * ?", options);

        let next = interval.next();

        expect(next.getSeconds()).toBe(1);

        next = interval.next();

        expect(next.getSeconds()).toBe(3);

        next = interval.next();

        expect(next.getSeconds()).toBe(5);
    });

    it("range with the same start and end value", () => {
        const interval = CronExpressionParser.parse("*/10 2-2 * * *");

        expect(interval).toBeDefined();
    });

    it("predefined expression", () => {
        const interval = CronExpressionParser.parse("@yearly");
        const date = new CronDate();

        date.addYear();

        const next = interval.next();

        expect(next.getFullYear()).toEqual(date.getFullYear());
    });

    it("limited with start and end date in forward direction", () => {
        const options = <CronExpressionOptions>{
            currentDate: new CronDate("Wed, 26 Dec 2012 14:38:53"),
            endDate: new CronDate("Wed, 26 Dec 2012 16:40:00"),
            startDate: new CronDate("Wed, 26 Dec 2012 12:40:00"),
        };

        const interval = CronExpressionParser.parse("*/20 * * * *", options);

        const dates1 = interval.take(10);

        expect(dates1).toHaveLength(7); // 'Dates count matches for positive iteration'

        interval.reset();

        const dates2 = interval.take(-10);

        expect(dates2).toHaveLength(6); // 'Dates count matches for negative iteration'

        interval.reset();

        // Forward iteration
        let next = interval.next();

        expect(next.getHours()).toBe(14);
        expect(next.getMinutes()).toBe(40);

        next = interval.next();

        expect(next.getHours()).toBe(15);
        expect(next.getMinutes()).toBe(0);

        next = interval.next();

        expect(next.getHours()).toBe(15);
        expect(next.getMinutes()).toBe(20);

        next = interval.next();

        expect(next.getHours()).toBe(15);
        expect(next.getMinutes()).toBe(40);

        next = interval.next();

        expect(next.getHours()).toBe(16);
        expect(next.getMinutes()).toBe(0);

        next = interval.next();

        expect(next.getHours()).toBe(16);
        expect(next.getMinutes()).toBe(20);

        next = interval.next();

        expect(next.getHours()).toBe(16);
        expect(next.getMinutes()).toBe(40);
        expect(() => interval.next()).toThrow(); // 'Should fail'

        next = interval.prev();

        expect(next.getHours()).toBe(16);
        expect(next.getMinutes()).toBe(20);
    });

    it("limited with start and end date in backwards direction", () => {
        const options = <CronExpressionOptions>{
            currentDate: new CronDate("Wed, 26 Dec 2012 14:38:53"),
            endDate: new CronDate("Wed, 26 Dec 2012 16:40:00"),
            startDate: new CronDate("Wed, 26 Dec 2012 12:40:00"),
        };

        const interval = CronExpressionParser.parse("*/20 * * * *", options);

        // Backward iteration
        let previous = interval.prev();

        expect(previous.getHours()).toBe(14);
        expect(previous.getMinutes()).toBe(20);

        previous = interval.prev();

        expect(previous.getHours()).toBe(14);
        expect(previous.getMinutes()).toBe(0);

        previous = interval.prev();

        expect(previous.getHours()).toBe(13);
        expect(previous.getMinutes()).toBe(40);

        previous = interval.prev();

        expect(previous.getHours()).toBe(13);
        expect(previous.getMinutes()).toBe(20);

        previous = interval.prev();

        expect(previous.getHours()).toBe(13);
        expect(previous.getMinutes()).toBe(0);
        expect(interval.hasPrev()).toBe(true);

        previous = interval.prev();

        expect(previous.getHours()).toBe(12);
        expect(previous.getMinutes()).toBe(40);
        expect(interval.hasPrev()).toBe(false);
        expect(() => interval.prev()).toThrow(); // 'Should fail'
    });

    it("reset to given date", () => {
        const options = {
            currentDate: new CronDate("Wed, 26 Dec 2012 14:38:53"),
        };
        const interval = CronExpressionParser.parse("*/20 * * * *", options);

        // Forward iteration
        let next = interval.next();

        expect(next.getHours()).toBe(14);
        expect(next.getMinutes()).toBe(40);

        interval.reset(); // defaults to initial currentDate

        next = interval.next();

        expect(next.getHours()).toBe(14);
        expect(next.getMinutes()).toBe(40);

        interval.reset(new CronDate("Wed, 26 Dec 2012 17:23:53"));

        next = interval.next();

        expect(next.getHours()).toBe(17);
        expect(next.getMinutes()).toBe(40);

        next = interval.next();

        expect(next.getHours()).toBe(18);
        expect(next.getMinutes()).toBe(0);

        interval.reset(new Date("2019-06-18T08:18:36.000"));

        next = interval.prev();

        expect(next.getDate()).toBe(18);
        expect(next.getHours()).toBe(8);
        expect(next.getMinutes()).toBe(0);

        next = interval.prev();

        expect(next.getDate()).toBe(18);
        expect(next.getHours()).toBe(7);
        expect(next.getMinutes()).toBe(40);
    });

    it("using day of week string", () => {
        const interval = CronExpressionParser.parse("15 10 * * SUN");
        const intervals = interval.take(8);

        for (const next of intervals) {
            const day = next.getDay();

            expect(day === 0).toBe(true);
            expect(next.getHours()).toBe(10);
            expect(next.getMinutes()).toBe(15);
        }
    });

    it("using days of week strings", () => {
        const interval = CronExpressionParser.parse("15 10 * * MON-TUE");
        const intervals = interval.take(8);

        for (const next of intervals) {
            const day = next.getDay();

            expect(day === 1 || day === 2).toBe(true);
            expect(next.getHours()).toBe(10);
            expect(next.getMinutes()).toBe(15);
        }
    });

    it("using mixed days of week strings", () => {
        const options = {
            currentDate: new CronDate("Wed, 26 Dec 2012 14:38:53"),
        };

        const interval = CronExpressionParser.parse("15 10 * jAn-FeB mOn-tUE", options);
        const intervals = interval.take(8);

        for (const next of intervals) {
            const day = next.getDay();
            const month = next.getMonth();

            expect(month === 0 || month === 1).toBe(true);
            expect(day === 1 || day === 2).toBe(true);
            expect(next.getHours()).toBe(10);
            expect(next.getMinutes()).toBe(15);
        }
    });

    it("using non-standard second field (wildcard)", () => {
        const options = {
            currentDate: new CronDate("Wed, 26 Dec 2012 14:38:00"),
            endDate: new CronDate("Wed, 26 Dec 2012 15:40:00"),
        };

        const interval = CronExpressionParser.parse("* * * * * *", options);
        const intervals = interval.take(10);

        for (const [index, next] of intervals.entries()) {
            expect(next.getSeconds()).toEqual(index + 1);
        }
    });

    it("using non-standard second field (step)", () => {
        const options = {
            currentDate: new CronDate("Wed, 26 Dec 2012 14:38:00"),
            endDate: new CronDate("Wed, 26 Dec 2012 15:40:00"),
        };

        const interval = CronExpressionParser.parse("*/20 * * * * *", options);
        const intervals = interval.take(3);

        expect(intervals[0]?.getSeconds()).toBe(20);
        expect(intervals[1]?.getSeconds()).toBe(40);
        expect(intervals[2]?.getSeconds()).toBe(0);
    });

    it("using non-standard second field (range)", () => {
        const options = {
            currentDate: new CronDate("Wed, 26 Dec 2012 14:38:00"),
            endDate: new CronDate("Wed, 26 Dec 2012 15:40:00"),
        };

        const interval = CronExpressionParser.parse("20-40/10 * * * * *", options);
        const intervals = interval.take(3);

        for (const [index, next] of intervals.entries()) {
            expect(next.getSeconds()).toEqual(20 + index * 10);
        }
    });

    it("pads a four field expression with a zero second and a wildcard minute", () => {
        const interval = CronExpressionParser.parse("20 15 * *");

        expect(interval.stringify(true)).toBe("0 * 20 15 * *");
    });

    it("pads a three field expression with a zero second and wildcard minutes and hours", () => {
        const interval = CronExpressionParser.parse("15 * *");

        expect(interval.stringify(true)).toBe("0 * * 15 * *");
    });

    it("keeps five field expressions unchanged when padding", () => {
        const interval = CronExpressionParser.parse("20 15 * * *");

        expect(interval.stringify(true)).toBe("0 20 15 * * *");
    });

    it("advances occurrences one minute apart for a four field expression", () => {
        const options = {
            currentDate: new CronDate("Wed, 26 Dec 2012 14:38:00"),
        };

        const interval = CronExpressionParser.parse("20 15 * *", options);
        const first = interval.next();
        const second = interval.next();

        expect(second.getTime() - first.getTime()).toBe(60_000);
    });

    it("using explicit month definition and */5 day of month step", () => {
        const firstIterator = CronExpressionParser.parse("0 12 */5 6 *", {
            currentDate: "2019-06-01T11:00:00.000",
        });
        const firstExpectedDates = [
            new CronDate("2019-06-01T12:00:00.000"),
            new CronDate("2019-06-06T12:00:00.000"),
            new CronDate("2019-06-11T12:00:00.000"),
            new CronDate("2019-06-16T12:00:00.000"),
            new CronDate("2019-06-21T12:00:00.000"),
            new CronDate("2019-06-26T12:00:00.000"),
            new CronDate("2020-06-01T12:00:00.000"),
        ];

        for (const expectedDate of firstExpectedDates) {
            expect(expectedDate.toISOString()).toEqual(firstIterator.next().toISOString());
        }

        const secondIterator = CronExpressionParser.parse("0 15 */5 5 *", {
            currentDate: "2019-05-01T11:00:00.000",
        });
        const secondExpectedDates = [
            new CronDate("2019-05-01T15:00:00.000"),
            new CronDate("2019-05-06T15:00:00.000"),
            new CronDate("2019-05-11T15:00:00.000"),
            new CronDate("2019-05-16T15:00:00.000"),
            new CronDate("2019-05-21T15:00:00.000"),
            new CronDate("2019-05-26T15:00:00.000"),
            new CronDate("2019-05-31T15:00:00.000"),
            new CronDate("2020-05-01T15:00:00.000"),
        ];

        for (const expectedDate of secondExpectedDates) {
            expect(expectedDate.toISOString()).toEqual(secondIterator.next().toISOString());
        }
    });

    it("drops day of month values that the month cannot contain", () => {
        const interval = CronExpressionParser.parse("0 0 16,31 6 *");

        expect(interval.fields.dayOfMonth.values).toEqual([16]);
    });

    it("drops day of month values outside the month from a stepped range", () => {
        const interval = CronExpressionParser.parse("0 0 16/5 6 *");

        expect(interval.fields.dayOfMonth.values).toEqual([16, 21, 26]);
    });

    it("limits a wildcard day of month to the length of the month", () => {
        const interval = CronExpressionParser.parse("0 0 * 2 *");

        expect(interval.fields.dayOfMonth.values).toHaveLength(29);
        expect(interval.fields.dayOfMonth.isWildcard).toBe(true);
    });

    it("keeps day of month values when more than one month is given", () => {
        const interval = CronExpressionParser.parse("0 0 31 1,6 *");

        expect(interval.fields.dayOfMonth.values).toEqual([31]);
    });

    it("keeps the last day of month character when a single month is given", () => {
        const interval = CronExpressionParser.parse("0 0 L 2 *");

        expect(interval.fields.dayOfMonth.values).toEqual(["L"]);
    });

    it("renders a stepped day of month in a single month to a stable expression", () => {
        const rendered = CronExpressionParser.parse("* * 9-20/3 16-26/5 jun *").stringify(true);

        expect(rendered).toBe("* * 9-18/3 16-26/5 6 *");
        expect(CronExpressionParser.parse(rendered).stringify(true)).toEqual(rendered);
    });
});
