import type { CronFieldName } from "../errors";
import type { CronFieldOptions } from "./cron-field";
import { CronField } from "./cron-field";
import type { CronChars, CronMax, CronMin, MonthRange } from "./types";

const MIN_MONTH = 1;
const MAX_MONTH = 12;
const MONTH_CHARS: ReadonlyArray<CronChars> = Object.freeze([]);

/** The most days each month can have, February counted with its leap day. */
const MOST_DAYS_IN_MONTH: ReadonlyArray<number> = Object.freeze([31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]);

/**
 * Represents the "day of the month" field within a cron expression.
 * @class CronDayOfMonth
 * @augments CronField
 */
class CronMonth extends CronField {
    public static override get fieldName(): CronFieldName {
        return "month";
    }

    public static override get min(): CronMin {
        return MIN_MONTH;
    }

    public static override get max(): CronMax {
        return MAX_MONTH;
    }

    public static override get chars(): ReadonlyArray<CronChars> {
        return MONTH_CHARS;
    }

    public static get daysInMonth(): ReadonlyArray<number> {
        return MOST_DAYS_IN_MONTH;
    }

    /**
     * CronDayOfMonth constructor. Initializes the "day of the month" field with the provided values.
     * @param values Values for the "day of the month" field
     * @param [options] Options provided by the parser
     */
    public constructor(values: MonthRange[], options?: CronFieldOptions) {
        super(values, options);
        this.validate();
    }

    /**
     * Returns an array of allowed values for the "day of the month" field.
     * @returns
     */
    public override get values(): MonthRange[] {
        return super.values as MonthRange[];
    }
}

export default CronMonth;
