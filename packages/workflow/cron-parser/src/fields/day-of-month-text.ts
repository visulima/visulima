/**
 * The day of month field takes three kinds of text besides numbers, all from Quartz: `LW` (the last weekday of the
 * month), `L-3` (three days before the month's last day) and `15W` (the weekday nearest the 15th, without leaving
 * the month). A plain `L`, the last day itself, is handled with the other single characters.
 */
type LastOffset = { days: number; kind: "lastOffset" };
type LastWeekday = { kind: "lastWeekday" };
type NearestWeekday = { day: number; kind: "nearestWeekday" };
type DayOfMonthText = LastOffset | LastWeekday | NearestWeekday;

/** What the text looks like, before its numbers are checked. */
const SHAPE = /^(?:LW|L-(\d+)|(\d+)W)$/;

const MAX_LAST_OFFSET = 30;
const MAX_DAY = 31;

/**
 * Reads one of the texts above.
 * @param text A day of month atom.
 * @returns What it asks for, or undefined when it is not one of these texts or a number in it is out of range.
 */
const readDayOfMonthText = (text: string): DayOfMonthText | undefined => {
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
 * @returns True for `LW`, `L-&lt;digits>` and `&lt;digits>W`.
 */
const looksLikeDayOfMonthText = (text: string): boolean => SHAPE.test(text);

/**
 * The same text with its numbers written plainly (`05W` becomes `5W`), so equal schedules compare equal.
 * @param text A text `readDayOfMonthText` accepts.
 * @returns The normal form.
 */
const normalizeDayOfMonthText = (text: string): string => {
    const read = readDayOfMonthText(text);

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
