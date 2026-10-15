import type { CronFieldName } from "../errors";
import type { CronFieldOptions } from "./cron-field";
import { CronField } from "./cron-field";
import type { CronChars, CronMax, CronMin, HourRange } from "./types";

const MIN_HOUR = 0;
const MAX_HOUR = 23;
const HOUR_CHARS: ReadonlyArray<CronChars> = Object.freeze([]);

/**
 * Represents the "hour" field within a cron expression.
 * @class CronHour
 * @augments CronField
 */
class CronHour extends CronField {
    public static override get fieldName(): CronFieldName {
        return "hour";
    }

    public static override get min(): CronMin {
        return MIN_HOUR;
    }

    public static override get max(): CronMax {
        return MAX_HOUR;
    }

    public static override get chars(): ReadonlyArray<CronChars> {
        return HOUR_CHARS;
    }

    /**
     * CronHour constructor. Initializes the "hour" field with the provided values.
     * @param values Values for the "hour" field
     * @param [options] Options provided by the parser
     */
    public constructor(values: HourRange[], options?: CronFieldOptions) {
        super(values, options);
        this.validate();
    }

    /**
     * Returns an array of allowed values for the "hour" field.
     * @returns
     */
    public override get values(): HourRange[] {
        return super.values as HourRange[];
    }
}

export default CronHour;
