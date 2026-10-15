/* eslint-disable sonarjs/regex-complexity -- ported from the reference implementation, whose behaviour its tests pin; these style rules stay relaxed so the code remains easy to compare with the original (the search engine in schedule.ts, zone.ts and cron-expression.ts has no such exceptions) */
import type { CronFieldName } from "../errors";
import type { CronFieldOptions } from "./cron-field";
import { CronField } from "./cron-field";
import CronMonth from "./cron-month";
import { readDayOfMonthText } from "./day-of-month-text";
import type { CronChars, CronMax, CronMin, DayOfMonthRange, MonthRange } from "./types";

/** One regular expression for every call: a regex literal inside a getter is made anew each time it runs. */
const DAY_OF_MONTH_CHARS = /^[?,*\dLWH/-]+$|^.*H\(\d+-\d+\)\/\d.*$|^.*H\(\d+-\d+\).*$|^.*H\/\d.*$/;

const MIN_DAY = 1;
const MAX_DAY = 31;
const DAY_CHARS = Object.freeze(["L", "W"]) as CronChars[];

/**
 * Represents the "day of the month" field within a cron expression.
 * @class CronDayOfMonth
 * @augments CronField
 */
class CronDayOfMonth extends CronField {
    /**
     * Creates a "day of the month" field limited to the days the given month has.
     * @param month Values for the "month" field the days are used with
     * @param values Values for the "day of the month" field
     * @param [options] Options provided by the parser
     * @returns
     */
    public static fromMonth(month: MonthRange[], values: DayOfMonthRange[], options?: CronFieldOptions): CronDayOfMonth {
        if (month.length !== 1) {
            return new CronDayOfMonth(values, options);
        }

        const daysInMonth = CronMonth.daysInMonth[(month[0] as number) - 1] as number;
        const days = values.filter((value) => typeof value !== "number" || value <= daysInMonth);

        return new CronDayOfMonth(days.length > 0 ? days : values, options);
    }

    public static override get fieldName(): CronFieldName {
        return "dayOfMonth";
    }

    public static override get min(): CronMin {
        return MIN_DAY;
    }

    public static override get max(): CronMax {
        return MAX_DAY;
    }

    public static override get chars(): CronChars[] {
        return DAY_CHARS;
    }

    public static override get validChars(): RegExp {
        return DAY_OF_MONTH_CHARS;
    }

    /**
     * CronDayOfMonth constructor. Initializes the "day of the month" field with the provided values.
     * @param values Values for the "day of the month" field
     * @param [options] Options provided by the parser
     * @throws {Error} if validation fails
     */
    public constructor(values: DayOfMonthRange[], options?: CronFieldOptions) {
        super(values, options);
        this.validate();
    }

    /**
     * Besides a plain `L` (the last day), the day of month takes `LW`, `L-&lt;days>` and `&lt;day>W`.
     */
    // eslint-disable-next-line class-methods-use-this
    protected override isValidText(value: string): boolean {
        return readDayOfMonthText(value) !== undefined;
    }

    /**
     * Returns an array of allowed values for the "day of the month" field.
     * @returns
     */
    public override get values(): DayOfMonthRange[] {
        return super.values as DayOfMonthRange[];
    }
}

export default CronDayOfMonth;
