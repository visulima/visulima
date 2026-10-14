import { describe, expect, it } from "vitest";

import { seededRandom } from "../src/utils/random";
import { toFields, toLocalMs, weekdayOf } from "../src/zone";

/**
 * The calendar arithmetic is plain integer maths with no `Date` in it, because building a `Date` to read a field back
 * was most of the cost of a search. These tests hold it to what `Date` says.
 */
const random = seededRandom("calendar arithmetic");
const between = (low: number, high: number): number => low + Math.floor(random() * (high - low + 1));

/** `Date.UTC` maps years 0-99 to 1900-1999, so those years are done a whole 400 year cycle later and shifted back. */
const CYCLE_MS = 146_097 * 86_400_000;

const referenceLocalMs = (year: number, month: number, day: number, hour: number, minute: number, second: number, millisecond: number): number => {
    if (year >= 0 && year < 100) {
        return Date.UTC(year + 400, month - 1, day, hour, minute, second, millisecond) - CYCLE_MS;
    }

    return Date.UTC(year, month - 1, day, hour, minute, second, millisecond);
};

describe("calendar arithmetic", () => {
    it("reads the fields of an instant as Date does, in any offset", () => {
        expect.assertions(1);

        const wrong: string[] = [];

        for (let index = 0; index < 200_000; index += 1) {
            // Mostly everyday dates, some anywhere in Date's range; offsets in minutes, with a fractional part now and then.
            const fraction = index % 7 === 0 ? 0.5 : 0;
            const epoch = index % 5 === 0 ? between(-8.64e15 + 1e12, 8.64e15 - 1e12) : between(-4e12, 4e12) + fraction;
            const offset = between(-960, 960) + (index % 11 === 0 ? 0.0333 : 0);
            const date = new Date(epoch + offset * 60_000);
            const fields = toFields(epoch, offset);
            const expected = [
                date.getUTCFullYear(),
                date.getUTCMonth() + 1,
                date.getUTCDate(),
                date.getUTCHours(),
                date.getUTCMinutes(),
                date.getUTCSeconds(),
                date.getUTCMilliseconds(),
            ];
            const actual = [fields.year, fields.month, fields.day, fields.hour, fields.minute, fields.second, fields.millisecond];

            if (expected.join(",") !== actual.join(",") && wrong.length < 3) {
                wrong.push([epoch, offset, "expected", expected.join(","), "got", actual.join(",")].join(" "));
            }
        }

        expect(wrong).toStrictEqual([]);
    });

    it("builds a time from fields as Date.UTC does, including fields that overflow", () => {
        expect.assertions(1);

        const wrong: string[] = [];

        for (let index = 0; index < 200_000; index += 1) {
            // Years 0-99 and negative years included, months and days well outside their ranges.
            const year = index % 3 === 0 ? between(0, 99) : between(-300, 12_000);
            const [month, day, hour, minute, second, millisecond] = [
                between(-30, 40),
                between(-120, 150),
                between(-60, 90),
                between(-200, 300),
                between(-200, 300),
                between(-2000, 3000),
            ] as [number, number, number, number, number, number];
            const expected = referenceLocalMs(year, month, day, hour, minute, second, millisecond);
            const actual = toLocalMs({ day, hour, millisecond, minute, month, second, year });

            if (expected !== actual && wrong.length < 3) {
                wrong.push([year, month, day, hour, minute, second, millisecond, "expected", expected, "got", actual].join(" "));
            }
        }

        expect(wrong).toStrictEqual([]);
    });

    it("round trips a time through its fields", () => {
        expect.assertions(1);

        const wrong: number[] = [];

        for (let index = 0; index < 100_000; index += 1) {
            const epoch = between(-8e15, 8e15);
            const { day, hour, millisecond, minute, month, second, year } = toFields(epoch, 0);

            if (toLocalMs({ day, hour, millisecond, minute, month, second, year }) !== epoch && wrong.length < 3) {
                wrong.push(epoch);
            }
        }

        expect(wrong).toStrictEqual([]);
    });

    it("finds the weekday as Date does", () => {
        expect.assertions(1);

        const wrong: string[] = [];

        for (let index = 0; index < 100_000; index += 1) {
            const year = between(-2000, 6000);
            const month = between(1, 12);
            const day = between(1, 28);
            const expected = new Date(referenceLocalMs(year, month, day, 0, 0, 0, 0)).getUTCDay();

            if (weekdayOf(year, month, day) !== expected && wrong.length < 3) {
                wrong.push([year, month, day].join("-"));
            }
        }

        expect(wrong).toStrictEqual([]);
    });

    it("handles the edges of the calendar", () => {
        expect.assertions(5);

        // 2000 is a leap year, 1900 and 2100 are not.
        expect(toFields(Date.UTC(2000, 1, 29), 0).day).toBe(29);
        expect(toFields(Date.UTC(1900, 1, 28) + 86_400_000, 0)).toMatchObject({ day: 1, month: 3 });
        expect(toFields(Date.UTC(2100, 1, 28) + 86_400_000, 0)).toMatchObject({ day: 1, month: 3 });
        expect(toFields(-1, 0)).toMatchObject({ day: 31, hour: 23, millisecond: 999, month: 12, year: 1969 });
        expect(weekdayOf(1970, 1, 1)).toBe(4);
    });
});
