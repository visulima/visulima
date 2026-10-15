import type { Fields } from "./zone";
import { daysInMonth, toLocalMs } from "./zone";

type ParsedDate = {
    fields: Fields;
    /** UTC offset in minutes when the string carried one; otherwise the fields are wall clock time in the target zone. */
    offset?: number;
};

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

const OBSOLETE_ZONES: Record<string, number> = { CDT: -300, CST: -360, EDT: -240, EST: -300, GMT: 0, MDT: -360, MST: -420, PDT: -420, PST: -480, UT: 0, Z: 0 };

// The four grammars below are fixed and complex only because they name every month, weekday and offset form.
/* eslint-disable sonarjs/regex-complexity */
// ISO 8601 / SQL date times: `2020-05-01`, `2020-05-01T15:00`, `2020-05-01 15:00:00.123 +02:00`, `20200501T150000Z`.
const ISO = /^(\d{4})(?:-?(\d{2})(?:-?(\d{2})(?:[T ](\d{2})(?::?(\d{2})(?::?(\d{2})(?:[.,](\d{1,9}))?)?)?)?)?)?\s*(Z|[+-]\d{2}(?::?\d{2})?)?$/i;
// prettier-ignore
const RFC_2822
    = /^(?:(Mon|Tue|Wed|Thu|Fri|Sat|Sun),\s*)?(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{2,4})\s+(\d{2}):(\d{2})(?::(\d{2}))?(?:\s*(UT|GMT|[ECMP][SD]T|Z)|\s*([+-])(\d{2}):?(\d{2}))?$/i;
// prettier-ignore
const RFC_850
    = /^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),\s*(\d{2})-(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})\s+GMT$/i;
const ASCTIME = /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})\s+(\d{2}):(\d{2}):(\d{2})\s+(\d{4})$/i;
/* eslint-enable sonarjs/regex-complexity */

/** Two-digit years: 61-99 are 19xx, 00-60 are 20xx. */
const expandYear = (year: number, digits: number): number => {
    if (digits > 2) {
        return year;
    }

    return year > 60 ? 1900 + year : 2000 + year;
};

const parseOffset = (value: string): number => {
    if (value.toUpperCase() === "Z") {
        return 0;
    }

    const sign = value.startsWith("-") ? -1 : 1;
    const digits = value.slice(1).replace(":", "");

    return sign * (Number.parseInt(digits.slice(0, 2), 10) * 60 + Number.parseInt(digits.slice(2) || "0", 10));
};

/** Rejects out-of-range fields and weekday names that do not match the date. */
const validate = (fields: Fields, weekday?: string): boolean => {
    const { day, hour, millisecond, minute, month, second, year } = fields;

    if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month) || hour > 23 || minute > 59 || second > 59 || millisecond > 999) {
        return false;
    }

    return weekday === undefined || WEEKDAYS[new Date(toLocalMs(fields)).getUTCDay()] === weekday.slice(0, 3).toLowerCase();
};

const finish = (fields: Fields, offset: number | undefined, weekday?: string): ParsedDate | undefined => {
    if (!validate(fields, weekday)) {
        return undefined;
    }

    return offset === undefined ? { fields } : { fields, offset };
};

/**
 * Parses ISO 8601 / SQL, RFC 2822 and HTTP (RFC 1123, RFC 850, asctime) date strings.
 * A string without an offset is wall clock time, left for the caller to place in a zone.
 * @returns `undefined` when the string matches none of the formats or names an impossible date.
 */
const parseDateString = (input: string): ParsedDate | undefined => {
    const text = input.trim();

    let match = ISO.exec(text);

    if (match) {
        const [, year, month = "1", day = "1", hour = "0", minute = "0", second = "0", fraction = "0", zone] = match;

        return finish(
            {
                day: Number(day),
                hour: Number(hour),
                // Only millisecond precision is kept.
                millisecond: Number(fraction.padEnd(3, "0").slice(0, 3)),
                minute: Number(minute),
                month: Number(month),
                second: Number(second),
                year: Number(year),
            },
            zone === undefined ? undefined : parseOffset(zone),
        );
    }

    match = RFC_2822.exec(text);

    if (match) {
        const [, weekday, day, month, year, hour, minute, second = "0", named, sign, offsetHours, offsetMinutes] = match;
        let offset = sign === undefined ? undefined : parseOffset(`${sign}${offsetHours as string}${offsetMinutes as string}`);

        if (named !== undefined) {
            offset = OBSOLETE_ZONES[named.toUpperCase()];
        }

        return finish(
            {
                day: Number(day),
                hour: Number(hour),
                millisecond: 0,
                minute: Number(minute),
                month: MONTHS.indexOf((month as string).toLowerCase()) + 1,
                second: Number(second),
                year: expandYear(Number(year), (year as string).length),
            },
            offset,
            weekday,
        );
    }

    match = RFC_850.exec(text);

    if (match) {
        const [, weekday, day, month, year, hour, minute, second] = match;

        return finish(
            {
                day: Number(day),
                hour: Number(hour),
                millisecond: 0,
                minute: Number(minute),
                month: MONTHS.indexOf((month as string).toLowerCase()) + 1,
                second: Number(second),
                year: expandYear(Number(year), 2),
            },
            0,
            weekday,
        );
    }

    match = ASCTIME.exec(text);

    if (match) {
        const [, weekday, month, day, hour, minute, second, year] = match;

        return finish(
            {
                day: Number(day),
                hour: Number(hour),
                millisecond: 0,
                minute: Number(minute),
                month: MONTHS.indexOf((month as string).toLowerCase()) + 1,
                second: Number(second),
                year: Number(year),
            },
            0,
            weekday,
        );
    }

    return undefined;
};

export { parseDateString };
export type { ParsedDate };
