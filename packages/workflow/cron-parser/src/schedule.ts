import type { Fields, Zone } from "./zone";
import { daysInMonth, MAX_OFFSET_MS, MS_PER_DAY, MS_PER_HOUR, MS_PER_MINUTE, startOfDay, toFields, toLocalMs, wallInstants, weekdayOf } from "./zone";

/** Which calendar days an expression accepts, as plain numbers. Day of month and day of week combine with OR when both are restricted, as in Vixie cron. */
type DaySpec = {
    /** Some rule depends on the month's length or on weekdays (`L`, `L-n`, `LW`, `nW`), so days cannot be skipped by number. */
    dynamic: boolean;
    /** The month's last day is accepted (`L`). */
    lastDay: boolean;
    /** Days before the month's last day that are accepted (`L-3`). */
    lastOffsets: ReadonlyArray<number>;
    /** The last weekday (Monday to Friday) of the month is accepted (`LW`). */
    lastWeekday: boolean;
    /** Weekdays (0 is Sunday) accepted only on their last occurrence in the month (`5L`). */
    lastWeekdays: ReadonlyArray<number>;
    /** The day of month field is a list rather than `*`. */
    monthDayRestricted: boolean;
    monthDays: ReadonlyArray<number>;
    /** Days whose nearest weekday in the same month is accepted (`15W`). */
    nearestWeekdays: ReadonlyArray<number>;
    /** Only the nth occurrence of the weekday counts (`1#2`); 0 for any. */
    nthWeekday: number;
    /** The day of week field is a list rather than `*`. */
    weekdayRestricted: boolean;
    weekdays: ReadonlyArray<number>;
};

/** What a cron expression asks for, reduced to plain sorted numbers. */
type ScheduleSpec = {
    days: DaySpec;
    hours: ReadonlyArray<number>;
    minutes: ReadonlyArray<number>;
    months: ReadonlyArray<number>;
    /** False when the expression runs in every hour of the day. */
    restrictedHours: boolean;
    seconds: ReadonlyArray<number>;
};

type Direction = 1 | -1;

type Budget = { spend: () => boolean };

/** Steps one search may take through the calendar before the expression is judged unsatisfiable. */
const LOOP_LIMIT = 10_000;

const SECOND = 1000;

/** The last Monday-to-Friday of a month with `last` days. */
const lastWeekdayOf = (year: number, month: number, last: number): number => {
    const weekday = weekdayOf(year, month, last);

    if (weekday === 6) {
        return last - 1;
    }

    return weekday === 0 ? last - 2 : last;
};

/** The weekday nearest `day` without leaving the month, or 0 when the month is shorter than `day`. */
const nearestWeekdayOf = (year: number, month: number, day: number, last: number): number => {
    if (day > last) {
        return 0;
    }

    const weekday = weekdayOf(year, month, day);

    if (weekday === 6) {
        // The Friday before, except on the 1st, where the Monday after stays in the month.
        return day === 1 ? 3 : day - 1;
    }

    if (weekday === 0) {
        // The Monday after, except on the last day, where the Friday before stays in the month.
        return day === last ? day - 2 : day + 1;
    }

    return day;
};

/** Whether the day of month field accepts a day. */
const matchesMonthDay = (spec: DaySpec, year: number, month: number, day: number): boolean => {
    if (spec.monthDays.includes(day)) {
        return true;
    }

    if (!spec.dynamic) {
        return false;
    }

    const last = daysInMonth(year, month);

    const byLastDay = spec.lastDay && day === last;
    const byOffset = spec.lastOffsets.some((offset) => day === last - offset);
    const byLastWeekday = spec.lastWeekday && day === lastWeekdayOf(year, month, last);
    const byNearestWeekday = spec.nearestWeekdays.some((nearest) => day === nearestWeekdayOf(year, month, nearest, last));

    return byLastDay || byOffset || byLastWeekday || byNearestWeekday;
};

/** Whether the day of week field accepts a day. */
const matchesWeekday = (spec: DaySpec, year: number, month: number, day: number): boolean => {
    const weekday = weekdayOf(year, month, day);
    const byNthWeekday = spec.weekdays.includes(weekday) && (spec.nthWeekday <= 0 || Math.ceil(day / 7) === spec.nthWeekday);

    return byNthWeekday || (day > daysInMonth(year, month) - 7 && spec.lastWeekdays.includes(weekday));
};

/** Whether a calendar day is accepted by the day of month and day of week fields. */
const matchesDay = (spec: DaySpec, year: number, month: number, day: number): boolean => {
    if (!spec.weekdayRestricted) {
        return !spec.monthDayRestricted || matchesMonthDay(spec, year, month, day);
    }

    if (!spec.monthDayRestricted) {
        return matchesWeekday(spec, year, month, day);
    }

    return matchesMonthDay(spec, year, month, day) || matchesWeekday(spec, year, month, day);
};

const nearest = (values: ReadonlyArray<number>, value: number, forward: boolean): number | undefined => {
    if (forward) {
        return values.find((candidate) => candidate >= value);
    }

    return values.findLast((candidate) => candidate <= value);
};

/** A wall clock time from its parts, read as if it were UTC. Months and times that overflow roll over. */
const at = (year: number, month: number, day: number, hour = 0, minute = 0, second = 0): number => {
    const fields: Fields = { day, hour, millisecond: 0, minute, month, second, year };

    return toLocalMs(fields);
};

type Parts = Fields;

/** The first second of the next day going forward, the last second of the previous one going back. */
const nextDay = ({ day, month, year }: Parts, forward: boolean): number => {
    const start = startOfDay(year, month, day);

    return forward ? start + MS_PER_DAY : start - SECOND;
};

/** Where to look next when the month does not match, or undefined when it does. */
const jumpMonth = (spec: ScheduleSpec, { month, year }: Parts, forward: boolean): number | undefined => {
    if (spec.months.includes(month)) {
        return undefined;
    }

    const target = nearest(spec.months, forward ? month + 1 : month - 1, forward);

    if (forward) {
        return target === undefined ? at(year + 1, spec.months[0] as number, 1) : at(year, target, 1);
    }

    // The last second of the closest earlier matching month.
    return target === undefined ? at(year - 1, (spec.months.at(-1) as number) + 1, 1) - SECOND : at(year, target + 1, 1) - SECOND;
};

/**
 * Where to look next when the day does not match, or undefined when it does. When only the day of month is
 * restricted, it goes straight to the next day that field names rather than trying every day between.
 */
const jumpDay = (spec: ScheduleSpec, parts: Parts, forward: boolean): number | undefined => {
    const { days } = spec;

    if (matchesDay(days, parts.year, parts.month, parts.day)) {
        return undefined;
    }

    if (days.weekdayRestricted || days.dynamic) {
        return nextDay(parts, forward);
    }

    const { day, month, year } = parts;
    const lastDay = daysInMonth(year, month);
    const target = nearest(days.monthDays, forward ? day + 1 : day - 1, forward);

    if (forward) {
        // A day the month is too short for (the 31st of April) never comes, so move on to the next month.
        return target !== undefined && target <= lastDay ? at(year, month, target) : at(year, month + 1, 1);
    }

    return target === undefined ? at(year, month, 1) - SECOND : at(year, month, target, 23, 59, 59);
};

const jumpHour = (spec: ScheduleSpec, parts: Parts, forward: boolean): number | undefined => {
    const target = nearest(spec.hours, parts.hour, forward);

    if (target === undefined) {
        return nextDay(parts, forward);
    }

    if (target === parts.hour) {
        return undefined;
    }

    const edge = forward ? 0 : 59;

    return at(parts.year, parts.month, parts.day, target, edge, edge);
};

const jumpMinute = (spec: ScheduleSpec, { day, hour, minute, month, year }: Parts, forward: boolean): number | undefined => {
    const target = nearest(spec.minutes, minute, forward);

    if (target === undefined) {
        return forward ? at(year, month, day, hour + 1) : at(year, month, day, hour) - SECOND;
    }

    if (target === minute) {
        return undefined;
    }

    return at(year, month, day, hour, target, forward ? 0 : 59);
};

const jumpSecond = (spec: ScheduleSpec, { day, hour, minute, month, second, year }: Parts, forward: boolean): number | undefined => {
    const target = nearest(spec.seconds, second, forward);

    if (target === undefined) {
        return forward ? at(year, month, day, hour, minute + 1) : at(year, month, day, hour, minute) - SECOND;
    }

    if (target === second) {
        return undefined;
    }

    return at(year, month, day, hour, minute, target);
};

/** The first check that rejects the wall time names the nearest one worth trying instead; undefined when every unit matches. */
const nextJump = (spec: ScheduleSpec, parts: Parts, forward: boolean): number | undefined => {
    let jump = jumpMonth(spec, parts, forward);

    jump ??= jumpDay(spec, parts, forward);
    jump ??= jumpHour(spec, parts, forward);
    jump ??= jumpMinute(spec, parts, forward);
    jump ??= jumpSecond(spec, parts, forward);

    return jump;
};

/** Counts the steps a search takes, so an expression that can never match ends instead of looping. */
const createBudget = (): Budget => {
    let steps = 0;

    return {
        spend: () => {
            steps += 1;

            return steps <= LOOP_LIMIT;
        },
    };
};

/**
 * The closest wall clock time that the expression matches, at or after `from` going forward and at or before
 * it going back. Calendar arithmetic only: a non-matching month or day is skipped whole, so sparse schedules
 * cost a handful of steps.
 * @returns The wall clock time, `"bounds"` once past `limit`, or `"loop"` when the step budget runs out.
 */
const nearestWall = (spec: ScheduleSpec, from: number, forward: boolean, limit: number | undefined, budget: Budget): number | "bounds" | "loop" => {
    let current = from;

    while (budget.spend()) {
        if (limit !== undefined && (forward ? current > limit : current < limit)) {
            return "bounds";
        }

        const jump = nextJump(spec, toFields(current, 0), forward);

        if (jump === undefined) {
            return current;
        }

        current = jump;
    }

    return "loop";
};

type Candidates = { gap?: { end: number; start: number }; maxOffset: number; minOffset: number; runs: number[] };

/**
 * The runs a wall clock time stands for, under the DST rules.
 * A time that does not exist runs after the gap, but only for an expression that names its hours: an every-hour
 * schedule just skips the missing hour. A time that happens twice runs once, at the earlier pass, for an
 * expression that names its hours, and at both passes for an every-hour schedule.
 */
const runsAt = (spec: ScheduleSpec, zone: Zone, wall: number): Candidates => {
    const { gap, instants, landing, maxOffset, minOffset } = wallInstants(zone, wall);

    if (instants.length === 0) {
        return { gap, maxOffset, minOffset, runs: spec.restrictedHours && landing !== undefined ? [landing] : [] };
    }

    return { maxOffset, minOffset, runs: instants.length === 2 && spec.restrictedHours ? [instants[0] as number] : instants };
};

/** The closest of `best` and the candidates that lie strictly past `from` in the direction of travel. */
const closest = (best: number | undefined, candidates: number[], from: number, forward: boolean): number | undefined => {
    let result = best;

    for (const candidate of candidates) {
        const pastFrom = forward ? candidate > from : candidate < from;
        const isCloser = result === undefined || (forward ? candidate < result : candidate > result);

        if (pastFrom && isCloser) {
            result = candidate;
        }
    }

    return result;
};

/**
 * Whether a run is certain to be the closest: any later wall clock time is at least a second further on, and
 * maps to an instant no nearer than that allows.
 */
const isSettled = (best: number, wall: number, forward: boolean, maxOffset: number, minOffset: number): boolean => {
    if (forward) {
        return wall + SECOND - maxOffset * MS_PER_MINUTE >= best;
    }

    return wall - SECOND - minOffset * MS_PER_MINUTE <= best;
};

/**
 * The wall clock time to start searching from: no later (going forward) or earlier (going back) than any wall clock
 * time that could belong to a run. Instants past the cursor have the offsets from the cursor on, and a time skipped
 * by a gap lands within an hour of the transition using the offset from before it, so going forward the hour before
 * the cursor counts too. Instants before the cursor have offsets from before it, so going back only the past counts.
 * Looking further than that would start the search far from the cursor and walk the wall clock times in between.
 */
const startingWall = (zone: Zone, from: number, forward: boolean): number => {
    const past = zone.offset(from - (forward ? MS_PER_HOUR : 2 * MS_PER_DAY));
    const now = zone.offset(from);
    const origin = from + (forward ? Math.min(past, now, zone.offset(from + 2 * MS_PER_DAY)) : Math.max(past, now)) * MS_PER_MINUTE;

    return forward ? Math.ceil(origin / SECOND) * SECOND : Math.floor(origin / SECOND) * SECOND;
};

/** Where to look after a wall clock time: the next second, or straight across the gap it is in when nothing in the gap can run. */
const nextCursor = (wall: number, forward: boolean, gapToSkip?: { end: number; start: number }): number => {
    if (gapToSkip) {
        return forward ? gapToSkip.end : gapToSkip.start - SECOND;
    }

    return forward ? wall + SECOND : wall - SECOND;
};

type Step = { best: number | undefined; cursor: number; settled: boolean };

/** Looks at one wall clock time: the closest run so far, whether that is final, and where to look next. */
const visit = (spec: ScheduleSpec, zone: Zone, wall: number, best: number | undefined, from: number, forward: boolean): Step => {
    const { gap, maxOffset, minOffset, runs } = runsAt(spec, zone, wall);
    const closer = closest(best, runs, from, forward);

    return {
        best: closer,
        cursor: nextCursor(wall, forward, runs.length === 0 ? gap : undefined),
        settled: closer !== undefined && isSettled(closer, wall, forward, maxOffset, minOffset),
    };
};

/**
 * The run closest to `from` in the given direction, strictly after or strictly before it.
 *
 * A run is a real instant whose wall clock time in `zone` matches the expression, under the DST rules of
 * `runsAt`. Wall clock order differs from time order around a transition, so the search starts a transition's
 * width before `from` and keeps going until no later wall clock time can still produce a closer instant.
 * @param spec What the expression asks for.
 * @param zone The time zone the expression is read in.
 * @param from The cursor, in epoch milliseconds.
 * @param direction 1 for the next run, -1 for the previous one.
 * @param bound Instant past which nothing is wanted: the end date going forward, the start date going back.
 * @returns The run, `"bounds"` when there is none before `bound`, or `"loop"` when none could be found.
 */
const findRun = (spec: ScheduleSpec, zone: Zone, from: number, direction: Direction, bound?: number): number | "bounds" | "loop" => {
    const forward = direction === 1;
    // A wall clock time further than this past the bound cannot map back inside it.
    const reach = forward ? MAX_OFFSET_MS : -MAX_OFFSET_MS;
    const limit = bound === undefined ? undefined : bound + reach;
    const budget = createBudget();
    let cursor = startingWall(zone, from, forward);
    let best: number | undefined;

    for (;;) {
        const wall = nearestWall(spec, cursor, forward, limit, budget);

        if (typeof wall === "string") {
            // The search ran out of calendar or budget. A run found before that is still the closest seen: the
            // early stop in `isSettled` is conservative, so running out first does not make it wrong.
            return best ?? wall;
        }

        const step = visit(spec, zone, wall, best, from, forward);

        if (step.best !== undefined && step.settled) {
            return step.best;
        }

        ({ best, cursor } = step);
    }
};

export { findRun };
export type { DaySpec, ScheduleSpec };
