/**
 * The day of month field takes text besides numbers. `L` (the last day of the month) and `5L` (read as `L`, the way
 * `cron-parser` does) are the single-character ones. The rest come from Quartz: `LW` (the last weekday of the
 * month), `L-3` (three days before the month's last day) and `15W` (the weekday nearest the 15th, without leaving
 * the month).
 */
type LastDayOfMonth = { kind: "lastDayOfMonth" };
// eslint-disable-next-line no-secrets/no-secrets -- a dialect feature name, not a secret
type NumberedLastDayOfMonth = { kind: "numberedLastDayOfMonth" };
type LastOffset = { days: number; kind: "lastOffset" };
type LastWeekday = { kind: "lastWeekday" };
type NearestWeekday = { day: number; kind: "nearestWeekday" };
type DayOfMonthText = LastDayOfMonth | LastOffset | LastWeekday | NearestWeekday | NumberedLastDayOfMonth;

/** What the text looks like, before its numbers are checked. */
const SHAPE = /^(?:LW|L-(\d+)|(\d+)W)$/;

/** A number before an `L`, which the day of month ignores. */
const NUMBERED_LAST = /^\d{1,2}L$/;

const MAX_LAST_OFFSET = 30;
const MAX_DAY = 31;

/**
 * Reads one of the texts above.
 * @param text A day of month atom.
 * @returns What it asks for, or undefined when it is not one of these texts or a number in it is out of range.
 */
const readDayOfMonthText = (text: string): DayOfMonthText | undefined => {
    if (text === "L") {
        return { kind: "lastDayOfMonth" };
    }

    if (NUMBERED_LAST.test(text)) {
        // eslint-disable-next-line no-secrets/no-secrets -- a dialect feature name, not a secret
        return { kind: "numberedLastDayOfMonth" };
    }

    const match = SHAPE.exec(text);

    if (!match) {
        return undefined;
    }

    if (text === "LW") {
        return { kind: "lastWeekday" };
    }

    if (match[1] !== undefined) {
        const days = Number(match[1]);

        return days >= 1 && days <= MAX_LAST_OFFSET ? { days, kind: "lastOffset" } : undefined;
    }

    const day = Number(match[2]);

    return day >= 1 && day <= MAX_DAY ? { day, kind: "nearestWeekday" } : undefined;
};

/**
 * Whether text has the shape of one of the texts above, whatever its numbers.
 * @param text A day of month atom.
 * @returns True for `L`, `nL`, `LW`, `L-&lt;digits>` and `&lt;digits>W`.
 */
const looksLikeDayOfMonthText = (text: string): boolean => text === "L" || NUMBERED_LAST.test(text) || SHAPE.test(text);

/**
 * The same text with its numbers written plainly (`05W` becomes `5W`, `5L` becomes `L`), so equal schedules compare equal.
 * @param text A text `readDayOfMonthText` accepts.
 * @returns The normal form.
 */
const normalizeDayOfMonthText = (text: string): string => {
    const read = readDayOfMonthText(text);

    // eslint-disable-next-line no-secrets/no-secrets -- a dialect feature name, not a secret
    if (read?.kind === "lastDayOfMonth" || read?.kind === "numberedLastDayOfMonth") {
        return "L";
    }

    if (read?.kind === "lastOffset") {
        return `L-${String(read.days)}`;
    }

    if (read?.kind === "nearestWeekday") {
        return `${String(read.day)}W`;
    }

    return text;
};

export { looksLikeDayOfMonthText, normalizeDayOfMonthText, readDayOfMonthText };
export type { DayOfMonthText };
