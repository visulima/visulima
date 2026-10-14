/* eslint-disable @typescript-eslint/member-ordering, @typescript-eslint/no-unnecessary-condition, @typescript-eslint/prefer-nullish-coalescing, @typescript-eslint/restrict-template-expressions, jsdoc/check-indentation, jsdoc/check-param-names, no-plusplus, sonarjs/no-inverted-boolean-check, unicorn/no-null -- ported from the reference implementation, whose behaviour its tests pin; these style rules stay relaxed so the code remains easy to compare with the original (the search engine in schedule.ts, zone.ts and cron-expression.ts has no such exceptions) */
import type { SerializedCronField } from "./fields";
import { CronDayOfMonth, CronDayOfWeek, CronField, CronHour, CronMinute, CronMonth, CronSecond } from "./fields";
import type { DayOfMonthRange, DayOfWeekRange, HourRange, MonthRange, SixtyRange } from "./fields/types";

type FieldRange = {
    count: number;
    end?: number;
    start: number | string;
    step?: number;
};

type CronFields = {
    dayOfMonth: CronDayOfMonth;
    dayOfWeek: CronDayOfWeek;
    hour: CronHour;
    minute: CronMinute;
    month: CronMonth;
    second: CronSecond;
};

type CronFieldOverride = {
    dayOfMonth?: CronDayOfMonth | DayOfMonthRange[];
    dayOfWeek?: CronDayOfWeek | DayOfWeekRange[];
    hour?: CronHour | HourRange[];
    minute?: CronMinute | SixtyRange[];
    month?: CronMonth | MonthRange[];
    second?: CronSecond | SixtyRange[];
};

type SerializedCronFields = {
    dayOfMonth: SerializedCronField;
    dayOfWeek: SerializedCronField;
    hour: SerializedCronField;
    minute: SerializedCronField;
    month: SerializedCronField;
    second: SerializedCronField;
};

/**
 * Represents a complete set of cron fields.
 * @class CronFieldCollection
 */
class CronFieldCollection {
    readonly #second: CronSecond;

    readonly #minute: CronMinute;

    readonly #hour: CronHour;

    readonly #dayOfMonth: CronDayOfMonth;

    readonly #month: CronMonth;

    readonly #dayOfWeek: CronDayOfWeek;

    /**
     * Creates a new CronFieldCollection instance by partially overriding fields from an existing one.
     * @param base The base CronFieldCollection to copy fields from
     * @param fields The fields to override, can be CronField instances or raw values
     * @returns A new CronFieldCollection instance
     * @example
     * const base = new CronFieldCollection({
     *   second: new CronSecond([0]),
     *   minute: new CronMinute([0]),
     *   hour: new CronHour([12]),
     *   dayOfMonth: new CronDayOfMonth([1]),
     *   month: new CronMonth([1]),
     *   dayOfWeek: new CronDayOfWeek([1])
     * });
     *
     * // Using CronField instances
     * const modified1 = CronFieldCollection.from(base, {
     *   hour: new CronHour([15]),
     *   minute: new CronMinute([30])
     * });
     *
     * // Using raw values
     * const modified2 = CronFieldCollection.from(base, {
     *   hour: [15],        // Will create new CronHour
     *   minute: [30]       // Will create new CronMinute
     * });
     */
    public static from(base: CronFieldCollection, fields: CronFieldOverride): CronFieldCollection {
        return new CronFieldCollection({
            dayOfMonth: this.resolveField(CronDayOfMonth, base.dayOfMonth, fields.dayOfMonth),
            dayOfWeek: this.resolveField(CronDayOfWeek, base.dayOfWeek, fields.dayOfWeek),
            hour: this.resolveField(CronHour, base.hour, fields.hour),
            minute: this.resolveField(CronMinute, base.minute, fields.minute),
            month: this.resolveField(CronMonth, base.month, fields.month),
            second: this.resolveField(CronSecond, base.second, fields.second),
        });
    }

    /**
     * Resolves a field value, either using the provided CronField instance or creating a new one from raw values.
     * @param constructor The constructor for creating new field instances
     * @param baseField The base field to use if no override is provided
     * @param fieldValue The override value, either a CronField instance or raw values
     * @returns The resolved CronField instance
     * @private
     */
    private static resolveField<T extends CronField, V extends unknown[]>(constructor: new (values: V) => T, baseField: T, fieldValue: T | V | undefined): T {
        if (!fieldValue) {
            return baseField;
        }

        if (fieldValue instanceof CronField) {
            return fieldValue;
        }

        return new constructor(fieldValue);
    }

    /**
     * CronFieldCollection constructor. Initializes the cron fields with the provided values.
     * @param param0 The cron fields values
     * @throws {Error} if validation fails
     * @example
     * const cronFields = new CronFieldCollection({
     *   second: new CronSecond([0]),
     *   minute: new CronMinute([0, 30]),
     *   hour: new CronHour([9]),
     *   dayOfMonth: new CronDayOfMonth([15]),
     *   month: new CronMonth([1]),
     *   dayOfWeek: new CronDayOfTheWeek([1, 2, 3, 4, 5]),
     * })
     *
     * console.log(cronFields.second.values); // [0]
     * console.log(cronFields.minute.values); // [0, 30]
     * console.log(cronFields.hour.values); // [9]
     * console.log(cronFields.dayOfMonth.values); // [15]
     * console.log(cronFields.month.values); // [1]
     * console.log(cronFields.dayOfWeek.values); // [1, 2, 3, 4, 5]
     */
    public constructor({ dayOfMonth, dayOfWeek, hour, minute, month, second }: CronFields) {
        if (!second) {
            throw new Error("Validation error, Field second is missing");
        }

        if (!minute) {
            throw new Error("Validation error, Field minute is missing");
        }

        if (!hour) {
            throw new Error("Validation error, Field hour is missing");
        }

        if (!dayOfMonth) {
            throw new Error("Validation error, Field dayOfMonth is missing");
        }

        if (!month) {
            throw new Error("Validation error, Field month is missing");
        }

        if (!dayOfWeek) {
            throw new Error("Validation error, Field dayOfWeek is missing");
        }

        // Only an explicit day of month that can never occur is invalid. When the
        // day of week is restricted it rescues the expression (day of month and day
        // of week combine with OR), so the day of month need not be reachable.
        if (month.values.length === 1 && dayOfMonth.values.every((value) => typeof value === "number") && dayOfWeek.isWildcard) {
            const daysInMonth = CronMonth.daysInMonth[(month.values[0] as number) - 1] as number;

            if (!(Number.parseInt(String(dayOfMonth.values[0]), 10) <= daysInMonth)) {
                throw new Error("Invalid explicit day of month definition");
            }
        }

        this.#second = second;
        this.#minute = minute;
        this.#hour = hour;
        this.#month = month;
        this.#dayOfWeek = dayOfWeek;
        this.#dayOfMonth = dayOfMonth;
    }

    /**
     * Returns the second field.
     * @returns
     */
    public get second(): CronSecond {
        return this.#second;
    }

    /**
     * Returns the minute field.
     * @returns
     */
    public get minute(): CronMinute {
        return this.#minute;
    }

    /**
     * Returns the hour field.
     * @returns
     */
    public get hour(): CronHour {
        return this.#hour;
    }

    /**
     * Returns the day of the month field.
     * @returns
     */
    public get dayOfMonth(): CronDayOfMonth {
        return this.#dayOfMonth;
    }

    /**
     * Returns the month field.
     * @returns
     */
    public get month(): CronMonth {
        return this.#month;
    }

    /**
     * Returns the day of the week field.
     * @returns
     */
    public get dayOfWeek(): CronDayOfWeek {
        return this.#dayOfWeek;
    }

    /**
     * Returns a string representation of the cron fields.
     * @param input The cron fields values
     * @static
     * @returns - The compacted cron fields
     */
    public static compactField(input: (number | string)[]): FieldRange[] {
        if (input.length === 0) {
            return [];
        }

        // Initialize the output array and current IFieldRange
        const output: FieldRange[] = [];
        let current: FieldRange | undefined;

        input.forEach((item, i, array) => {
            // If the current FieldRange is undefined, create a new one with the current item as the start.
            if (current === undefined) {
                current = { count: 1, start: item };

                return;
            }

            // Cache the previous and next items in the array.
            const previousItem = array[i - 1] || current.start;
            const nextItem = array[i + 1];

            // If the current item is 'L' or 'W', push the current FieldRange to the output and
            // create a new FieldRange with the current item as the start.
            // 'L' and 'W' characters are special cases that need to be handled separately.
            // Text such as `L`, `W`, `LW`, `L-3` or `15W` never joins a range: it stands alone.
            if (typeof item === "string") {
                output.push(current, { count: 1, start: item });
                current = undefined;

                return;
            }

            // If the current step is undefined and there is a next item, update the current IFieldRange.
            // This block checks if the current step needs to be updated and does so if needed.
            if (current.step === undefined && nextItem !== undefined) {
                const step = item - (previousItem as number);
                const nextStep = (nextItem as number) - item;

                // If the current step is less or equal to the next step, update the current FieldRange to include the current item.
                if (step <= nextStep) {
                    current = { ...current, count: 2, end: item, step };

                    return;
                }

                current.step = 1;
            }

            // If the difference between the current item and the current end is equal to the current step,
            // update the current IFieldRange's count and end.
            // This block checks if the current item is part of the current range and updates the range accordingly.
            if (item - (current.end ?? 0) === current.step) {
                current.count++;
                current.end = item;
            } else {
                // If the count is 1, push a new FieldRange with the current start.
                // This handles the case where the current range has only one element.
                if (current.count === 1) {
                    // If the count is 2, push two separate IFieldRanges, one for each element.
                    output.push({ count: 1, start: current.start });
                } else if (current.count === 2) {
                    output.push(
                        { count: 1, start: current.start },
                        {
                            count: 1,
                            start: current.end ?? /* istanbul ignore next - see above */ previousItem,
                        },
                    );
                } else {
                    // Otherwise, push the current FieldRange to the output.
                    output.push(current);
                }

                // Reset the current FieldRange with the current item as the start.
                current = { count: 1, start: item };
            }
        });

        // Push the final IFieldRange, if any, to the output array.
        if (current) {
            output.push(current);
        }

        return output;
    }

    /**
     * Handles a single range.
     * @param field The cron field to stringify
     * @param range {start: number, end: number, step: number, count: number} The range to handle.
     * @param max The maximum value for the field.
     * @returns The stringified range or null if it cannot be stringified.
     * @private
     */
    static #handleSingleRange(field: CronField, range: FieldRange, max: number): string | null {
        const { step } = range;

        if (!step) {
            return null;
        }

        if (step === 1 && range.start === field.min && range.end && range.end >= max) {
            const isDayField = field instanceof CronDayOfMonth || field instanceof CronDayOfWeek;

            if (isDayField && !field.isWildcard) {
                return null;
            }

            return field.hasQuestionMarkChar ? "?" : "*";
        }

        if (step !== 1 && range.start === field.min && range.end && range.end >= max - step + 1) {
            return `*/${step}`;
        }

        return null;
    }

    /**
     * Handles multiple ranges.
     * @param range {start: number, end: number, step: number, count: number} The range to handle.
     * @returns The stringified range.
     * @private
     */
    static #handleMultipleRanges(range: FieldRange): string {
        const { step } = range;

        if (step === 1) {
            return `${range.start}-${range.end}`;
        }

        const multiplier = range.start === 0 ? range.count - 1 : range.count;

        /* istanbul ignore if */
        if (!step) {
            throw new Error("Unexpected range step");
        }

        /* istanbul ignore if */
        if (!range.end) {
            throw new Error("Unexpected range end");
        }

        if (step * multiplier > range.end) {
            const mapFunction = (_: number, index: number) => {
                /* istanbul ignore if */
                if (typeof range.start !== "number") {
                    throw new TypeError("Unexpected range start");
                }

                return index % step === 0 ? range.start + index : null;
            };

            /* istanbul ignore if */
            if (typeof range.start !== "number") {
                throw new TypeError("Unexpected range start");
            }

            const seed = { length: range.end - range.start + 1 };

            return Array.from(seed, mapFunction)
                .filter((value) => value !== null)
                .join(",");
        }

        return `${range.start}-${range.end}/${step}`;
    }

    /**
     * Returns a string representation of the cron fields.
     * @param field The cron field to stringify
     * @static
     * @returns - The stringified cron field
     */
    public stringifyField(field: CronField): string {
        let { max } = field;
        let { values } = field;

        if (field instanceof CronDayOfWeek) {
            max = 6;
            const dayOfWeek = this.#dayOfWeek.values;

            values = dayOfWeek[dayOfWeek.length - 1] === 7 ? dayOfWeek.slice(0, -1) : dayOfWeek;
        }

        if (field instanceof CronDayOfMonth) {
            max = this.#month.values.length === 1 ? (CronMonth.daysInMonth[(this.#month.values[0] as number) - 1] as number) : field.max;
        }

        const ranges = CronFieldCollection.compactField(values);

        if (ranges.length === 1) {
            const singleRangeResult = CronFieldCollection.#handleSingleRange(field, ranges[0] as FieldRange, max);

            if (singleRangeResult) {
                return singleRangeResult;
            }
        }

        return ranges
            .map((range) => {
                const value = range.count === 1 ? range.start.toString() : CronFieldCollection.#handleMultipleRanges(range);

                if (field instanceof CronDayOfWeek && field.nthDay > 0) {
                    return `${value}#${field.nthDay}`;
                }

                return value;
            })
            .join(",");
    }

    /**
     * Returns a string representation of the cron field values.
     * @param includeSeconds Whether to include seconds in the output
     * @returns The formatted cron string
     */
    public stringify(includeSeconds = false): string {
        const array = [];

        if (includeSeconds) {
            array.push(this.stringifyField(this.#second)); // second
        }

        array.push(
            this.stringifyField(this.#minute), // minute
            this.stringifyField(this.#hour), // hour
            this.stringifyField(this.#dayOfMonth), // dayOfMonth
            this.stringifyField(this.#month), // month
            this.stringifyField(this.#dayOfWeek), // dayOfWeek
        );

        return array.join(" ");
    }

    /**
     * Returns a serialized representation of the cron fields values.
     * @returns An object containing the cron field values
     */
    public serialize(): SerializedCronFields {
        return {
            dayOfMonth: this.#dayOfMonth.serialize(),
            dayOfWeek: this.#dayOfWeek.serialize(),
            hour: this.#hour.serialize(),
            minute: this.#minute.serialize(),
            month: this.#month.serialize(),
            second: this.#second.serialize(),
        };
    }
}

export { CronFieldCollection };
export type { CronFieldOverride, CronFields, FieldRange, SerializedCronFields };
