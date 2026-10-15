/* eslint-disable sonarjs/regex-complexity -- ported from the reference implementation, whose behaviour its tests pin; these style rules stay relaxed so the code remains easy to compare with the original (the search engine in schedule.ts, zone.ts and cron-expression.ts has no such exceptions) */
import { CronParseError, fieldNameOf } from "../errors";
import type { CronFieldOptions } from "./cron-field";
import { CronField } from "./cron-field";
import type { CronChars, CronMax, CronMin, DayOfWeekRange } from "./types";

/** A weekday from 0 to 7 before the `L`, or the bare `L`. */
const LAST_WEEKDAY = /^[0-7]?L$/;

/** One regular expression for every call: a regex literal inside a getter is made anew each time it runs. */
const DAY_OF_WEEK_CHARS = /^[?,*\dLH#/-]+$|^.*H\(\d+-\d+\)\/\d.*$|^.*H\(\d+-\d+\).*$|^.*H\/\d.*$/;

const MIN_DAY = 0;
const MAX_DAY = 7;
const DAY_CHARS: ReadonlyArray<CronChars> = Object.freeze(["L"]);

/**
 * Represents the "day of the week" field within a cron expression.
 * @class CronDayOfTheWeek
 * @augments CronField
 */
class CronDayOfWeek extends CronField {
    public static override get min(): CronMin {
        return MIN_DAY;
    }

    public static override get max(): CronMax {
        return MAX_DAY;
    }

    public static override get chars(): ReadonlyArray<CronChars> {
        return DAY_CHARS;
    }

    public static override get validChars(): RegExp {
        return DAY_OF_WEEK_CHARS;
    }

    /**
     * CronDayOfTheWeek constructor. Initializes the "day of the week" field with the provided values.
     * @param values Values for the "day of the week" field
     * @param [options] Options provided by the parser
     */
    public constructor(values: DayOfWeekRange[], options?: CronFieldOptions) {
        super(values, options);
        this.validate();

        if (this.values.includes("L")) {
            throw new CronParseError(`${this.constructor.name} Validation error, unexpected standalone L`, {
                code: "FIELD_VALUE",
                field: fieldNameOf(this.constructor.name),
                token: "L",
            });
        }
    }

    /**
     * `5L` is the last Friday of the month: the day before the `L` is a single weekday from 0 to 7.
     */
    // eslint-disable-next-line class-methods-use-this
    protected override isValidText(value: string): boolean {
        return LAST_WEEKDAY.test(value);
    }

    /**
     * Returns an array of allowed values for the "day of the week" field.
     * @returns
     */
    public override get values(): DayOfWeekRange[] {
        return super.values as DayOfWeekRange[];
    }

    /**
     * Returns the nth day of the week if specified in the cron expression.
     * This is used for the '#' character in the cron expression.
     * @returns The nth day of the week (1-5) or 0 if not specified.
     */
    public get nthDay(): number {
        return this.options.nthDayOfWeek ?? 0;
    }
}

export default CronDayOfWeek;
