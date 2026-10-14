import type { CronFieldOptions } from "./cron-field";
import { CronField } from "./cron-field";
import type { CronChars, CronMax, CronMin, SixtyRange } from "./types";

const MIN_MINUTE = 0;
const MAX_MINUTE = 59;
const MINUTE_CHARS: ReadonlyArray<CronChars> = Object.freeze([]);

/**
 * Represents the "second" field within a cron expression.
 * @class CronSecond
 * @augments CronField
 */
class CronMinute extends CronField {
    public static override get min(): CronMin {
        return MIN_MINUTE;
    }

    public static override get max(): CronMax {
        return MAX_MINUTE;
    }

    public static override get chars(): ReadonlyArray<CronChars> {
        return MINUTE_CHARS;
    }

    /**
     * CronSecond constructor. Initializes the "second" field with the provided values.
     * @param values Values for the "second" field
     * @param [options] Options provided by the parser
     */
    public constructor(values: SixtyRange[], options?: CronFieldOptions) {
        super(values, options);
        this.validate();
    }

    /**
     * Returns an array of allowed values for the "second" field.
     * @returns
     */
    public override get values(): SixtyRange[] {
        return super.values as SixtyRange[];
    }
}

export default CronMinute;
