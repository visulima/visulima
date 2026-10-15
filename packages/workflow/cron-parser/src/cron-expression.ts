import { CronDate } from "./cron-date";
import type { CronFieldCollection } from "./cron-field-collection";
import type { CronDialect, CronFeature, CronFeatures } from "./dialect";
import { readDayOfMonthText } from "./fields/day-of-month-text";
import type { ScheduleSpec } from "./schedule";
import { findRun } from "./schedule";
import { getZone } from "./zone";

type CronExpressionOptions = {
    currentDate?: Date | string | number | CronDate;
    /** The named grammar to hold the expression to; `extended` when none is given. */
    dialect?: CronDialect;
    endDate?: Date | string | number | CronDate;
    expression?: string;
    /** Syntax to turn on or off on top of the dialect. */
    features?: Partial<CronFeatures>;
    hashSeed?: string;
    startDate?: Date | string | number | CronDate;
    strict?: boolean;
    tz?: string;
};

/**
 * Error message for when the current date is outside the specified time span.
 */
const TIME_SPAN_OUT_OF_BOUNDS_ERROR_MESSAGE = "Out of the time span range";

/**
 * Error message for when the loop limit is exceeded during iteration.
 */
const LOOPS_LIMIT_EXCEEDED_ERROR_MESSAGE = "Invalid expression, loop limit exceeded";

/**
 * Class representing a Cron expression.
 *
 * The cursor moves with `next()` and `prev()`, each of which returns the closest run strictly after or
 * before it. `startDate` and `endDate` bound the runs that may be returned, both inclusively.
 */
class CronExpression {
    readonly #options: CronExpressionOptions;

    readonly #tz?: string;

    /** Created on first use when the expression starts from now, so parsing alone never looks up the system time zone. */
    #current?: CronDate;

    readonly #startDate?: CronDate;

    readonly #endDate?: CronDate;

    readonly #fields: CronFieldCollection;

    readonly #spec: ScheduleSpec;

    /** The syntax extensions the expression is made of, set by the parser when it builds one. */
    readonly #usedFeatures: ReadonlySet<CronFeature>;

    /**
     * Builds an expression from fields that were parsed or edited elsewhere.
     * @param fields The cron fields the expression is made of.
     * @param [options] Where to start, the time zone and the bounds.
     * @returns A new CronExpression instance.
     */
    public static fieldsToExpression(fields: CronFieldCollection, options?: CronExpressionOptions): CronExpression {
        return new CronExpression(fields, options ?? {});
    }

    /**
     * Creates a new CronExpression instance.
     * @param fields The parsed fields.
     * @param options Where to start, the time zone and the bounds.
     * @param usedFeatures The syntax extensions the expression is made of, when it was parsed.
     */
    public constructor(fields: CronFieldCollection, options: CronExpressionOptions, usedFeatures?: Iterable<CronFeature>) {
        this.#options = options;
        this.#usedFeatures = new Set(usedFeatures);
        this.#tz = options.tz;
        this.#fields = fields;
        this.#spec = CronExpression.#toSpec(fields);
        this.#startDate = options.startDate ? new CronDate(options.startDate, this.#tz) : undefined;
        this.#endDate = options.endDate ? new CronDate(options.endDate, this.#tz) : undefined;

        if (this.#tz !== undefined) {
            // An unknown zone is an error when the expression is made, not when it is first used.
            getZone(this.#tz);
        }

        if (options.currentDate !== undefined || options.startDate !== undefined) {
            this.#current = this.#initialCursor(options.currentDate);
        }
    }

    /**
     * The parsed fields behind the expression.
     * @returns The six fields.
     */
    public get fields(): CronFieldCollection {
        return this.#fields;
    }

    /**
     * The syntax extensions the expression is made of, such as `hashed` or `nthDayOfWeek`; empty for an
     * expression built by hand rather than by `CronExpressionParser.parse`.
     * @returns The extensions used.
     */
    public get usedFeatures(): ReadonlySet<CronFeature> {
        return this.#usedFeatures;
    }

    /**
     * Find the next scheduled date based on the cron expression.
     * @returns The closest run after the cursor.
     * @throws {Error} When there is none before `endDate`, or the expression can never match.
     */
    public next(): CronDate {
        return this.#advance(1, true);
    }

    /**
     * Find the previous scheduled date based on the cron expression.
     * @returns The closest run before the cursor.
     * @throws {Error} When there is none after `startDate`, or the expression can never match.
     */
    public prev(): CronDate {
        return this.#advance(-1, true);
    }

    /**
     * Check if there is a next scheduled date based on the current date and cron expression.
     * @returns True if there is a next scheduled date, false otherwise.
     */
    public hasNext(): boolean {
        try {
            this.#advance(1, false);

            return true;
        } catch {
            return false;
        }
    }

    /**
     * Check if there is a previous scheduled date based on the current date and cron expression.
     * @returns True if there is a previous scheduled date, false otherwise.
     */
    public hasPrev(): boolean {
        try {
            this.#advance(-1, false);

            return true;
        } catch {
            return false;
        }
    }

    /**
     * Collects runs, moving the cursor along. Stops early, without throwing, when the runs end or the expression can never match.
     * @param limit How many runs. A positive value iterates forward, a negative value backward.
     * @returns The runs found.
     */
    public take(limit: number): CronDate[] {
        const items: CronDate[] = [];
        const step = limit >= 0 ? () => this.next() : () => this.prev();

        for (let remaining = Math.abs(limit); remaining > 0; remaining -= 1) {
            try {
                items.push(step());
            } catch {
                break;
            }
        }

        return items;
    }

    /**
     * Reset the iterator's cursor to a new date, or to where it started.
     * @param [newDate] Optional new date to reset to.
     */
    public reset(newDate?: Date | CronDate): void {
        this.#current = this.#initialCursor(newDate ?? this.#options.currentDate);
    }

    /**
     * Generate a string representation of the cron expression.
     * @param [includeSeconds] Whether to include the seconds field in the string representation.
     * @returns The string representation of the cron expression.
     */
    public stringify(includeSeconds = false): string {
        return this.#fields.stringify(includeSeconds);
    }

    /**
     * Check if a date is one of the expression's runs. A second pass through a repeated hour is not a run
     * for an expression that names its hours, and a time skipped by a clock change is a run after the gap.
     * Only the schedule is checked: `startDate` and `endDate` do not limit this, as they do `next()` and `prev()`.
     * @param date The date to look up, to the second.
     * @returns True when the date is a run.
     */
    public includesDate(date: Date | CronDate): boolean {
        const read = new CronDate(date, this.#tz);
        const second = Math.floor(read.getTime() / 1000) * 1000;
        // The closest run before the millisecond after, so one landing on `second` counts.
        const run = findRun(this.#spec, read.zone, second + 1, -1);

        return run === second;
    }

    /**
     * Returns the string representation of the cron expression.
     * @returns The expression as given, or rebuilt from its fields.
     */
    public toString(): string {
        return this.#options.expression ?? this.stringify(true);
    }

    /**
     * Reduces the parsed fields to what the search needs.
     * @param fields The parsed cron fields.
     * @returns The search specification.
     */
    static #toSpec(fields: CronFieldCollection): ScheduleSpec {
        const { dayOfMonth, dayOfWeek, hour, minute, month, second } = fields;
        // A weekday such as `5L` is kept as text by the parser, so the values are not all numbers.
        const weekdayValues = dayOfWeek.values as ReadonlyArray<number | string>;
        const monthDayValues = dayOfMonth.values as ReadonlyArray<number | string>;
        const texts = monthDayValues.filter((value): value is string => typeof value === "string");
        const lastOffsets: number[] = [];
        const nearestWeekdays: number[] = [];
        let lastWeekday = false;

        for (const text of texts) {
            const read = readDayOfMonthText(text);

            switch (read?.kind) {
                case "lastOffset": {
                    lastOffsets.push(read.days);

                    break;
                }
                case "lastWeekday": {
                    lastWeekday = true;

                    break;
                }
                case "nearestWeekday": {
                    nearestWeekdays.push(read.day);

                    break;
                }
                default: {
                    break;
                }
            }
        }

        const lastDay = texts.includes("L");

        return {
            days: {
                dynamic: lastDay || lastWeekday || lastOffsets.length > 0 || nearestWeekdays.length > 0,
                lastDay,
                lastOffsets,
                lastWeekday,
                lastWeekdays: dayOfWeek.hasLastChar ? weekdayValues.map((value) => Number.parseInt(String(value).charAt(0), 10) % 7) : [],
                monthDayRestricted: !dayOfMonth.isWildcard,
                monthDays: monthDayValues.filter((value): value is number => typeof value === "number"),
                nearestWeekdays,
                nthWeekday: dayOfWeek.nthDay,
                weekdayRestricted: !dayOfWeek.isWildcard,
                weekdays: weekdayValues.filter((value): value is number => typeof value === "number"),
            },
            hours: hour.values,
            minutes: minute.values,
            months: month.values,
            restrictedHours: hour.values.length !== 24,
            seconds: second.values,
        };
    }

    /**
     * The cursor, made on first use when there is nothing to start from but now.
     * @returns The cursor.
     */
    #cursor(): CronDate {
        this.#current ??= this.#initialCursor(this.#options.currentDate);

        return this.#current;
    }

    /**
     * Where the cursor starts. A start date is an inclusive bound, so a cursor placed at or before it
     * sits just short of it, and a cursor placed past the end date sits just beyond it.
     * @param value The requested starting point, or none.
     * @returns The cursor.
     */
    #initialCursor(value: CronExpressionOptions["currentDate"]): CronDate {
        const requested = value ?? this.#options.startDate;

        if (requested === undefined) {
            return new CronDate(undefined, this.#tz);
        }

        const date = new CronDate(requested, this.#tz);

        if (this.#startDate && (value === undefined || date.getTime() < this.#startDate.getTime())) {
            return new CronDate(this.#startDate.getTime() - 1, this.#tz);
        }

        if (this.#endDate && date.getTime() > this.#endDate.getTime()) {
            return new CronDate(this.#endDate.getTime() + 1, this.#tz);
        }

        return date;
    }

    /**
     * Finds the closest run in a direction.
     * @param direction 1 for the next run, -1 for the previous one.
     * @param commit Whether to move the cursor onto the run.
     * @returns The run.
     */
    #advance(direction: 1 | -1, commit: boolean): CronDate {
        const bound = direction === 1 ? this.#endDate : this.#startDate;
        const cursor = this.#cursor();
        const run = findRun(this.#spec, cursor.zone, cursor.getTime(), direction, bound?.getTime());

        if (run === "loop") {
            throw new Error(LOOPS_LIMIT_EXCEEDED_ERROR_MESSAGE);
        }

        if (run === "bounds" || (bound && (direction === 1 ? run > bound.getTime() : run < bound.getTime()))) {
            throw new Error(TIME_SPAN_OUT_OF_BOUNDS_ERROR_MESSAGE);
        }

        const date = new CronDate(run, cursor.zone.name);

        if (commit) {
            this.#current = date;
        }

        return date;
    }

    /**
     * Returns an iterator over the runs after the cursor.
     * @returns An iterator of CronDate values that ends when the runs do.
     */
    public [Symbol.iterator](): Iterator<CronDate> {
        return {
            next: (): IteratorResult<CronDate> => {
                try {
                    return { done: false, value: this.next() };
                } catch {
                    return { done: true, value: undefined };
                }
            },
        };
    }
}

export { CronExpression, LOOPS_LIMIT_EXCEEDED_ERROR_MESSAGE, TIME_SPAN_OUT_OF_BOUNDS_ERROR_MESSAGE };
export type { CronExpressionOptions };
export default CronExpression;
