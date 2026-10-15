import { parseDateString } from "./parse-date";
import type { Fields, Zone } from "./zone";
import { daysInMonth, getSystemZone, getZone, MS_PER_HOUR, MS_PER_MINUTE, resolveLocal, toFields, toLocalMs, weekdayOf } from "./zone";

/**
 * The units `addUnit` and `subtractUnit` move by.
 *
 * Written as an explicit union rather than `(typeof TimeUnit)[keyof typeof TimeUnit]`, because a type
 * alias that shares its name with the `const` it derives from makes the dts bundler emit an invalid
 * `type TimeUnit: { … } = …`. The mapped type on the `const` makes the compiler check the two against
 * each other: a unit missing from either side fails to compile.
 */
type TimeUnit = "Day" | "Hour" | "Minute" | "Month" | "Second" | "Year";

const TimeUnit: { readonly [Unit in TimeUnit]: Unit } = {
    Day: "Day",
    Hour: "Hour",
    Minute: "Minute",
    Month: "Month",
    Second: "Second",
    Year: "Year",
};

/** Calendar units move the wall clock; the rest move elapsed time. */
type Delta = { days?: number; months?: number; ms?: number; years?: number };

type StepEdge = "day" | "hour" | "minute" | "month";

type Edge = StepEdge | "second";

/** How far each unit moves, and the edge of the unit it then lands on (none for a year or a second). */
const STEPS: Record<TimeUnit, { delta: Delta; edge?: StepEdge }> = {
    Day: { delta: { days: 1 }, edge: "day" },
    Hour: { delta: { ms: MS_PER_HOUR }, edge: "hour" },
    Minute: { delta: { ms: MS_PER_MINUTE }, edge: "minute" },
    Month: { delta: { months: 1 }, edge: "month" },
    Second: { delta: { ms: 1000 } },
    Year: { delta: { years: 1 } },
};

const pad = (value: number, length: number): string => String(value).padStart(length, "0");

/** Epoch milliseconds for a date, number or date string; a string without an offset is wall clock time in `zone`. */
const resolveTimestamp = (timestamp: Date | number | string | undefined, zone: Zone): number => {
    let ts = Number.NaN;

    if (timestamp === undefined) {
        ts = Date.now();
    } else if (timestamp instanceof Date) {
        ts = timestamp.getTime();
    } else if (typeof timestamp === "number") {
        ts = timestamp;
    } else {
        const parsed = parseDateString(timestamp);

        if (parsed) {
            const local = toLocalMs(parsed.fields);

            ts = parsed.offset === undefined ? resolveLocal(local, zone.offset(local), zone)[0] : local - parsed.offset * MS_PER_MINUTE;
        }
    }

    // Beyond +-8.64e15 ms `Date` itself has no valid value.
    if (!Number.isFinite(ts) || Math.abs(ts) > 8.64e15) {
        throw new TypeError(`CronDate: unhandled timestamp: ${String(timestamp)}`);
    }

    return ts;
};

/**
 * A mutable point in time, read and moved on the wall clock of one time zone.
 *
 * Wall clock arithmetic follows the calendar (a day after is the same time tomorrow, even across
 * DST), while hour, minute and second arithmetic follows elapsed time.
 */
class CronDate {
    #ts: number;

    #offset: number;

    /** Calendar fields of the date, worked out when first asked for: most dates are only ever read as a timestamp. */
    #calendar?: Fields;

    #zone: Zone;

    /**
     * Constructs a new CronDate instance.
     * @param timestamp A date, epoch milliseconds, a date string or another CronDate. Defaults to now.
     * A string without an offset is read as wall clock time in `tz`.
     * @param tz IANA time zone to read the date in. Defaults to the zone of a CronDate input, else the system zone.
     * @throws {Error} When the timestamp cannot be understood or the time zone is unknown.
     */
    public constructor(timestamp?: CronDate | Date | number | string, tz?: string) {
        const requested = tz === undefined ? undefined : getZone(tz);

        if (timestamp instanceof CronDate) {
            this.#zone = requested ?? timestamp.#zone;
            this.#ts = timestamp.#ts;
            this.#offset = timestamp.#offset;
            this.#calendar = timestamp.#calendar;

            if (this.#zone !== timestamp.#zone) {
                this.#reread(this.#ts);
            }

            return;
        }

        this.#zone = requested ?? getSystemZone();

        const ts = resolveTimestamp(timestamp, this.#zone);

        this.#ts = ts;
        this.#offset = this.#zone.offset(ts);
    }

    /**
     * The time zone this date is read in.
     * @internal
     */
    public get zone(): Zone {
        return this.#zone;
    }

    /**
     * Adds one year to the current CronDate.
     */
    public addYear(): void {
        this.#step("Year", 1);
    }

    /**
     * Adds one month to the current CronDate, landing on the start of that month.
     */
    public addMonth(): void {
        this.#step("Month", 1);
    }

    /**
     * Adds one day to the current CronDate, landing on the start of that day.
     */
    public addDay(): void {
        this.#step("Day", 1);
    }

    /**
     * Adds one hour to the current CronDate, landing on the start of that hour.
     */
    public addHour(): void {
        this.#step("Hour", 1);
    }

    /**
     * Adds one minute to the current CronDate, landing on the start of that minute.
     */
    public addMinute(): void {
        this.#step("Minute", 1);
    }

    /**
     * Adds one second to the current CronDate.
     */
    public addSecond(): void {
        this.#step("Second", 1);
    }

    /**
     * Subtracts one year from the current CronDate.
     */
    public subtractYear(): void {
        this.#step("Year", -1);
    }

    /**
     * Subtracts one month from the current CronDate, landing on the last second of that month.
     */
    public subtractMonth(): void {
        this.#step("Month", -1);
    }

    /**
     * Subtracts one day from the current CronDate, landing on the last second of that day.
     */
    public subtractDay(): void {
        this.#step("Day", -1);
    }

    /**
     * Subtracts one hour from the current CronDate, landing on the last second of that hour.
     */
    public subtractHour(): void {
        this.#step("Hour", -1);
    }

    /**
     * Subtracts one minute from the current CronDate, landing on the last second of that minute.
     */
    public subtractMinute(): void {
        this.#step("Minute", -1);
    }

    /**
     * Subtracts one second from the current CronDate.
     */
    public subtractSecond(): void {
        this.#step("Second", -1);
    }

    /**
     * Adds a unit of time to the current CronDate.
     */
    public addUnit(unit: TimeUnit): void {
        this.#step(unit, 1);
    }

    /**
     * Subtracts a unit of time from the current CronDate.
     */
    public subtractUnit(unit: TimeUnit): void {
        this.#step(unit, -1);
    }

    /**
     * Returns the day of the month.
     */
    public getDate(): number {
        return this.#fields.day;
    }

    /**
     * Returns the year.
     */
    public getFullYear(): number {
        return this.#fields.year;
    }

    /**
     * Returns the day of the week, 0 (Sunday) to 6 (Saturday).
     */
    public getDay(): number {
        return weekdayOf(this.#fields.year, this.#fields.month, this.#fields.day);
    }

    /**
     * Returns the month, 0 (January) to 11 (December).
     */
    public getMonth(): number {
        return this.#fields.month - 1;
    }

    /**
     * Returns the hour.
     */
    public getHours(): number {
        return this.#fields.hour;
    }

    /**
     * Returns the minutes.
     */
    public getMinutes(): number {
        return this.#fields.minute;
    }

    /**
     * Returns the seconds.
     */
    public getSeconds(): number {
        return this.#fields.second;
    }

    /**
     * Returns the milliseconds.
     */
    public getMilliseconds(): number {
        return this.#fields.millisecond;
    }

    /**
     * Returns the timezone offset from UTC in minutes (e.g. UTC+2 => 120).
     */
    public getUTCOffset(): number {
        return this.#offset;
    }

    /**
     * Sets the time to the start of the day (00:00:00.000) in the current timezone.
     */
    public setStartOfDay(): void {
        this.#startOf("day");
    }

    /**
     * Sets the time to the end of the day (23:59:59.999) in the current timezone.
     */
    public setEndOfDay(): void {
        this.#endOf("day");
    }

    /**
     * Returns the time in epoch milliseconds.
     */
    public getTime(): number {
        return this.#ts;
    }

    /**
     * Returns the UTC day of the month.
     */
    public getUTCDate(): number {
        return new Date(this.#ts).getUTCDate();
    }

    /**
     * Returns the UTC year.
     */
    public getUTCFullYear(): number {
        return new Date(this.#ts).getUTCFullYear();
    }

    /**
     * Returns the UTC day of the week.
     */
    public getUTCDay(): number {
        return new Date(this.#ts).getUTCDay();
    }

    /**
     * Returns the UTC month, 0 (January) to 11 (December).
     */
    public getUTCMonth(): number {
        return new Date(this.#ts).getUTCMonth();
    }

    /**
     * Returns the UTC hour.
     */
    public getUTCHours(): number {
        return new Date(this.#ts).getUTCHours();
    }

    /**
     * Returns the UTC minutes.
     */
    public getUTCMinutes(): number {
        return new Date(this.#ts).getUTCMinutes();
    }

    /**
     * Returns the UTC seconds.
     */
    public getUTCSeconds(): number {
        return new Date(this.#ts).getUTCSeconds();
    }

    /**
     * Returns the date as an ISO 8601 string in UTC.
     */
    public toISOString(): string {
        return new Date(this.#ts).toISOString();
    }

    /**
     * Returns the date as an ISO 8601 string carrying this date's own UTC offset.
     */
    public toJSON(): string {
        const { day, hour, millisecond, minute, month, second, year } = this.#fields;
        const absolute = Math.abs(this.#offset);
        let offset = "Z";

        if (!this.#zone.utc) {
            offset = `${this.#offset < 0 ? "-" : "+"}${pad(Math.trunc(absolute / 60), 2)}:${pad(Math.trunc(absolute % 60), 2)}`;
        }

        return `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}T${pad(hour, 2)}:${pad(minute, 2)}:${pad(second, 2)}.${pad(millisecond, 3)}${offset}`;
    }

    /**
     * Sets the day of the month.
     * @param day The day, 1 to 31. A day past the end of the month rolls into the next.
     */
    public setDate(day: number): void {
        this.#set({ day });
    }

    /**
     * Sets the year.
     */
    public setFullYear(year: number): void {
        this.#set({ year });
    }

    /**
     * Sets the day of the week within the current ISO week (Monday is 1, Sunday is 7).
     * @param day The weekday.
     */
    public setDay(day: number): void {
        const current = this.getDay() || 7;

        this.#set({ day: this.#fields.day + day - current }, true);
    }

    /**
     * Sets the month, 0 (January) to 11 (December).
     */
    public setMonth(month: number): void {
        this.#set({ month: month + 1 });
    }

    /**
     * Sets the hour.
     */
    public setHours(hour: number): void {
        this.#set({ hour });
    }

    /**
     * Sets the minutes.
     */
    public setMinutes(minute: number): void {
        this.#set({ minute });
    }

    /**
     * Sets the seconds.
     */
    public setSeconds(second: number): void {
        this.#set({ second });
    }

    /**
     * Sets the milliseconds.
     */
    public setMilliseconds(millisecond: number): void {
        this.#set({ millisecond });
    }

    /**
     * Returns the date as a string.
     */
    public toString(): string {
        return this.toDate().toString();
    }

    /**
     * Returns the date as a Date object.
     */
    public toDate(): Date {
        return new Date(this.#ts);
    }

    /**
     * Returns true if the day is the last day of the month.
     */
    public isLastDayOfMonth(): boolean {
        return this.#fields.day === daysInMonth(this.#fields.year, this.#fields.month);
    }

    /**
     * Returns true if the day is within the last seven days of the month, so a weekday here is the month's last of its kind.
     */
    public isLastWeekdayOfMonth(): boolean {
        return this.#fields.day > daysInMonth(this.#fields.year, this.#fields.month) - 7;
    }

    get #fields(): Fields {
        this.#calendar ??= toFields(this.#ts, this.#offset);

        return this.#calendar;
    }

    #reread(ts: number): void {
        this.#ts = ts;
        this.#offset = this.#zone.offset(ts);
        this.#calendar = undefined;
    }

    #place(localMs: number): void {
        const [ts, offset] = resolveLocal(localMs, this.#offset, this.#zone);

        this.#ts = ts;
        this.#offset = offset;
        this.#calendar = undefined;
    }

    /**
     * Replaces wall clock fields. An unset day is clamped to the month's length, but an explicit day
     * rolls over into the next month, matching `Date`.
     */
    #set(values: Partial<Fields>, rollOver = false): void {
        const mixed = { ...this.#fields, ...values };

        if (values.day === undefined && !rollOver) {
            mixed.day = Math.min(daysInMonth(mixed.year, mixed.month), mixed.day);
        }

        this.#place(toLocalMs(mixed));
    }

    /**
     * Years, months and days move the calendar and keep the wall clock time; milliseconds move the
     * instant, so an hour is an hour even across a DST change.
     */
    #plus({ days = 0, months = 0, ms = 0, years = 0 }: Delta): void {
        if (years !== 0 || months !== 0 || days !== 0) {
            const { day, month, year } = this.#fields;
            const targetYear = year + years;
            const targetMonth = month + months;

            this.#place(toLocalMs({ ...this.#fields, day: Math.min(day, daysInMonth(targetYear, targetMonth)) + days, month: targetMonth, year: targetYear }));
        }

        if (ms !== 0) {
            this.#reread(this.#ts + ms);
        }
    }

    /**
     * Moves by one unit. Going forward a unit lands on the start of the one it arrives in; going back it lands on
     * the last second of it.
     */
    #step(unit: TimeUnit, sign: 1 | -1): void {
        const { delta, edge } = STEPS[unit];

        this.#plus({ days: (delta.days ?? 0) * sign, months: (delta.months ?? 0) * sign, ms: (delta.ms ?? 0) * sign, years: (delta.years ?? 0) * sign });

        if (edge === undefined) {
            return;
        }

        if (sign === 1) {
            this.#startOf(edge);

            return;
        }

        this.#endOf(edge);
        this.#startOf("second");
    }

    #startOf(unit: Edge): void {
        const values: Partial<Fields> = { millisecond: 0 };

        if (unit !== "second") {
            values.second = 0;

            if (unit !== "minute") {
                values.minute = 0;

                if (unit !== "hour") {
                    values.hour = 0;

                    if (unit === "month") {
                        values.day = 1;
                    }
                }
            }
        }

        this.#set(values);
    }

    /** The last millisecond of the unit the date is in. */
    #endOf(unit: StepEdge): void {
        const { delta } = STEPS[({ day: "Day", hour: "Hour", minute: "Minute", month: "Month" } as const)[unit]];

        this.#plus(delta);
        this.#startOf(unit);
        this.#plus({ ms: -1 });
    }
}

export { CronDate, TimeUnit };
export default CronDate;
