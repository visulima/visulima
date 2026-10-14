/**
 * Time zone support built on a single primitive: the UTC offset (in minutes) a zone has at an instant.
 * Everything else (wall clock to instant resolution, DST gaps and overlaps) is plain arithmetic on top
 * of it, so the `Intl` and `Temporal` backends cannot disagree about DST semantics.
 */

type Fields = {
    day: number;
    hour: number;
    millisecond: number;
    minute: number;
    month: number;
    second: number;
    year: number;
};

type Zone = {
    /** Which implementation answers offset lookups. */
    backend: "intl" | "temporal" | "utc";
    /** Zone name as first given by the caller. */
    name: string;
    /** UTC offset in minutes at the given epoch milliseconds, remembered across calls. */
    offset: (epochMs: number) => number;
    /** The same lookup without the memory: for checking it. */
    rawOffset: (epochMs: number) => number;
    /** True for zones that never change offset from UTC. */
    utc: boolean;
};

/** The smallest slice of the TC39 Temporal API the offset lookup needs. */
type TemporalLike = {
    Instant: {
        fromEpochMilliseconds: (ms: number) => { toZonedDateTimeISO: (timeZone: string) => { offsetNanoseconds: number } };
    };
};

const MS_PER_MINUTE = 60_000;
const MS_PER_HOUR = 3_600_000;
const MS_PER_DAY = 86_400_000;

/** No offset in the tz database is wider than this (pre-1845 Manila reached 15:56), so a wall time is within it of every instant it can name. */
const MAX_OFFSET_MS = 16 * MS_PER_HOUR;

const UTC_ZONE: Zone = { backend: "utc", name: "UTC", offset: () => 0, rawOffset: () => 0, utc: true };

const UTC_NAME = /^(?:etc\/(?:gmt|utc)|gmt|utc)$/i;

/** Zones by lower-cased name, so `europe/london` and `Europe/London` share one entry. */
const zones = new Map<string, Zone>();

/** Days from 1970-01-01 to the first of a month, counting the proleptic Gregorian calendar (no `Date`, so no special years). */
const daysFromCivil = (year: number, month: number, day: number): number => {
    // The year starts in March, which puts the leap day at the end of it.
    const shifted = month <= 2 ? year - 1 : year;
    const era = Math.floor(shifted / 400);
    const yearOfEra = shifted - era * 400;
    const dayOfYear = Math.floor((153 * (month > 2 ? month - 3 : month + 9) + 2) / 5) + day - 1;
    const dayOfEra = yearOfEra * 365 + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100) + dayOfYear;

    return era * 146_097 + dayOfEra - 719_468;
};

/** The calendar date of a day counted from 1970-01-01. */
const civilFromDays = (days: number): { day: number; month: number; year: number } => {
    const shifted = days + 719_468;
    const era = Math.floor(shifted / 146_097);
    const dayOfEra = shifted - era * 146_097;
    const yearOfEra = Math.floor((dayOfEra - Math.floor(dayOfEra / 1460) + Math.floor(dayOfEra / 36_524) - Math.floor(dayOfEra / 146_096)) / 365);
    const dayOfYear = dayOfEra - (365 * yearOfEra + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100));
    const monthIndex = Math.floor((5 * dayOfYear + 2) / 153);
    const month = monthIndex < 10 ? monthIndex + 3 : monthIndex - 9;

    return { day: dayOfYear - Math.floor((153 * monthIndex + 2) / 5) + 1, month, year: yearOfEra + era * 400 + (month <= 2 ? 1 : 0) };
};

/** Wall clock fields read as if they were UTC. Out-of-range fields roll over, as they do in `Date.UTC`. */
const toLocalMs = (fields: Fields): number => {
    const { day, hour, millisecond, minute, month, second, year } = fields;
    const monthIndex = month - 1;
    const yearsOver = Math.floor(monthIndex / 12);
    const days = daysFromCivil(year + yearsOver, monthIndex - yearsOver * 12 + 1, 1) + day - 1;

    return days * MS_PER_DAY + hour * MS_PER_HOUR + minute * MS_PER_MINUTE + second * 1000 + millisecond;
};

/** Midnight of a calendar day read as if it were UTC. */
const startOfDay = (year: number, month: number, day: number): number => daysFromCivil(year, month, day) * MS_PER_DAY;

/** The weekday of a calendar day, 0 (Sunday) to 6 (Saturday). 1970-01-01 was a Thursday. */
const weekdayOf = (year: number, month: number, day: number): number => (((daysFromCivil(year, month, day) + 4) % 7) + 7) % 7;

const YEAR_ONE_MS = -62_135_596_800_000;

const intlFormatter = (name: string, era: boolean): Intl.DateTimeFormat =>
    new Intl.DateTimeFormat("en-US", {
        day: "numeric",
        era: era ? "short" : undefined,
        hour: "numeric",
        hourCycle: "h23",
        minute: "numeric",
        month: "numeric",
        second: "numeric",
        timeZone: name,
        year: "numeric",
    });

const createIntlOffset = (name: string): Zone["rawOffset"] => {
    const formatter = intlFormatter(name, false);
    // Only needed before year 1, where the year alone cannot tell 2 BC from 2 AD.
    let eraFormatter: Intl.DateTimeFormat | undefined;

    return (epochMs) => {
        let before = false;
        let day = 0;
        let hour = 0;
        let minute = 0;
        let month = 0;
        let second = 0;
        let year = 0;

        let used = formatter;

        if (epochMs < YEAR_ONE_MS) {
            eraFormatter ??= intlFormatter(name, true);
            used = eraFormatter;
        }

        for (const part of used.formatToParts(epochMs)) {
            const value = Number.parseInt(part.value, 10);

            switch (part.type) {
                case "day": {
                    day = value;
                    break;
                }
                case "era": {
                    before = part.value.startsWith("B");
                    break;
                }
                case "hour": {
                    // Some engines still emit 24 for midnight.
                    hour = value % 24;
                    break;
                }
                case "minute": {
                    minute = value;
                    break;
                }
                case "month": {
                    month = value;
                    break;
                }
                case "second": {
                    second = value;
                    break;
                }
                case "year": {
                    year = value;
                    break;
                }
                default:
            }
        }

        const asUtc = toLocalMs({ day, hour, millisecond: 0, minute, month, second, year: before ? 1 - year : year });
        // Drop the sub-second part so it cancels out of the difference.
        const truncated = epochMs - (((epochMs % 1000) + 1000) % 1000);

        return (asUtc - truncated) / MS_PER_MINUTE;
    };
};

const createTemporalOffset = (temporal: TemporalLike, name: string): Zone["rawOffset"] => {
    // Throws a RangeError for an unknown zone, which `getZone` turns into a descriptive error.
    temporal.Instant.fromEpochMilliseconds(0).toZonedDateTimeISO(name);

    // Temporal rejects fractional milliseconds; the offset does not change within one.
    return (epochMs) => temporal.Instant.fromEpochMilliseconds(Math.floor(epochMs)).toZonedDateTimeISO(name).offsetNanoseconds / 6e10;
};

/** A stretch of time over which a zone's offset is known to stay the same. */
type Segment = { end: number; offset: number; start: number };

/** Probes this far apart find a transition; every plateau between two transitions is longer (Morocco's Ramadan break is 29 days). */
const PROBE_STEP_MS = 10 * MS_PER_DAY;
/** A stretch reaches this far from the instant that made it, so a one-off lookup stays cheap. */
const MAX_REACH_MS = 60 * MS_PER_DAY;
const MAX_SEGMENTS = 4096;

/**
 * Wraps a raw offset lookup so it is not repeated across a stretch where the offset cannot have changed.
 * A stretch is found by probing outwards from the instant asked about, in steps that grow to ten days, until
 * the offset differs, then narrowing to the second where it changes. Each stretch costs a few dozen lookups
 * once and every later lookup inside it is free.
 */
const rememberOffsets = (raw: Zone["rawOffset"]): Zone["offset"] => {
    // Sorted by start, never overlapping.
    let segments: Segment[] = [];

    const indexOf = (epochMs: number): number => {
        let low = 0;
        let high = segments.length - 1;

        while (low <= high) {
            const middle = Math.floor((low + high) / 2);
            const segment = segments[middle] as Segment;

            if (epochMs < segment.start) {
                high = middle - 1;
            } else if (epochMs > segment.end) {
                low = middle + 1;
            } else {
                return middle;
            }
        }

        return -1 - low;
    };

    /** The farthest instant from `from`, in a direction, that is known to have `offset`, and stops at `limit`. */
    const reach = (from: number, offset: number, direction: 1 | -1, limit: number): number => {
        let known = from;
        let step = MS_PER_DAY;

        while (Math.abs(known - from) < MAX_REACH_MS) {
            const probe = direction === 1 ? Math.min(known + step, limit) : Math.max(known - step, limit);

            if (probe === known) {
                return known;
            }

            if (raw(probe) !== offset) {
                // Narrow to the second where it changes: `known` has the offset, `probe` does not.
                let near = known;
                let far = probe;

                while (Math.abs(far - near) > 1000) {
                    const middle = Math.floor((near + far) / 2000) * 1000;

                    if (raw(middle) === offset) {
                        near = middle;
                    } else {
                        far = middle;
                    }
                }

                return near;
            }

            known = probe;
            step = Math.min(step * 2, PROBE_STEP_MS);
        }

        return known;
    };

    return (epochMs) => {
        if (!Number.isFinite(epochMs)) {
            return raw(epochMs);
        }

        const found = indexOf(epochMs);

        if (found >= 0) {
            return (segments[found] as Segment).offset;
        }

        const offset = raw(epochMs);
        // The new stretch may not run into its neighbours.
        const before = segments[-2 - found];
        const after = segments[-1 - found];
        const start = reach(epochMs, offset, -1, before ? before.end + 1 : Number.NEGATIVE_INFINITY);
        const end = reach(epochMs, offset, 1, after ? after.start - 1 : Number.POSITIVE_INFINITY);

        if (segments.length >= MAX_SEGMENTS) {
            segments = [];
        }

        segments.splice(-1 - indexOf(epochMs), 0, { end, offset, start });

        return offset;
    };
};

/** The offset lookup for a zone: native `Temporal` when the runtime has it, `Intl` otherwise. */
const createLookup = (name: string): Pick<Zone, "backend" | "rawOffset"> => {
    const temporal = (globalThis as { Temporal?: TemporalLike }).Temporal;

    if (temporal?.Instant) {
        return { backend: "temporal", rawOffset: createTemporalOffset(temporal, name) };
    }

    const rawOffset = createIntlOffset(name);

    // Throws a RangeError for an unknown zone.
    rawOffset(0);

    return { backend: "intl", rawOffset };
};

/**
 * Resolves a zone by IANA name, preferring native `Temporal` when the runtime has it.
 * @throws {Error} When the zone is unknown.
 */
const getZone = (name: string): Zone => {
    if (UTC_NAME.test(name)) {
        return UTC_ZONE;
    }

    const key = name.toLowerCase();
    const cached = zones.get(key);

    if (cached) {
        return cached;
    }

    let lookup: Pick<Zone, "backend" | "rawOffset">;

    try {
        lookup = createLookup(name);
    } catch {
        throw new Error(`CronDate: unhandled timezone: ${name}`);
    }

    const zone: Zone = { ...lookup, name, offset: rememberOffsets(lookup.rawOffset), utc: false };

    zones.set(key, zone);

    return zone;
};

/** The zone the host runtime is configured for (`UTC` where there is none, such as workerd). */
const getSystemZone = (): Zone => getZone(new Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");

const isLeapYear = (year: number): boolean => (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;

const floorModule = (value: number, divisor: number): number => value - divisor * Math.floor(value / divisor);

const DAYS_IN_MONTHS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/** Days in a month, accepting months outside 1-12 by rolling into the neighbouring years. */
const daysInMonth = (year: number, month: number): number => {
    const normalizedMonth = floorModule(month - 1, 12) + 1;
    const normalizedYear = year + (month - normalizedMonth) / 12;

    if (normalizedMonth === 2) {
        return isLeapYear(normalizedYear) ? 29 : 28;
    }

    return DAYS_IN_MONTHS[normalizedMonth - 1] as number;
};

/** Wall clock fields of an instant seen from a given UTC offset. */
const toFields = (epochMs: number, offset: number): Fields => {
    // Whole milliseconds, truncated toward zero as `Date` does.
    const local = Math.trunc(epochMs + offset * MS_PER_MINUTE);
    const days = Math.floor(local / MS_PER_DAY);
    const timeOfDay = local - days * MS_PER_DAY;
    const { day, month, year } = civilFromDays(days);
    const hour = Math.floor(timeOfDay / MS_PER_HOUR);
    const minute = Math.floor((timeOfDay - hour * MS_PER_HOUR) / MS_PER_MINUTE);
    const second = Math.floor((timeOfDay - hour * MS_PER_HOUR - minute * MS_PER_MINUTE) / 1000);

    return { day, hour, millisecond: timeOfDay % 1000, minute, month, second, year };
};

/**
 * Finds the instant and offset for a wall clock time. `guess` is the offset to prefer when the wall
 * clock time happens twice (DST end), so a date keeps the occurrence it is already in. A time that
 * never happens (DST start) lands after the gap, shifted forward by the length of the gap.
 */
const resolveLocal = (localMs: number, guess: number, zone: Zone): [epochMs: number, offset: number] => {
    let utcGuess = localMs - guess * MS_PER_MINUTE;
    const second = zone.offset(utcGuess);

    if (second === guess) {
        return [utcGuess, guess];
    }

    utcGuess -= (second - guess) * MS_PER_MINUTE;

    const third = zone.offset(utcGuess);

    if (third === second) {
        return [utcGuess, second];
    }

    return [localMs - Math.min(second, third) * MS_PER_MINUTE, Math.max(second, third)];
};

type WallInstants = {
    /** The stretch of wall clock time that never shows, when the wall time is inside one. */
    gap?: { end: number; start: number };
    /** Real instants whose wall clock reads the given time: none in a DST gap, two in a DST overlap. */
    instants: number[];

    /**
     * Where a time that does not exist runs: the same minute of the first hour after the gap. Equals the first
     * instant otherwise. Absent when the gap is a whole day or more, which just drops those days.
     */
    landing: number | undefined;
    /** Largest and smallest UTC offset (in minutes) around the wall time. */
    maxOffset: number;
    minOffset: number;
};

/** The first second at which a zone's offset is no longer `before`, given that it is at `high` and was `before` at `low`. */
const findTransition = (zone: Zone, low: number, high: number, before: number): number => {
    let near = low;
    let far = high;

    while (far - near > 1000) {
        const middle = Math.floor((near + far) / 2000) * 1000;

        if (zone.offset(middle) === before) {
            near = middle;
        } else {
            far = middle;
        }
    }

    return far;
};

/**
 * Where a wall clock time that never happens sits: the stretch of wall time the gap hides, and the instant the time
 * runs at. `first` is the wall time read with the offset before the gap, which is already past the transition.
 */
const describeGap = (zone: Zone, wall: number, first: number, before: number, after: number): Pick<WallInstants, "gap" | "landing"> => {
    // The transition is no earlier than a gap's length before `first`.
    const transition = findTransition(zone, first - (after - before) * MS_PER_MINUTE, first, before);
    const start = transition + before * MS_PER_MINUTE;
    const end = transition + after * MS_PER_MINUTE;
    const wholeDay = end - start >= MS_PER_DAY;

    return { gap: { end, start }, landing: wholeDay ? undefined : transition + ((wall - start) % MS_PER_HOUR) };
};

/**
 * Finds every real instant at which a zone's wall clock reads `wall` (wall clock fields read as UTC).
 * The offset on each side of the wall time brackets any transition, so the two candidates `wall - offset`
 * are checked against the zone itself.
 */
const wallInstants = (zone: Zone, wall: number): WallInstants => {
    if (zone.utc) {
        return { instants: [wall], landing: wall, maxOffset: 0, minOffset: 0 };
    }

    const before = zone.offset(wall - MAX_OFFSET_MS);
    const after = zone.offset(wall + MAX_OFFSET_MS);
    const first = wall - before * MS_PER_MINUTE;

    if (before === after) {
        return { instants: [first], landing: first, maxOffset: before, minOffset: before };
    }

    const second = wall - after * MS_PER_MINUTE;
    const instants: number[] = [];

    if (zone.offset(first) === before) {
        instants.push(first);
    }

    if (second !== first && zone.offset(second) === after) {
        instants.push(second);
    }

    instants.sort((a, b) => a - b);

    const offsets = { maxOffset: Math.max(before, after), minOffset: Math.min(before, after) };

    if (instants.length > 0 || after < before) {
        return { instants, landing: instants[0] ?? first, ...offsets };
    }

    return { ...describeGap(zone, wall, first, before, after), instants, ...offsets };
};

export { getSystemZone, getZone, MAX_OFFSET_MS, MS_PER_DAY, MS_PER_HOUR, MS_PER_MINUTE, resolveLocal, toFields, toLocalMs, wallInstants };
export { daysInMonth, isLeapYear, startOfDay, weekdayOf };
export type { Fields, WallInstants, Zone };
