/* eslint-disable vitest/prefer-expect-assertions, vitest/prefer-strict-equal, vitest/require-to-throw-message -- ported from the reference implementation's suite; kept close to the original for easy comparison */
import { DateTime } from "luxon";
import { describe, expect, it } from "vitest";

import { TimeUnit as PublicTimeUnit } from "../src";
import { CronDate, TimeUnit } from "../src/cron-date";

describe(CronDate, () => {
    it("is the last weekday of the month", () => {
        // Last monday of september
        expect(new CronDate(new Date(2021, 8, 27)).isLastWeekdayOfMonth()).toBe(true);

        // Second-to-last monday of september
        expect(new CronDate(new Date(2021, 8, 20)).isLastWeekdayOfMonth()).toBe(false);

        // Last friday of leap year february
        expect(new CronDate(new Date(2020, 1, 28)).isLastWeekdayOfMonth()).toBe(true);

        // Last friday of non-leap year february
        expect(new CronDate(new Date(2021, 1, 26)).isLastWeekdayOfMonth()).toBe(true);
    });

    it("addSecond should succeed", () => {
        const date1 = new CronDate(new Date("2021-12-30T00:59:58.000-00:00"), "UTC");

        date1.addSecond();

        expect(date1.getMonth()).toBe(11);
        expect(date1.getDate()).toBe(30);
        expect(date1.getMinutes()).toBe(59);
        expect(date1.getSeconds()).toBe(59);

        const date2 = new CronDate(new Date("2021-12-31T23:59:59.000-00:00"), "UTC");

        date2.addSecond();

        expect(date2.getFullYear()).toBe(2022);
        expect(date2.getMonth()).toBe(0);
        expect(date2.getDate()).toBe(1);
        expect(date2.getMinutes()).toBe(0);
        expect(date2.getSeconds()).toBe(0);
    });

    it("addMinute should succeed", () => {
        const date1 = new CronDate(new Date("2021-12-30T00:58:58.000-00:00"), "UTC");

        date1.addMinute();

        expect(date1.getMonth()).toBe(11);
        expect(date1.getDate()).toBe(30);
        expect(date1.getMinutes()).toBe(59);
        expect(date1.getSeconds()).toBe(0);

        const date2 = new CronDate(new Date("2021-12-31T23:59:59.000-00:00"), "UTC");

        date2.addMinute();

        expect(date2.getFullYear()).toBe(2022);
        expect(date2.getMonth()).toBe(0);
        expect(date2.getDate()).toBe(1);
        expect(date2.getMinutes()).toBe(0);
        expect(date2.getSeconds()).toBe(0);
    });

    it("addHour should succeed", () => {
        const date1 = new CronDate(new Date("2021-12-30T00:58:58.000-00:00"), "UTC");

        date1.addHour();

        expect(date1.getMonth()).toBe(11);
        expect(date1.getDate()).toBe(30);
        expect(date1.getHours()).toBe(1);
        expect(date1.getMinutes()).toBe(0);
        expect(date1.getSeconds()).toBe(0);

        const date2 = new CronDate(new Date("2021-12-31T23:59:59.000-00:00"), "UTC");

        date2.addHour();

        expect(date2.getFullYear()).toBe(2022);
        expect(date2.getMonth()).toBe(0);
        expect(date2.getDate()).toBe(1);
        expect(date2.getHours()).toBe(0);
        expect(date2.getMinutes()).toBe(0);
        expect(date2.getSeconds()).toBe(0);
    });

    it("addDay should succeed", () => {
        const date1 = new CronDate(new Date("2021-12-30T00:58:58.000-00:00"), "UTC");

        date1.addDay();

        expect(date1.getMonth()).toBe(11);
        expect(date1.getDate()).toBe(31);
        expect(date1.getHours()).toBe(0);
        expect(date1.getMinutes()).toBe(0);
        expect(date1.getSeconds()).toBe(0);

        const date2 = new CronDate(new Date("2021-12-31T23:59:59.000-00:00"), "UTC");

        date2.addDay();

        expect(date2.getFullYear()).toBe(2022);
        expect(date2.getMonth()).toBe(0);
        expect(date2.getDate()).toBe(1);
        expect(date2.getHours()).toBe(0);
        expect(date2.getMinutes()).toBe(0);
        expect(date2.getSeconds()).toBe(0);
    });

    it("addMonth should succeed", () => {
        const date1 = new CronDate(new Date("2021-11-30T00:58:58.000-00:00"), "UTC");

        date1.addMonth();

        expect(date1.getMonth()).toBe(11);
        expect(date1.getDate()).toBe(1);
        expect(date1.getHours()).toBe(0);
        expect(date1.getMinutes()).toBe(0);
        expect(date1.getSeconds()).toBe(0);

        const date2 = new CronDate(new Date("2021-12-31T23:59:59.000-00:00"), "UTC");

        date2.addMonth();

        expect(date2.getFullYear()).toBe(2022);
        expect(date2.getMonth()).toBe(0);
        expect(date2.getDate()).toBe(1);
        expect(date2.getHours()).toBe(0);
        expect(date2.getMinutes()).toBe(0);
        expect(date2.getSeconds()).toBe(0);
    });

    it("addYear should succeed", () => {
        const date1 = new CronDate(new Date("2021-11-30T00:58:58.000-00:00"), "UTC");

        date1.addYear();

        expect(date1.getFullYear()).toBe(2022);
        expect(date1.getMonth()).toBe(10);
        expect(date1.getDate()).toBe(30);
        expect(date1.getHours()).toBe(0);
        expect(date1.getMinutes()).toBe(58);
        expect(date1.getSeconds()).toBe(58);

        const date2 = new CronDate(new Date("2020-02-29T23:59:59.000-00:00"), "UTC");

        date2.addYear();

        expect(date2.getFullYear()).toBe(2021);
        expect(date2.getMonth()).toBe(1);
        expect(date2.getDate()).toBe(28);
        expect(date2.getHours()).toBe(23);
        expect(date2.getMinutes()).toBe(59);
        expect(date2.getSeconds()).toBe(59);
    });

    it("subtractSecond should succeed", () => {
        const date1 = new CronDate(new Date("2020-12-30T00:59:59.000-00:00"), "UTC");

        date1.subtractSecond();

        expect(date1.getFullYear()).toBe(2020);
        expect(date1.getMonth()).toBe(11);
        expect(date1.getDate()).toBe(30);
        expect(date1.getMinutes()).toBe(59);
        expect(date1.getSeconds()).toBe(58);

        const date2 = new CronDate(new Date("2020-01-01T00:00:00.000-00:00"), "UTC");

        date2.subtractSecond();

        expect(date2.getFullYear()).toBe(2019);
        expect(date2.getMonth()).toBe(11);
        expect(date2.getDate()).toBe(31);
        expect(date2.getMinutes()).toBe(59);
        expect(date2.getSeconds()).toBe(59);
    });

    it("subtractMinute should succeed", () => {
        const date1 = new CronDate(new Date("2020-12-30T00:59:59.000-00:00"), "UTC");

        date1.subtractMinute();

        expect(date1.getFullYear()).toBe(2020);
        expect(date1.getMonth()).toBe(11);
        expect(date1.getDate()).toBe(30);
        expect(date1.getMinutes()).toBe(58);
        expect(date1.getSeconds()).toBe(59);

        const date2 = new CronDate(new Date("2020-01-01T00:00:00.000-00:00"), "UTC");

        date2.subtractMinute();

        expect(date2.getFullYear()).toBe(2019);
        expect(date2.getMonth()).toBe(11);
        expect(date2.getDate()).toBe(31);
        expect(date2.getMinutes()).toBe(59);
        expect(date2.getSeconds()).toBe(59);
    });

    it("subtractHour should succeed", () => {
        const date1 = new CronDate(new Date("2020-12-30T01:59:59.000-00:00"), "UTC");

        date1.subtractHour();

        expect(date1.getFullYear()).toBe(2020);
        expect(date1.getMonth()).toBe(11);
        expect(date1.getDate()).toBe(30);
        expect(date1.getHours()).toBe(0);
        expect(date1.getMinutes()).toBe(59);
        expect(date1.getSeconds()).toBe(59);

        const date2 = new CronDate(new Date("2020-01-01T00:00:00.000-00:00"), "UTC");

        date2.subtractHour();

        expect(date2.getFullYear()).toBe(2019);
        expect(date2.getMonth()).toBe(11);
        expect(date2.getDate()).toBe(31);
        expect(date2.getHours()).toBe(23);
        expect(date2.getMinutes()).toBe(59);
        expect(date2.getSeconds()).toBe(59);
    });

    it("subtractDay should succeed", () => {
        const date1 = new CronDate(new Date("2020-12-30T01:59:59.000-00:00"), "UTC");

        date1.subtractDay();

        expect(date1.getFullYear()).toBe(2020);
        expect(date1.getMonth()).toBe(11);
        expect(date1.getDate()).toBe(29);
        expect(date1.getHours()).toBe(23);
        expect(date1.getMinutes()).toBe(59);
        expect(date1.getSeconds()).toBe(59);

        const date2 = new CronDate(new Date("2020-01-01T00:00:00.000-00:00"), "UTC");

        date2.subtractDay();

        expect(date2.getFullYear()).toBe(2019);
        expect(date2.getMonth()).toBe(11);
        expect(date2.getDate()).toBe(31);
        expect(date2.getHours()).toBe(23);
        expect(date2.getMinutes()).toBe(59);
        expect(date2.getSeconds()).toBe(59);
    });

    it("subtractYear should succeed", () => {
        const date1 = new CronDate(new Date("2020-12-30T01:59:59.000-00:00"), "UTC");

        date1.subtractYear();

        expect(date1.getFullYear()).toBe(2019);
        expect(date1.getMonth()).toBe(11);
        expect(date1.getDate()).toBe(30);
        expect(date1.getHours()).toBe(1);
        expect(date1.getMinutes()).toBe(59);
        expect(date1.getSeconds()).toBe(59);

        const date2 = new CronDate(new Date("2020-02-29T00:00:00.000-00:00"), "UTC");

        date2.subtractYear();

        expect(date2.getFullYear()).toBe(2019);
        expect(date2.getMonth()).toBe(1);
        expect(date2.getDate()).toBe(28);
        expect(date2.getHours()).toBe(0);
        expect(date2.getMinutes()).toBe(0);
        expect(date2.getSeconds()).toBe(0);
    });

    it("addUnit should succeed", () => {
        const date1 = new CronDate(new Date("2020-11-30T01:01:01.000-00:00"), "UTC");

        date1.addUnit(TimeUnit.Year);

        expect(date1.getFullYear()).toBe(2021);

        const date2 = new CronDate(new Date("2020-11-30T01:01:01.000-00:00"), "UTC");

        date2.addUnit(TimeUnit.Month);

        expect(date2.getMonth()).toBe(11);

        const date3 = new CronDate(new Date("2020-11-30T01:01:01.000-00:00"), "UTC");

        date3.addUnit(TimeUnit.Day);

        expect(date3.getDate()).toBe(1);

        const date4 = new CronDate(new Date("2020-11-30T01:01:01.000-00:00"), "UTC");

        date4.addUnit(TimeUnit.Hour);

        expect(date4.getHours()).toBe(2);

        const date5 = new CronDate(new Date("2020-11-30T01:01:01.000-00:00"), "UTC");

        date5.addUnit(TimeUnit.Minute);

        expect(date5.getMinutes()).toBe(2);

        const date6 = new CronDate(new Date("2020-11-30T01:01:01.000-00:00"), "UTC");

        date6.addUnit(TimeUnit.Second);

        expect(date6.getSeconds()).toBe(2);
    });

    it("subtractUnit should succeed", () => {
        const date1 = new CronDate(new Date("2020-11-30T01:01:01.000-00:00"), "UTC");

        date1.subtractUnit(TimeUnit.Year);

        expect(date1.getFullYear()).toBe(2019);

        const date2 = new CronDate(new Date("2020-11-30T01:01:01.000-00:00"), "UTC");

        date2.subtractUnit(TimeUnit.Month);

        expect(date2.getMonth()).toBe(9);

        const date3 = new CronDate(new Date("2020-11-30T01:01:01.000-00:00"), "UTC");

        date3.subtractUnit(TimeUnit.Day);

        expect(date3.getDate()).toBe(29);

        const date4 = new CronDate(new Date("2020-11-30T01:01:01.000-00:00"), "UTC");

        date4.subtractUnit(TimeUnit.Hour);

        expect(date4.getHours()).toBe(0);

        const date5 = new CronDate(new Date("2020-11-30T01:01:01.000-00:00"), "UTC");

        date5.subtractUnit(TimeUnit.Minute);

        expect(date5.getMinutes()).toBe(0);

        const date6 = new CronDate(new Date("2020-11-30T01:01:01.000-00:00"), "UTC");

        date6.subtractUnit(TimeUnit.Second);

        expect(date6.getSeconds()).toBe(0);
    });

    it("getUTCDate should succeed", () => {
        const date1 = new CronDate(new Date("2020-11-30T01:01:01.000-00:00"), "UTC");

        expect(date1.getUTCDate()).toBe(30);
    });

    it("getUTCDay should succeed", () => {
        // Day of week starts at 0 for Sunday
        const date1 = new CronDate(new Date("2020-11-28T01:01:01.000-00:00"), "UTC");

        expect(date1.getUTCDay()).toBe(6);

        const date2 = new CronDate(new Date("2020-11-22T01:01:01.000-00:00"), "UTC");

        expect(date2.getUTCDay()).toBe(0);

        const date3 = new CronDate(new Date("2020-11-29T01:01:01.000-00:00"), "UTC");

        expect(date3.getUTCDay()).toBe(0);
    });

    it("getUTCFullYear should succeed", () => {
        const date1 = new CronDate(new Date("2020-11-30T01:01:01.000-00:00"), "UTC");

        expect(date1.getUTCFullYear()).toBe(2020);
    });

    it("getUTCMonth should succeed", () => {
        const date1 = new CronDate(new Date("2020-11-30T01:01:01.000-00:00"), "UTC");

        expect(date1.getUTCMonth()).toBe(10);
    });

    it("getUTCHours should succeed", () => {
        const date1 = new CronDate(new Date("2020-11-30T01:01:01.000-00:00"), "UTC");

        expect(date1.getUTCHours()).toBe(1);
    });

    it("getUTCMinutes should succeed", () => {
        const date1 = new CronDate(new Date("2020-11-30T01:01:01.000-00:00"), "UTC");

        expect(date1.getUTCMinutes()).toBe(1);
    });

    it("getUTCSeconds should succeed", () => {
        const date1 = new CronDate(new Date("2020-11-30T01:01:01.000-00:00"), "UTC");

        expect(date1.getUTCSeconds()).toBe(1);
    });

    it("toJSON should succeed", () => {
        const date1 = new CronDate(new Date("2020-11-30T01:01:01.000-00:00"), "UTC");

        expect(date1.toJSON()).toBe("2020-11-30T01:01:01.000Z");
    });

    it("toString should succeed", () => {
        const date1 = new CronDate(new Date("2020-11-30T01:01:01.000-00:00"), "UTC");
        const expected = new Date("2020-11-30T01:01:01.000-00:00").toString();

        expect(date1.toString()).toEqual(expected);
    });

    it("setDate should succeed", () => {
        const date1 = new CronDate(new Date("2021-12-30T00:59:58.000-00:00"), "UTC");

        date1.setDate(1);

        expect(date1.getDate()).toBe(1);
    });

    it("setFullYear should succeed", () => {
        const date1 = new CronDate(new Date("2021-12-30T00:59:58.000-00:00"), "UTC");

        date1.setFullYear(2222);

        expect(date1.getFullYear()).toBe(2222);
    });

    it("setDay should succeed", () => {
        const date1 = new CronDate(new Date("2021-12-30T00:59:58.000-00:00"), "UTC");

        date1.setDay(3);

        expect(date1.getDay()).toBe(3);
    });

    it("setMonth should succeed", () => {
        const date1 = new CronDate(new Date("2021-12-30T00:59:58.000-00:00"), "UTC");

        date1.setMonth(3);

        expect(date1.getMonth()).toBe(3);
    });

    it("setHours should succeed", () => {
        const date1 = new CronDate(new Date("2021-12-30T00:59:58.000-00:00"), "UTC");

        date1.setHours(3);

        expect(date1.getHours()).toBe(3);
    });

    it("setMinutes should succeed", () => {
        const date1 = new CronDate(new Date("2021-12-30T00:59:58.000-00:00"), "UTC");

        date1.setMinutes(30);

        expect(date1.getMinutes()).toBe(30);
    });

    it("setSeconds should succeed", () => {
        const date1 = new CronDate(new Date("2021-12-30T00:59:58.000-00:00"), "UTC");

        date1.setSeconds(30);

        expect(date1.getSeconds()).toBe(30);
    });

    describe("parse cron date formats with local timezone", () => {
        const offset = new Date().getTimezoneOffset();
        const offsetHours = Math.abs(Math.floor(offset / 60));
        const offsetMinutes = offset % 60;
        const offsetSign = offset < 0 ? "-" : "+";
        const expectedTime = new Date(2021, 0, 4, 10, 0, 0).toString();

        it("undefined date", () => {
            // Bracketed by two readings of the clock: comparing against one reading fails when a second ticks over in between.
            const before = Date.now();
            const d = new CronDate();
            const after = Date.now();

            expect(d).toBeInstanceOf(CronDate);
            expect(d.getTime()).toBeGreaterThanOrEqual(before);
            expect(d.getTime()).toBeLessThanOrEqual(after);
        });

        it("reads a JS Date", () => {
            const d = new CronDate(new Date(2021, 0, 4, 10, 0, 0));

            expect(d.toDate().toString()).toBe(expectedTime);
        });

        it("reads ISO 8601", () => {
            const d = new CronDate("2021-01-04T10:00:00");

            expect(d.toDate().toString()).toBe(expectedTime);
        });

        it("reads an ISO 8601 date", () => {
            const d = new CronDate("2021-01-04");
            const expectedMidnight = new Date(2021, 0, 4, 0, 0, 0).toString();

            expect(d.toDate().toString()).toBe(expectedMidnight);
        });

        it("reads RFC2822", () => {
            const offsetString = offsetSign + String(offsetHours).padStart(2, "0") + String(offsetMinutes).padStart(2, "0");
            const d = new CronDate(`Mon, 4 Jan 2021 10:00:00 ${offsetString}`);

            expect(d.toDate().toString()).toBe(expectedTime);
        });

        it("reads an RFC2822-like string without timezone offset", () => {
            const d = new CronDate("Mon, 4 Jan 2021 10:00:00");

            expect(d.toDate().toString()).toBe(expectedTime);
        });

        it("reads SQL", () => {
            const d = new CronDate("2021-01-04 10:00:00");

            expect(d.toDate().toString()).toBe(expectedTime);
        });

        it("milliseconds", () => {
            const d = new CronDate(new Date("2021-01-04 10:00:00").valueOf());

            expect(d.toDate().toString()).toBe(expectedTime);
        });

        it("cronDate", () => {
            const date = new CronDate("Mon, 4 Jan 2021 10:00:00");
            const d = new CronDate(date);

            expect(d.toDate().toString()).toBe(expectedTime);
        });

        it("invalid", () => {
            expect(() => new CronDate("2021-01-4 10:00:00")).toThrow();
        });
    });

    describe("parse cron date formats with another timezone", () => {
        it("reads ISO 8601 without offset", () => {
            const d = new CronDate("2021-01-04T10:00:00", "Europe/Athens");

            expect(d.toISOString()).toBe("2021-01-04T08:00:00.000Z");
        });

        it("reads ISO 8601 with non-local offset", () => {
            const d = new CronDate("2021-01-04T10:00:00+01:00", "Europe/Athens");

            expect(d.toISOString()).toBe("2021-01-04T09:00:00.000Z");
        });

        it("reads RFC2822 with non-local offset", () => {
            const d = new CronDate("Mon, 4 Jan 2021 10:00:00 +0100", "Europe/Athens");

            expect(d.toISOString()).toBe("2021-01-04T09:00:00.000Z");
        });

        it("reads HTTP RFC 850", () => {
            const d = new CronDate("Sunday, 06-Nov-94 08:49:37 GMT", "Europe/Athens");

            expect(d.toISOString()).toBe("1994-11-06T08:49:37.000Z");
        });

        it("reads HTTP asctime as GMT", () => {
            const d = new CronDate("Sun Nov  6 08:49:37 1994", "Europe/Athens");

            expect(d.toISOString()).toBe("1994-11-06T08:49:37.000Z");
        });

        it("milliseconds", () => {
            const date = DateTime.fromISO("2021-01-04T11:00:00.000+02:00").valueOf();
            const d = new CronDate(date, "Europe/Athens");

            expect(d.toISOString()).toBe("2021-01-04T09:00:00.000Z");
        });

        it("with same timezone", () => {
            const date = new CronDate("Mon, 4 Jan 2021 10:00:00", "Europe/Athens");
            const d = new CronDate(date);

            expect(d.toISOString()).toBe("2021-01-04T08:00:00.000Z");
        });

        it("with different timezone", () => {
            const date = new CronDate("Mon, 4 Jan 2021 10:00:00", "America/New_York");
            const d = new CronDate(date, "Europe/Athens");

            expect(d.toISOString()).toBe("2021-01-04T15:00:00.000Z");
        });
    });

    describe("moving and reading a date", () => {
        it("goes back a month to the last second of that month", () => {
            const date = new CronDate("2021-03-15T10:20:30.000Z", "UTC");

            date.subtractMonth();

            expect(date.toISOString()).toBe("2021-02-28T23:59:59.000Z");
        });

        it("goes to the start and the end of its day", () => {
            const date = new CronDate("2021-03-15T10:20:30.123Z", "UTC");

            date.setStartOfDay();

            expect(date.toISOString()).toBe("2021-03-15T00:00:00.000Z");

            date.setEndOfDay();

            expect(date.toISOString()).toBe("2021-03-15T23:59:59.999Z");
        });

        it("sets the milliseconds", () => {
            const date = new CronDate("2021-03-15T10:20:30.123Z", "UTC");

            date.setMilliseconds(7);

            expect(date.getMilliseconds()).toBe(7);
            expect(date.toISOString()).toBe("2021-03-15T10:20:30.007Z");
        });

        it.each([
            ["2021-01-31T12:00:00Z", true],
            ["2021-02-28T12:00:00Z", true],
            ["2020-02-28T12:00:00Z", false],
            ["2020-02-29T12:00:00Z", true],
            ["2021-04-30T12:00:00Z", true],
            ["2021-04-29T12:00:00Z", false],
        ])("%s is the last day of its month: %s", (date, expected) => {
            expect(new CronDate(date, "UTC").isLastDayOfMonth()).toBe(expected);
        });

        it("accepts the unit names it exports", () => {
            const date = new CronDate("2021-03-15T10:20:30.000Z", "UTC");

            date.addUnit(TimeUnit.Day);

            expect(date.toISOString()).toBe("2021-03-16T00:00:00.000Z");
            expect(PublicTimeUnit).toBe(TimeUnit);
        });

        it("keeps its zone when copied, and moves to a new one on request", () => {
            const original = new CronDate("2021-07-01T12:00:00Z", "Europe/Berlin");

            expect(new CronDate(original).getHours()).toBe(14);
            expect(new CronDate(original, "UTC").getHours()).toBe(12);
        });
    });
});
