/* eslint-disable @typescript-eslint/naming-convention, @typescript-eslint/no-extraneous-class, @typescript-eslint/no-shadow, @typescript-eslint/no-unnecessary-condition, @typescript-eslint/no-unsafe-argument, @typescript-eslint/restrict-template-expressions, e18e/prefer-static-regex, func-style, jsdoc/check-param-names, jsdoc/require-returns-check, no-param-reassign, sonarjs/different-types-comparison, sonarjs/prefer-regexp-exec -- ported from the reference implementation, whose behaviour its tests pin; these style rules stay relaxed so the code remains easy to compare with the original (the search engine in schedule.ts, zone.ts and cron-expression.ts has no such exceptions) */
import type { CronExpressionOptions } from "./cron-expression";
import { CronExpression } from "./cron-expression";
import { CronFieldCollection } from "./cron-field-collection";
import type { CronConstraints, DayOfMonthRange, DayOfWeekRange, HourRange, MonthRange, ParseRangeResponse, SixtyRange } from "./fields";
import { CronDayOfMonth, CronDayOfWeek, CronHour, CronMinute, CronMonth, CronSecond } from "./fields";
import { looksLikeDayOfMonthText, normalizeDayOfMonthText, readDayOfMonthText } from "./fields/day-of-month-text";
import type { PRNG } from "./utils/random";
import { seededRandom } from "./utils/random";

const PredefinedExpressions = {
    "@annually": "0 0 0 1 1 *",
    "@daily": "0 0 0 * * *",
    "@hourly": "0 0 * * * *",
    "@minutely": "0 * * * * *",
    "@monthly": "0 0 0 1 * *",
    "@secondly": "* * * * * *",
    "@weekdays": "0 0 0 * * 1-5",
    "@weekends": "0 0 0 * * 0,6",
    "@weekly": "0 0 0 * * 0",
    "@yearly": "0 0 0 1 1 *",
} as const;

const CronUnit = {
    DayOfMonth: "DayOfMonth",
    DayOfWeek: "DayOfWeek",
    Hour: "Hour",
    Minute: "Minute",
    Month: "Month",
    Second: "Second",
} as const;

type CronUnit = (typeof CronUnit)[keyof typeof CronUnit];

// these need to be lowercase for the parser to work
const Months = {
    apr: 4,
    aug: 8,
    dec: 12,
    feb: 2,
    jan: 1,
    jul: 7,
    jun: 6,
    mar: 3,
    may: 5,
    nov: 11,
    oct: 10,
    sep: 9,
} as const;

// these need to be lowercase for the parser to work
const DayOfWeek = {
    fri: 5,
    mon: 1,
    sat: 6,
    sun: 0,
    thu: 4,
    tue: 2,
    wed: 3,
} as const;

type RawCronFields = {
    dayOfMonth: string;
    dayOfWeek: string;
    hour: string;
    minute: string;
    month: string;
    second: string;
};

/**
 * Upper bound on the number of values a single field may expand to.
 * No field can hold this many distinct values, so exceeding it always means the list repeats values.
 */
const MAX_FIELD_VALUES = 256;

/**
 * Upper bound on the length of a cron expression.
 * Listing every value of every field needs about half of this, so a longer expression is never meaningful.
 */
const MAX_EXPRESSION_LENGTH = 1024;

/**
 * Parses cron expressions into `CronExpression` objects. A class of static methods, as in the reference
 * implementation, so existing `CronExpressionParser.parse(...)` calls keep working.
 */
class CronExpressionParser {
    /** What a bare `*` expands to in each field, worked out the first time it is met. */
    static readonly #wildcards = new Map<CronUnit, (number | string)[]>();

    /**
     * Parses a cron expression and returns a CronExpression object.
     * @param expression The cron expression to parse.
     * @param [options] The options to use when parsing the expression.
     * @param [options.strict] If true, will throw an error if the expression contains both dayOfMonth and dayOfWeek, or a hashed range or step the field cannot satisfy.
     * @param [options.currentDate] The date to use when calculating the next/previous occurrence.
     * @returns A CronExpression object.
     */
    public static parse(expression: string, options: CronExpressionOptions = {}): CronExpression {
        const { hashSeed, strict = false } = options;
        const rand = seededRandom(hashSeed);

        expression = PredefinedExpressions[expression as keyof typeof PredefinedExpressions] || expression;
        const rawFields = CronExpressionParser.#getRawFields(expression, strict);

        if (!(rawFields.dayOfMonth === "*" || rawFields.dayOfWeek === "*" || !strict)) {
            throw new Error("Cannot use both dayOfMonth and dayOfWeek together in strict mode!");
        }

        const second = CronExpressionParser.#parseField(CronUnit.Second, rawFields.second, CronSecond.constraints, rand, strict) as SixtyRange[];
        const minute = CronExpressionParser.#parseField(CronUnit.Minute, rawFields.minute, CronMinute.constraints, rand, strict) as SixtyRange[];
        const hour = CronExpressionParser.#parseField(CronUnit.Hour, rawFields.hour, CronHour.constraints, rand, strict) as HourRange[];
        const month = CronExpressionParser.#parseField(CronUnit.Month, rawFields.month, CronMonth.constraints, rand, strict) as MonthRange[];
        const dayOfMonth = CronExpressionParser.#parseField(
            CronUnit.DayOfMonth,
            rawFields.dayOfMonth,
            CronDayOfMonth.constraints,
            rand,
            strict,
        ) as DayOfMonthRange[];
        const { dayOfWeek: _dayOfWeek, nthDayOfWeek } = CronExpressionParser.#parseNthDay(rawFields.dayOfWeek);
        const dayOfWeek = CronExpressionParser.#parseField(CronUnit.DayOfWeek, _dayOfWeek, CronDayOfWeek.constraints, rand, strict) as DayOfWeekRange[];

        const fields = new CronFieldCollection({
            dayOfMonth: CronDayOfMonth.fromMonth(month, dayOfMonth, { rawValue: rawFields.dayOfMonth }),
            dayOfWeek: new CronDayOfWeek(dayOfWeek, { nthDayOfWeek, rawValue: rawFields.dayOfWeek }),
            hour: new CronHour(hour, { rawValue: rawFields.hour }),
            minute: new CronMinute(minute, { rawValue: rawFields.minute }),
            month: new CronMonth(month, { rawValue: rawFields.month }),
            second: new CronSecond(second, { rawValue: rawFields.second }),
        });

        return new CronExpression(fields, { ...options, expression });
    }

    /**
     * Get the raw fields from a cron expression.
     * @param expression The cron expression to parse.
     * @param strict If true, will throw an error if the expression contains both dayOfMonth and dayOfWeek.
     * @private
     * @returns The raw fields.
     */
    static #getRawFields(expression: string, strict: boolean): RawCronFields {
        if (strict && expression.length === 0) {
            throw new Error("Invalid cron expression");
        }

        expression = expression || "0 * * * * *";

        if (expression.length > MAX_EXPRESSION_LENGTH) {
            throw new Error(`Invalid cron expression, too long, expected at most ${MAX_EXPRESSION_LENGTH} characters`);
        }

        const atoms = expression.trim().split(/\s+/);

        if (strict && atoms.length < 6) {
            throw new Error("Invalid cron expression, expected 6 fields");
        }

        if (atoms.length > 6) {
            throw new Error("Invalid cron expression, too many fields");
        }

        const defaults = ["0", "*", "*", "*", "*", "*"];

        if (atoms.length < defaults.length) {
            atoms.unshift(...defaults.slice(0, defaults.length - atoms.length));
        }

        const [second, minute, hour, dayOfMonth, month, dayOfWeek] = atoms as [string, string, string, string, string, string];

        return { dayOfMonth, dayOfWeek, hour, minute, month, second };
    }

    /**
     * Parse a field from a cron expression.
     * @param field The field to parse.
     * @param value The value of the field.
     * @param constraints The constraints for the field.
     * @param rand The random number generator to use.
     * @param strict If true, will throw an error on an unusable hashed range or step.
     * @private
     * @returns The parsed field.
     */
    static #parseField(field: CronUnit, value: string, constraints: CronConstraints, rand: PRNG, strict: boolean): (number | string)[] {
        // A bare `*` or `?` is by far the most common field and always expands to the same values.
        const isWildcard = value === "*" || value === "?";
        const known = isWildcard ? CronExpressionParser.#wildcards.get(field) : undefined;

        if (known) {
            // Every field draws a number, so the seed gives the same picks as ever.
            rand();

            return [...known];
        }

        // Replace aliases for month and dayOfWeek
        if (field === CronUnit.Month || field === CronUnit.DayOfWeek) {
            value = value.replaceAll(/[a-z]{3}/gi, (match) => {
                match = match.toLowerCase();
                const replacer = Months[match as keyof typeof Months] || DayOfWeek[match as keyof typeof DayOfWeek];

                if (replacer === undefined) {
                    throw new Error(`Validation error, cannot resolve alias "${match}"`);
                }

                return replacer.toString();
            });
        }

        // Check for valid characters
        if (!constraints.validChars.test(value)) {
            throw new Error(`Invalid characters, got value: ${value}`);
        }

        value = this.#parseWildcard(value, constraints);
        value = this.#parseHashed(value, constraints, rand, field, strict);

        const values = this.#parseSequence(field, value, constraints);

        if (isWildcard) {
            CronExpressionParser.#wildcards.set(field, [...values]);
        }

        return values;
    }

    /**
     * Parse a wildcard from a cron expression.
     * @param value The value to parse.
     * @param constraints The constraints for the field.
     * @private
     */
    static #parseWildcard(value: string, constraints: CronConstraints): string {
        if (!value.includes("*") && !value.includes("?")) {
            return value;
        }

        return value.replaceAll(/[*?]/g, `${constraints.min}-${constraints.max}`);
    }

    /**
     * Parse a hashed value from a cron expression.
     * @param value The value to parse.
     * @param constraints The constraints for the field.
     * @param rand The random number generator to use.
     * @param field The field being parsed, used when reporting an unusable range or step.
     * @param strict If true, will throw an error on an unusable hashed range or step.
     * @private
     */
    static #parseHashed(value: string, constraints: CronConstraints, rand: PRNG, field: CronUnit, strict: boolean): string {
        // Every field draws a number, with or without a hashed value in it, so the seed gives the same picks as ever.
        const randomValue = rand();
        let count = 0;

        if (!value.includes("H")) {
            return value;
        }

        return value.replaceAll(/H(?:\((\d+)-(\d+)\))?(?:\/(\d+))?/g, (_, min, max, step) => {
            // H(range)/step
            if (min && max && step) {
                const minNumber = Number.parseInt(min, 10);
                const maxNumber = Number.parseInt(max, 10);
                const stepNumber = Number.parseInt(step, 10);

                if (stepNumber <= 0) {
                    throw new Error(`Invalid step: ${stepNumber}, must be positive`);
                }

                const range = CronExpressionParser.#hashedRange(minNumber, maxNumber, constraints, field, strict);

                count += Math.ceil((range.max - range.min + 1) / stepNumber);
                CronExpressionParser.#assertMaxFieldValues(field, count);

                return CronExpressionParser.#hashedStep(randomValue, range.min, range.max, stepNumber, field, strict);
            }

            // H(range)
            if (min && max) {
                const minNumber = Number.parseInt(min, 10);
                const maxNumber = Number.parseInt(max, 10);

                const range = CronExpressionParser.#hashedRange(minNumber, maxNumber, constraints, field, strict);

                return String(CronExpressionParser.#hashedValue(randomValue, range.min, range.max));
            }

            // H/step
            if (step) {
                const stepNumber = Number.parseInt(step, 10);

                // Validate step
                if (stepNumber <= 0) {
                    throw new Error(`Invalid step: ${stepNumber}, must be positive`);
                }

                count += Math.ceil((constraints.max - constraints.min + 1) / stepNumber);
                CronExpressionParser.#assertMaxFieldValues(field, count);

                return CronExpressionParser.#hashedStep(randomValue, constraints.min, constraints.max, stepNumber, field, strict);
            }
            // H

            return String(CronExpressionParser.#hashedValue(randomValue, constraints.min, constraints.max));
        });
    }

    /**
     * Pick a single hashed value within an inclusive range.
     * @param randomValue The seeded random value in [0, 1).
     * @param min Lowest value that may be picked.
     * @param max Highest value that may be picked.
     * @private
     */
    static #hashedValue(randomValue: number, min: number, max: number): number {
        return Math.floor(randomValue * (max - min + 1)) + min;
    }

    /**
     * Name a field the way the expression object does, rather than the Pascal case of CronUnit.
     * @param field The field to name.
     * @private
     */
    static #fieldName(field: CronUnit): string {
        return field.charAt(0).toLowerCase() + field.slice(1);
    }

    /**
     * Narrow an explicit hashed range to the values the field can hold, so that values are only
     * ever drawn from the range a step is measured against. In strict mode a bound outside the
     * field constraints is rejected instead of clamped, which keeps the range reported in the
     * error the one that was written.
     * @param min Lowest value the expression asks for.
     * @param max Highest value the expression asks for.
     * @param constraints The constraints for the field.
     * @param field The field being parsed, used when reporting an unusable range.
     * @param strict If true, will throw an error on a range outside the constraints.
     * @private
     */
    static #hashedRange(min: number, max: number, constraints: CronConstraints, field: CronUnit, strict: boolean): { max: number; min: number } {
        if (min > max) {
            throw new Error(`Invalid range: ${min}-${max}, min > max`);
        }

        if (strict && (min < constraints.min || max > constraints.max)) {
            throw new Error(
                `Invalid range: ${min}-${max}, outside the ${constraints.min}-${constraints.max} range of the ${CronExpressionParser.#fieldName(field)} field`,
            );
        }

        const rangeMin = Math.max(min, constraints.min);
        const rangeMax = Math.min(max, constraints.max);

        if (rangeMin > rangeMax) {
            throw new Error(`Invalid range: ${min}-${max}, no usable value in the ${CronExpressionParser.#fieldName(field)} field`);
        }

        return { max: rangeMax, min: rangeMin };
    }

    /**
     * Build the hashed values of a stepped range, offset from the start of the step by the seeded
     * jitter. A step wider than the range leaves no step-aligned value inside it, so a single
     * hashed occurrence within the range is used instead of an empty field, or in strict mode the
     * expression is rejected as unsatisfiable.
     * @param randomValue The seeded random value in [0, 1).
     * @param min Lowest value the range allows.
     * @param max Highest value the range allows.
     * @param step The step between values, already validated as positive.
     * @param field The field being parsed, used when reporting an unusable step.
     * @param strict If true, will throw an error on a step wider than its range.
     * @private
     */
    static #hashedStep(randomValue: number, min: number, max: number, step: number, field: CronUnit, strict: boolean): string {
        if (strict && step > max - min + 1) {
            throw new Error(`Invalid step: ${step}, wider than the ${min}-${max} range of the ${CronExpressionParser.#fieldName(field)} field`);
        }

        const offset = Math.floor(randomValue * step);
        const values = [];

        for (let i = Math.floor(min / step) * step + offset; i <= max; i += step) {
            if (i >= min) {
                values.push(i);
            }
        }

        if (values.length === 0) {
            return String(CronExpressionParser.#hashedValue(randomValue, min, max));
        }

        return values.join(",");
    }

    /**
     * Throw once a field has expanded to more than MAX_FIELD_VALUES values.
     * @param field The field being parsed.
     * @param count The number of values collected so far.
     * @private
     */
    static #assertMaxFieldValues(field: CronUnit, count: number): void {
        if (count > MAX_FIELD_VALUES) {
            throw new Error(`Constraint error, too many values in ${field} field, expected at most ${MAX_FIELD_VALUES}`);
        }
    }

    /**
     * Parse a sequence from a cron expression.
     * @param field The field to parse.
     * @param val The sequence to parse.
     * @param constraints The constraints for the field.
     * @private
     */

    /**
     * Reads `LW`, `L-&lt;days>` or `&lt;day>W` from a day of month list, checking its numbers.
     * @param atom The text, already known to have one of those shapes.
     * @returns The text with its numbers written plainly.
     * @throws {Error} When a number is out of range.
     */
    static #parseDayOfMonthText(atom: string): string {
        if (readDayOfMonthText(atom) === undefined) {
            const hint = atom.startsWith("L") ? "an offset of 1-30 days from the last day" : "a day from 1-31 before the W";

            throw new Error(`Constraint error, got value ${atom} expected ${hint}`);
        }

        return normalizeDayOfMonthText(atom);
    }

    static #parseSequence(field: CronUnit, value: string, constraints: CronConstraints): (number | string)[] {
        const stack: (number | string)[] = [];

        function handleResult(result: number | string | (number | string)[], constraints: CronConstraints) {
            if (Array.isArray(result)) {
                stack.push(...result);
            } else if (CronExpressionParser.#isValidConstraintChar(constraints, result)) {
                stack.push(result);
            } else {
                const v = Number.parseInt(result.toString(), 10);
                const isValid = v >= constraints.min && v <= constraints.max;

                if (!isValid) {
                    throw new Error(`Constraint error, got value ${result} expected range ${constraints.min}-${constraints.max}`);
                }

                stack.push(field === CronUnit.DayOfWeek ? v % 7 : result);
            }
        }

        const atoms = value.split(",");

        for (const atom of atoms) {
            CronExpressionParser.#assertMaxFieldValues(field, stack.length);

            if (atom.length === 0) {
                throw new Error("Invalid list value format");
            }

            if (field === CronUnit.DayOfMonth && looksLikeDayOfMonthText(atom)) {
                stack.push(CronExpressionParser.#parseDayOfMonthText(atom));
                continue;
            }

            // `W` only means something in `<day>W` and `LW`, never inside a range or a step.
            if (field === CronUnit.DayOfMonth && atom.includes("W")) {
                throw new Error(`Constraint error, got value ${atom} expected W only after a day, as in 15W, or after L, as in LW`);
            }

            handleResult(CronExpressionParser.#parseRepeat(field, atom, constraints), constraints);
        }

        return stack;
    }

    /**
     * Parse repeat from a cron expression.
     * @param field The field to parse.
     * @param val The repeat to parse.
     * @param constraints The constraints for the field.
     * @private
     * @returns The parsed repeat.
     */
    static #parseRepeat(field: CronUnit, value: string, constraints: CronConstraints): ParseRangeResponse {
        const atoms = value.split("/");

        if (atoms.length > 2) {
            throw new Error(`Invalid repeat: ${value}`);
        }

        if (atoms.length === 2) {
            const [range, step] = atoms as [string, string];

            return CronExpressionParser.#parseRange(field, range.includes("-") ? range : `${range}-${constraints.max}`, Number.parseInt(step, 10), constraints);
        }

        return CronExpressionParser.#parseRange(field, value, 1, constraints);
    }

    /**
     * Validate a cron range.
     * @param min The minimum value of the range.
     * @param max The maximum value of the range.
     * @param constraints The constraints for the field.
     * @private
     * @returns
     * @throws {Error} Throws an error if the range is invalid.
     */
    static #validateRange(min: number, max: number, constraints: CronConstraints): void {
        const isValid = !Number.isNaN(min) && !Number.isNaN(max) && min >= constraints.min && max <= constraints.max;

        if (!isValid) {
            throw new Error(`Constraint error, got range ${min}-${max} expected range ${constraints.min}-${constraints.max}`);
        }

        if (min > max) {
            throw new Error(`Invalid range: ${min}-${max}, min(${min}) > max(${max})`);
        }
    }

    /**
     * Validate a cron repeat interval.
     * @param repeatInterval The repeat interval to validate.
     * @private
     * @returns
     * @throws {Error} Throws an error if the repeat interval is invalid.
     */
    static #validateRepeatInterval(repeatInterval: number): void {
        if (!(!Number.isNaN(repeatInterval) && repeatInterval > 0)) {
            throw new Error(`Constraint error, cannot repeat at every ${repeatInterval} time.`);
        }
    }

    /**
     * Create a range from a cron expression.
     * @param field The field to parse.
     * @param min The minimum value of the range.
     * @param max The maximum value of the range.
     * @param repeatInterval The repeat interval of the range.
     * @private
     * @returns The created range.
     */
    static #createRange(field: CronUnit, min: number, max: number, repeatInterval: number): number[] {
        const stack: number[] = [];

        if (field === CronUnit.DayOfWeek && max % 7 === 0 && (max - min) % repeatInterval === 0) {
            stack.push(0);
        }

        for (let index = min; index <= max; index += repeatInterval) {
            // The values only ever repeat for the Sunday that a day of week range can add up front as 0.
            if (index !== 0 || stack.length === 0) {
                stack.push(index);
            }
        }

        return stack;
    }

    /**
     * Parse a range from a cron expression.
     * @param field The field to parse.
     * @param val The range to parse.
     * @param repeatInterval The repeat interval of the range.
     * @param constraints The constraints for the field.
     * @private
     * @returns The parsed range.
     */
    static #parseRange(field: CronUnit, value: string, repeatInterval: number, constraints: CronConstraints): ParseRangeResponse {
        const atoms: string[] = value.split("-");

        if (atoms.length <= 1) {
            return Number.isNaN(+value) ? value : +value;
        }

        if (atoms.length > 2) {
            throw new Error(`Invalid range: ${value}`);
        }

        const [min, max] = atoms.map((number_) => Number.parseInt(number_, 10)) as [number, number];

        this.#validateRange(min, max, constraints);
        this.#validateRepeatInterval(repeatInterval);

        // Create range
        return this.#createRange(field, min, max, repeatInterval);
    }

    /**
     * Parse a cron expression.
     * @param val The cron expression to parse.
     * @private
     * @returns The parsed cron expression.
     */
    static #parseNthDay(value: string): { dayOfWeek: string; nthDayOfWeek?: number } {
        const atoms = value.split("#");

        if (atoms.length <= 1) {
            return { dayOfWeek: atoms[0] as string };
        }

        const nthValue = Number(atoms.at(-1));
        const matches = value.match(/([,\-/])/);

        if (matches !== null) {
            throw new Error(`Constraint error, invalid dayOfWeek \`#\` and \`${matches?.[0]}\` special characters are incompatible`);
        }

        if (!(atoms.length <= 2 && !Number.isNaN(nthValue) && nthValue >= 1 && nthValue <= 5)) {
            throw new Error("Constraint error, invalid dayOfWeek occurrence number (#)");
        }

        return { dayOfWeek: atoms[0] as string, nthDayOfWeek: nthValue };
    }

    /**
     * Checks if a character is valid for a field.
     * @param constraints The constraints for the field.
     * @param value The value to check.
     * @private
     * @returns Whether the character is valid for the field.
     */
    static #isValidConstraintChar(constraints: CronConstraints, value: string | number): boolean {
        return constraints.chars.some((char) => value.toString().includes(char));
    }
}

export { CronExpressionParser, CronUnit, DayOfWeek, Months, PredefinedExpressions };
export type { RawCronFields };
