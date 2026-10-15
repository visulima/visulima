/* eslint-disable @typescript-eslint/naming-convention, @typescript-eslint/no-shadow, @typescript-eslint/no-unnecessary-condition, @typescript-eslint/no-unsafe-argument, @typescript-eslint/restrict-template-expressions, e18e/prefer-static-regex, func-style, no-param-reassign, sonarjs/different-types-comparison, sonarjs/prefer-regexp-exec -- ported from the reference implementation, whose behaviour its tests pin; these style rules stay relaxed so the code remains easy to compare with the original (the search engine in schedule.ts, zone.ts and cron-expression.ts has no such exceptions) */
import type { CronExpressionOptions } from "./cron-expression";
import { CronExpression } from "./cron-expression";
import { CronFieldCollection } from "./cron-field-collection";
import type { CronFeature, ResolvedFeatures } from "./dialect";
import { resolveFeatures } from "./dialect";
import type { CronFieldName } from "./errors";
import { CronParseError } from "./errors";
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

/**
 * The six fields of an expression, in the order the parser works through them.
 *
 * Written as an explicit union rather than `(typeof CronUnit)[keyof typeof CronUnit]`, so the emitted
 * declaration does not merge the value and the type into an invalid `type CronUnit: { … } = …`.
 */
type CronUnit = "DayOfMonth" | "DayOfWeek" | "Hour" | "Minute" | "Month" | "Second";

const CronUnit: { readonly [Unit in CronUnit]: Unit } = {
    DayOfMonth: "DayOfMonth",
    DayOfWeek: "DayOfWeek",
    Hour: "Hour",
    Minute: "Minute",
    Month: "Month",
    Second: "Second",
};

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

/** Each field as the option and error names spell it, so `#fieldName` cannot drift from `CronFieldName`. */

const FIELD_NAMES: Record<CronUnit, CronFieldName> = {
    DayOfMonth: "dayOfMonth",
    DayOfWeek: "dayOfWeek",
    Hour: "hour",
    Minute: "minute",
    Month: "month",
    Second: "second",
};

/** The state one parse threads through its helpers: the dialect's syntax, the seeded random source, strictness and the extensions used so far. */

type ParseContext = {
    features: ResolvedFeatures;
    rand: PRNG;
    strict: boolean;
    used: Set<CronFeature>;
};

/**
 * Parses cron expressions into `CronExpression` objects. The reference implementation's `CronExpressionParser`
 * class is gone: `parse` is the one entry point, and every helper below it is module private.
 */

/**
 * What a bare `*` expands to in each field, worked out the first time it is met. The key carries the
 * field's range, because the dialect can change it (`sundayIsOne` reads the day of week as 1-7) and a
 * `*` must not hand a whole field the expansion of another dialect.
 */
const wildcards = new Map<string, (number | string)[]>();

/**
 * Name a field the way the expression object does, rather than the Pascal case of CronUnit.
 * @param field The field to name.
 * @private
 */
function fieldName(field: CronUnit): CronFieldName {
    return FIELD_NAMES[field];
}

/**
 * Builds the error for syntax a dialect does not allow.
 * @param feature The feature that was turned off.
 * @param field The field it was found in, when it is in one.
 * @param token The atom that used it.
 * @returns The error to throw.
 * @private
 */
function unsupported(feature: CronFeature, field: CronUnit | undefined, token: string): CronParseError {
    return new CronParseError(`Unsupported feature "${feature}" in the selected dialect`, {
        code: "UNSUPPORTED_FEATURE",
        field: field === undefined ? undefined : fieldName(field),
        token,
    });
}

/**
 * Checks that the dialect takes a piece of syntax, and records that the expression uses it.
 * @param feature The syntax the atom uses.
 * @param context The state of this parse.
 * @param field The field the atom is in, when it is in one.
 * @param token The atom that uses it.
 * @throws {CronParseError} When the dialect turns the feature off.
 * @private
 */
function requireFeature(feature: CronFeature, context: ParseContext, field: CronUnit | undefined, token: string): void {
    if (!context.features[feature]) {
        throw unsupported(feature, field, token);
    }

    context.used.add(feature);
}

/**
 * Moves the weekday in front of an `L` (`5L`) from Cloudflare's 1-7 scale to 0-6. Any other text is returned as it is.
 * @param value A day of week text such as `5L`.
 * @returns The text on the 0-6 scale.
 * @throws {CronParseError} When the weekday is outside 1-7.
 * @private
 */
function lastWeekdayToZeroBased(value: string): string {
    const lastWeekday = /^(\d+)L$/.exec(value);

    if (lastWeekday === null) {
        return value;
    }

    const weekday = Number.parseInt(lastWeekday[1] as string, 10);

    if (weekday < 1 || weekday > 7) {
        throw new CronParseError(`Constraint error, got value ${String(weekday)} expected range 1-7`, {
            code: "FIELD_RANGE",
            field: fieldName(CronUnit.DayOfWeek),
            token: value,
        });
    }

    return `${String(weekday - 1)}L`;
}

/**
 * Moves the weekdays of a day of week field from Cloudflare's scale (1 = Sunday to 7 = Saturday) to this
 * package's (0 = Sunday to 6 = Saturday). A number moves by one; a text such as `5L` moves the number in front
 * of its `L` the same way.
 * @param values The values the field parsed to on the 1-7 scale.
 * @returns The values on the 0-6 scale.
 * @throws {CronParseError} When a weekday in a `nL` text is outside 1-7.
 * @private
 */
function toZeroBasedWeekdays(values: (number | string)[]): (number | string)[] {
    // The list mixes numbers with texts such as `5L`, and both move; the rule cannot see that the branches meet in one union.
    // eslint-disable-next-line sonarjs/function-return-type
    return values.map((value): number | string => {
        if (typeof value === "number") {
            return value - 1;
        }

        return lastWeekdayToZeroBased(value);
    });
}

/**
 * Get the raw fields from a cron expression.
 * @param expression The cron expression to parse, after a nickname has been expanded.
 * @param atoms The expression split on its whitespace.
 * @param strict If true, will throw an error if the expression is empty or has fewer fields than the grammar defines.
 * @param features The syntax the chosen dialect allows.
 * @param nickname Whether the expression is a nickname's expansion, which always has six fields and is judged on its written form, not on that expansion.
 * @private
 * @returns The six field strings, keyed by field name.
 */
function getRawFields(expression: string, atoms: string[], strict: boolean, features: ResolvedFeatures, nickname: boolean): RawCronFields {
    if (strict && expression.length === 0) {
        throw new CronParseError("Invalid cron expression", { code: "EMPTY_EXPRESSION" });
    }

    if (expression.length > MAX_EXPRESSION_LENGTH) {
        throw new CronParseError(`Invalid cron expression, too long, expected at most ${MAX_EXPRESSION_LENGTH} characters`, {
            code: "EXPRESSION_TOO_LONG",
        });
    }

    // A blank expression is the default every-minute schedule, which has five fields where seconds are forbidden.
    const blankFields = features.seconds === "forbid" ? ["*", "*", "*", "*", "*"] : ["0", "*", "*", "*", "*", "*"];
    const fields = expression === "" ? blankFields : [...atoms];
    const maxFields = features.seconds === "forbid" && !nickname ? 5 : 6;
    // A strict parse never pads. It takes the field count the grammar defines, the cron spec's five,
    // or the six a required seconds field adds, and rejects anything shorter.
    let minFields = 0;

    if (features.seconds === "require") {
        minFields = 6;
    } else if (strict) {
        minFields = 5;
    }

    if (fields.length > maxFields) {
        throw new CronParseError("Invalid cron expression, too many fields", { code: "FIELD_COUNT" });
    }

    if (fields.length < minFields) {
        throw new CronParseError(`Invalid cron expression, expected ${minFields} fields`, { code: "FIELD_COUNT" });
    }

    const defaults = ["0", "*", "*", "*", "*", "*"];

    if (fields.length < defaults.length) {
        fields.unshift(...defaults.slice(0, defaults.length - fields.length));
    }

    const [second, minute, hour, dayOfMonth, month, dayOfWeek] = fields as [string, string, string, string, string, string];

    return { dayOfMonth, dayOfWeek, hour, minute, month, second };
}

/**
 * Parse a wildcard from a cron expression.
 * @param value The value to parse.
 * @param constraints The constraints for the field.
 * @private
 */
function parseWildcard(value: string, constraints: CronConstraints): string {
    if (!value.includes("*") && !value.includes("?")) {
        return value;
    }

    return value.replaceAll(/[*?]/g, `${constraints.min}-${constraints.max}`);
}

/**
 * Pick a single hashed value within an inclusive range.
 * @param randomValue The seeded random value in [0, 1).
 * @param min Lowest value that may be picked.
 * @param max Highest value that may be picked.
 * @private
 */
function hashedValue(randomValue: number, min: number, max: number): number {
    return Math.floor(randomValue * (max - min + 1)) + min;
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
function hashedRange(min: number, max: number, constraints: CronConstraints, field: CronUnit, strict: boolean): { max: number; min: number } {
    if (min > max) {
        throw new CronParseError(`Invalid range: ${min}-${max}, min > max`, {
            code: "INVALID_RANGE",
            field: fieldName(field),
            token: `${min}-${max}`,
        });
    }

    if (strict && (min < constraints.min || max > constraints.max)) {
        throw new CronParseError(`Invalid range: ${min}-${max}, outside the ${constraints.min}-${constraints.max} range of the ${fieldName(field)} field`, {
            code: "FIELD_RANGE",
            field: fieldName(field),
            token: `${min}-${max}`,
        });
    }

    const rangeMin = Math.max(min, constraints.min);
    const rangeMax = Math.min(max, constraints.max);

    if (rangeMin > rangeMax) {
        throw new CronParseError(`Invalid range: ${min}-${max}, no usable value in the ${fieldName(field)} field`, {
            code: "FIELD_RANGE",
            field: fieldName(field),
            token: `${min}-${max}`,
        });
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
function hashedStep(randomValue: number, min: number, max: number, step: number, field: CronUnit, strict: boolean): string {
    if (strict && step > max - min + 1) {
        throw new CronParseError(`Invalid step: ${step}, wider than the ${min}-${max} range of the ${fieldName(field)} field`, {
            code: "INVALID_STEP",
            field: fieldName(field),
            token: String(step),
        });
    }

    const offset = Math.floor(randomValue * step);
    const values = [];

    for (let i = Math.floor(min / step) * step + offset; i <= max; i += step) {
        if (i >= min) {
            values.push(i);
        }
    }

    if (values.length === 0) {
        return String(hashedValue(randomValue, min, max));
    }

    return values.join(",");
}

/**
 * Throw once a field has expanded to more than MAX_FIELD_VALUES values.
 * @param field The field being parsed.
 * @param count The number of values collected so far.
 * @private
 */
function assertMaxFieldValues(field: CronUnit, count: number): void {
    if (count > MAX_FIELD_VALUES) {
        throw new CronParseError(`Constraint error, too many values in ${field} field, expected at most ${MAX_FIELD_VALUES}`, {
            code: "TOO_MANY_VALUES",
            field: fieldName(field),
        });
    }
}

/**
 * Parse a hashed value from a cron expression.
 * @param value The value to parse.
 * @param constraints The constraints for the field.
 * @param field The field being parsed, used when reporting an unusable range or step.
 * @param context The state of this parse; `strict` makes an unusable hashed range or step an error.
 * @private
 */
function parseHashed(value: string, constraints: CronConstraints, field: CronUnit, context: ParseContext): string {
    // Every field draws a number, with or without a hashed value in it, so the seed gives the same picks as ever.
    const randomValue = context.rand();
    const { strict } = context;
    let count = 0;

    if (!value.includes("H")) {
        return value;
    }

    requireFeature("hashed", context, field, value);

    return value.replaceAll(/H(?:\((\d+)-(\d+)\))?(?:\/(\d+))?/g, (_, min, max, step) => {
        // H(range)/step
        if (min && max && step) {
            const minNumber = Number.parseInt(min, 10);
            const maxNumber = Number.parseInt(max, 10);
            const stepNumber = Number.parseInt(step, 10);

            if (stepNumber <= 0) {
                throw new CronParseError(`Invalid step: ${stepNumber}, must be positive`, {
                    code: "INVALID_STEP",
                    field: fieldName(field),
                    token: value,
                });
            }

            const range = hashedRange(minNumber, maxNumber, constraints, field, strict);

            count += Math.ceil((range.max - range.min + 1) / stepNumber);
            assertMaxFieldValues(field, count);

            return hashedStep(randomValue, range.min, range.max, stepNumber, field, strict);
        }

        // H(range)
        if (min && max) {
            const minNumber = Number.parseInt(min, 10);
            const maxNumber = Number.parseInt(max, 10);

            const range = hashedRange(minNumber, maxNumber, constraints, field, strict);

            return String(hashedValue(randomValue, range.min, range.max));
        }

        // H/step
        if (step) {
            const stepNumber = Number.parseInt(step, 10);

            // Validate step
            if (stepNumber <= 0) {
                throw new CronParseError(`Invalid step: ${stepNumber}, must be positive`, {
                    code: "INVALID_STEP",
                    field: fieldName(field),
                    token: value,
                });
            }

            count += Math.ceil((constraints.max - constraints.min + 1) / stepNumber);
            assertMaxFieldValues(field, count);

            return hashedStep(randomValue, constraints.min, constraints.max, stepNumber, field, strict);
        }
        // H

        return String(hashedValue(randomValue, constraints.min, constraints.max));
    });
}

/**
 * Records a `5L` day of week text, rejecting it when the dialect does not take it.
 * @param atom The day of week text, such as `5L`.
 * @param context The state of this parse.
 * @throws {CronParseError} When the dialect does not take `nL`.
 * @private
 */
function assertLastDayOfWeek(atom: string, context: ParseContext): void {
    requireFeature("lastDayOfWeek", context, CronUnit.DayOfWeek, atom);
}

/**
 * Rejects a day of month text that shares the field with another atom, which Cloudflare does not
 * allow: `1,15` is fine, `1,15W` and `L-1,L-2` are not.
 * @param field The field being parsed.
 * @param value The whole field, for the error.
 * @param atoms The field split on its commas.
 * @param features The syntax the chosen dialect allows.
 * @throws {CronParseError} When the field mixes a text with another atom and the dialect forbids it.
 * @private
 */
function assertNoMixedDayOfMonthText(field: CronUnit, value: string, atoms: string[], features: ResolvedFeatures): void {
    if (field !== CronUnit.DayOfMonth || features.mixedDayOfMonthText || atoms.length <= 1) {
        return;
    }

    if (!atoms.some((atom) => looksLikeDayOfMonthText(atom))) {
        return;
    }

    throw new CronParseError("Constraint error, a day of month text such as LW or L-3 has to stand alone in this dialect", {
        code: "FIELD_VALUE",
        field: fieldName(field),
        token: value,
    });
}

/**
 * The value a day of month atom stands for, when it is one of the texts that go beyond a plain
 * day: `L`, `nL`, `LW`, `L-n` or `nW`.
 * @param atom One entry of a day of month list.
 * @param context The state of this parse.
 * @returns The normalized value, or undefined when the atom is an ordinary day or range.
 * @throws {CronParseError} When the atom has one of the shapes but is out of range, or turned off.
 * @private
 */
function readDayOfMonthAtom(atom: string, context: ParseContext): string | undefined {
    const read = readDayOfMonthText(atom);

    if (read === undefined) {
        if (looksLikeDayOfMonthText(atom)) {
            const hint = atom.startsWith("L") ? "an offset of 1-30 days from the last day" : "a day from 1-31 before the W";

            throw new CronParseError(`Constraint error, got value ${atom} expected ${hint}`, {
                code: "FIELD_VALUE",
                field: fieldName(CronUnit.DayOfMonth),
                token: atom,
            });
        }

        // `W` only means something in `<day>W` and `LW`, never inside a range or a step.
        if (atom.includes("W")) {
            throw new CronParseError(`Constraint error, got value ${atom} expected W only after a day, as in 15W, or after L, as in LW`, {
                code: "FIELD_VALUE",
                field: fieldName(CronUnit.DayOfMonth),
                token: atom,
            });
        }

        return undefined;
    }

    // Each kind names the feature it needs, one for one, so a dialect that turns one off rejects it here.
    requireFeature(read.kind, context, CronUnit.DayOfMonth, atom);

    return normalizeDayOfMonthText(atom);
}

/**
 * Rejects a step as large as the field itself, which Cloudflare does not allow: the day of week field
 * has 7 values, so a step of 6 is fine and a step of 7 is not, and it is the field's size that decides,
 * so minutes allow a step of 59.
 * @param field The field being parsed.
 * @param step The step, already read as a number.
 * @param constraints The constraints for the field.
 * @param features The syntax the chosen dialect allows.
 * @throws {CronParseError} When the step reaches the size of the field and the dialect forbids it.
 * @private
 */
function assertStepWithinField(field: CronUnit, step: number, constraints: CronConstraints, features: ResolvedFeatures): void {
    const fieldSize = constraints.max - constraints.min + 1;

    if (features.largeSteps || step < fieldSize) {
        return;
    }

    throw new CronParseError(`Constraint error, step ${step} has to be smaller than the ${fieldSize} values of the ${fieldName(field)} field`, {
        code: "INVALID_STEP",
        field: fieldName(field),
        token: String(step),
    });
}

/**
 * Validate a cron range.
 * @param min The minimum value of the range.
 * @param max The maximum value of the range.
 * @param constraints The constraints for the field.
 * @param field The field being parsed, used when reporting an invalid range.
 * @private
 * @throws {CronParseError} Throws an error if the range is invalid.
 */
function validateRange(min: number, max: number, constraints: CronConstraints, field: CronUnit): void {
    const isValid = !Number.isNaN(min) && !Number.isNaN(max) && min >= constraints.min && max <= constraints.max;

    if (!isValid) {
        throw new CronParseError(`Constraint error, got range ${min}-${max} expected range ${constraints.min}-${constraints.max}`, {
            code: "FIELD_RANGE",
            field: fieldName(field),
            token: `${min}-${max}`,
        });
    }

    if (min > max) {
        throw new CronParseError(`Invalid range: ${min}-${max}, min(${min}) > max(${max})`, {
            code: "INVALID_RANGE",
            field: fieldName(field),
            token: `${min}-${max}`,
        });
    }
}

/**
 * Validate a cron repeat interval.
 * @param repeatInterval The repeat interval to validate.
 * @param field The field being parsed, used when reporting an invalid step.
 * @private
 * @throws {CronParseError} Throws an error if the repeat interval is invalid.
 */
function validateRepeatInterval(repeatInterval: number, field: CronUnit): void {
    if (!(!Number.isNaN(repeatInterval) && repeatInterval > 0)) {
        throw new CronParseError(`Constraint error, cannot repeat at every ${repeatInterval} time.`, {
            code: "INVALID_STEP",
            field: fieldName(field),
            token: String(repeatInterval),
        });
    }
}

/**
 * Create a range from a cron expression.
 * @param field The field to parse.
 * @param min The minimum value of the range.
 * @param max The maximum value of the range.
 * @param repeatInterval The step between values; `1` takes every value.
 * @private
 * @returns The created range.
 */
function createRange(field: CronUnit, min: number, max: number, repeatInterval: number, sundayIsZero: boolean): number[] {
    const stack: number[] = [];

    if (field === CronUnit.DayOfWeek && sundayIsZero && max % 7 === 0 && (max - min) % repeatInterval === 0) {
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

// A single value comes back as a number or as text, a range as a list, so the return type is the union the response names.

/**
 * Parse a range from a cron expression.
 * @param field The field to parse.
 * @param value The range to parse.
 * @param repeatInterval The step between values; `1` takes every value.
 * @param constraints The constraints for the field.
 * @private
 * @returns The parsed range.
 */
function parseRange(field: CronUnit, value: string, repeatInterval: number, constraints: CronConstraints): ParseRangeResponse {
    const atoms: string[] = value.split("-");

    if (atoms.length <= 1) {
        return Number.isNaN(+value) ? value : +value;
    }

    if (atoms.length > 2) {
        throw new CronParseError(`Invalid range: ${value}`, { code: "INVALID_RANGE", field: fieldName(field), token: value });
    }

    const [min, max] = atoms.map((number_) => Number.parseInt(number_, 10)) as [number, number];

    validateRange(min, max, constraints, field);
    validateRepeatInterval(repeatInterval, field);

    // Create range
    return createRange(field, min, max, repeatInterval, constraints.min === 0);
}

/**
 * Parse repeat from a cron expression.
 * @param field The field to parse.
 * @param value The repeat to parse.
 * @param constraints The constraints for the field.
 * @param features The syntax the chosen dialect allows.
 * @private
 * @returns The parsed repeat.
 */
function parseRepeat(field: CronUnit, value: string, constraints: CronConstraints, features: ResolvedFeatures): ParseRangeResponse {
    const atoms = value.split("/");

    if (atoms.length > 2) {
        throw new CronParseError(`Invalid repeat: ${value}`, { code: "INVALID_REPEAT", field: fieldName(field), token: value });
    }

    if (atoms.length === 2) {
        const [range, step] = atoms as [string, string];
        const stepNumber = Number.parseInt(step, 10);

        assertStepWithinField(field, stepNumber, constraints, features);

        return parseRange(field, range.includes("-") ? range : `${range}-${constraints.max}`, stepNumber, constraints);
    }

    return parseRange(field, value, 1, constraints);
}

/**
 * Checks if a character is valid for a field.
 * @param constraints The constraints for the field.
 * @param value The value to check.
 * @private
 * @returns Whether the character is valid.
 */
function isValidConstraintChar(constraints: CronConstraints, value: string | number): boolean {
    return constraints.chars.some((char) => value.toString().includes(char));
}

/**
 * Parse a sequence from a cron expression.
 * @param field The field to parse.
 * @param value The sequence to parse.
 * @param constraints The constraints for the field.
 * @param context The state of this parse.
 * @private
 */
function parseSequence(field: CronUnit, value: string, constraints: CronConstraints, context: ParseContext): (number | string)[] {
    const stack: (number | string)[] = [];

    function handleResult(result: number | string | (number | string)[], constraints: CronConstraints) {
        if (Array.isArray(result)) {
            stack.push(...result);
        } else if (isValidConstraintChar(constraints, result)) {
            stack.push(result);
        } else {
            const v = Number.parseInt(result.toString(), 10);
            const isValid = v >= constraints.min && v <= constraints.max;

            if (!isValid) {
                throw new CronParseError(`Constraint error, got value ${result} expected range ${constraints.min}-${constraints.max}`, {
                    code: "FIELD_RANGE",
                    field: fieldName(field),
                    token: result.toString(),
                });
            }

            stack.push(field === CronUnit.DayOfWeek && constraints.min === 0 ? v % 7 : result);
        }
    }

    const atoms = value.split(",");

    // Cloudflare refuses a day of month text that shares the field with anything else, so `1,15`
    // is fine but `1,15W` and `L-1,L-2` are not.
    assertNoMixedDayOfMonthText(field, value, atoms, context.features);

    for (const atom of atoms) {
        assertMaxFieldValues(field, stack.length);

        if (atom.length === 0) {
            throw new CronParseError("Invalid list value format", { code: "INVALID_LIST", field: fieldName(field) });
        }

        if (field === CronUnit.DayOfMonth) {
            const day = readDayOfMonthAtom(atom, context);

            if (day !== undefined) {
                stack.push(day);

                continue;
            }
        } else if (field === CronUnit.DayOfWeek && /^\d+L$/.test(atom)) {
            assertLastDayOfWeek(atom, context);
        }

        handleResult(parseRepeat(field, atom, constraints, context.features), constraints);
    }

    return stack;
}

/**
 * Parse a field from a cron expression.
 * @param field The field to parse.
 * @param value The expression text of this field.
 * @param constraints The constraints for the field.
 * @param context The state of this parse.
 * @private
 * @returns The parsed field.
 */
function parseField(field: CronUnit, value: string, constraints: CronConstraints, context: ParseContext): (number | string)[] {
    // A bare `*` or `?` is by far the most common field and always expands to the same values.
    const isWildcard = value === "*" || value === "?";

    // `?` has to be checked before the cache: the cache is per field, so a `?` in an earlier
    // expression would otherwise hand back its expansion without asking about the dialect.
    if (value.includes("?")) {
        requireFeature("noSpecificTime", context, field, value);
    }

    const cacheKey = `${field}:${String(constraints.min)}-${String(constraints.max)}`;
    const known = isWildcard ? wildcards.get(cacheKey) : undefined;

    if (known) {
        // Every field draws a number, so the seed gives the same picks as ever.
        context.rand();

        return [...known];
    }

    // Cloudflare numbers the weekdays 1 (Sunday) to 7 (Saturday); rewrite them to 0-6 before the
    // names are substituted, so a name (which means the same day everywhere) is left alone.
    // A bare `L` is the last day of the Cloudflare week, Saturday, which is 7 on that scale.
    if (field === CronUnit.DayOfWeek && context.features.sundayIsOne) {
        value = value.replaceAll(/(^|,)L(?=,|$)/g, (_match, prefix: string) => `${prefix}7`);
    }

    // Replace aliases for month and dayOfWeek
    if (field === CronUnit.Month || field === CronUnit.DayOfWeek) {
        value = value.replaceAll(/[a-z]{3}/gi, (match) => {
            match = match.toLowerCase();
            const replacer = Months[match as keyof typeof Months] || DayOfWeek[match as keyof typeof DayOfWeek];

            if (replacer === undefined) {
                throw new CronParseError(`Validation error, cannot resolve alias "${match}"`, {
                    code: "UNKNOWN_ALIAS",
                    field: fieldName(field),
                    token: match,
                });
            }

            // A name means the same day everywhere, so it is moved onto the dialect's scale like a number is.
            const sundayOffset = field === CronUnit.DayOfWeek && context.features.sundayIsOne ? 1 : 0;

            return String(replacer + sundayOffset);
        });
    }

    // Check for valid characters
    if (!constraints.validChars.test(value)) {
        throw new CronParseError(`Invalid characters, got value: ${value}`, {
            code: "FIELD_CHARACTER",
            field: fieldName(field),
            token: value,
        });
    }

    value = parseWildcard(value, constraints);
    value = parseHashed(value, constraints, field, context);

    const values = parseSequence(field, value, constraints, context);

    if (isWildcard) {
        wildcards.set(cacheKey, [...values]);
    }

    return values;
}

/**
 * Parse the nth day of week marker off a day of week field.
 * @param value The day of week field.
 * @param context The state of this parse.
 * @private
 * @returns The field without the marker, and the occurrence number when there was one.
 */
function parseNthDay(value: string, context: ParseContext): { dayOfWeek: string; nthDayOfWeek?: number } {
    const atoms = value.split("#");

    if (atoms.length <= 1) {
        return { dayOfWeek: atoms[0] as string };
    }

    requireFeature("nthDayOfWeek", context, CronUnit.DayOfWeek, value);

    const nthValue = Number(atoms.at(-1));
    const matches = value.match(/([,\-/])/);

    if (matches !== null) {
        throw new CronParseError(`Constraint error, invalid dayOfWeek \`#\` and \`${matches?.[0]}\` special characters are incompatible`, {
            code: "INVALID_NTH_DAY",
            field: fieldName(CronUnit.DayOfWeek),
            token: value,
        });
    }

    if (!(atoms.length <= 2 && !Number.isNaN(nthValue) && nthValue >= 1 && nthValue <= 5)) {
        throw new CronParseError("Constraint error, invalid dayOfWeek occurrence number (#)", {
            code: "INVALID_NTH_DAY",
            field: fieldName(CronUnit.DayOfWeek),
            token: value,
        });
    }

    return { dayOfWeek: atoms[0] as string, nthDayOfWeek: nthValue };
}

/**
 * Parses a cron expression and returns a CronExpression object.
 * @param expression The cron expression to parse.
 * @param [options] The options to use when parsing the expression.
 * @param [options.strict] If true, will throw an error if the expression contains both dayOfMonth and dayOfWeek, is shorter than the field count the grammar defines, or has a hashed range or step the field cannot satisfy.
 * @param [options.currentDate] The date to use when calculating the next/previous occurrence.
 * @param [options.dialect] The named grammar to hold the expression to; `extended` when none is given.
 * @param [options.features] Syntax to turn on or off on top of the dialect.
 * @returns A CronExpression object.
 */
export function parse(expression: string, options: CronExpressionOptions = {}): CronExpression {
    const { hashSeed, strict = false } = options;
    const context: ParseContext = {
        features: resolveFeatures(options.dialect, options.features, options.seconds),
        rand: seededRandom(hashSeed),
        strict,
        used: new Set<CronFeature>(),
    };

    const predefined = PredefinedExpressions[expression as keyof typeof PredefinedExpressions] as string | undefined;

    if (predefined !== undefined) {
        requireFeature("nicknames", context, undefined, expression);
        expression = predefined;
    }

    const atoms = expression.trim().split(/\s+/);

    // A seconds field, judged on what was written rather than on a nickname's expansion.
    if (predefined === undefined && atoms.length === 6) {
        context.used.add("seconds");
    }

    const rawFields = getRawFields(expression, atoms, strict, context.features, predefined !== undefined);

    if (!(rawFields.dayOfMonth === "*" || rawFields.dayOfWeek === "*" || !strict)) {
        throw new CronParseError("Cannot use both dayOfMonth and dayOfWeek together in strict mode!", { code: "STRICT_DAY_FIELDS" });
    }

    const second = parseField(CronUnit.Second, rawFields.second, CronSecond.constraints, context) as SixtyRange[];
    const minute = parseField(CronUnit.Minute, rawFields.minute, CronMinute.constraints, context) as SixtyRange[];
    const hour = parseField(CronUnit.Hour, rawFields.hour, CronHour.constraints, context) as HourRange[];
    const month = parseField(CronUnit.Month, rawFields.month, CronMonth.constraints, context) as MonthRange[];
    const dayOfMonth = parseField(CronUnit.DayOfMonth, rawFields.dayOfMonth, CronDayOfMonth.constraints, context) as DayOfMonthRange[];
    const { dayOfWeek: _dayOfWeek, nthDayOfWeek } = parseNthDay(rawFields.dayOfWeek, context);
    // Cloudflare numbers the weekdays 1 (Sunday) to 7 (Saturday): the field is parsed on that scale and moved to 0-6 once.
    const dayOfWeekConstraints: CronConstraints = context.features.sundayIsOne ? { ...CronDayOfWeek.constraints, min: 1 } : CronDayOfWeek.constraints;
    const dayOfWeekValues = parseField(CronUnit.DayOfWeek, _dayOfWeek, dayOfWeekConstraints, context);
    const dayOfWeek = (context.features.sundayIsOne ? toZeroBasedWeekdays(dayOfWeekValues) : dayOfWeekValues) as DayOfWeekRange[];
    const { used } = context;

    const fields = new CronFieldCollection({
        dayOfMonth: CronDayOfMonth.fromMonth(month, dayOfMonth, { rawValue: rawFields.dayOfMonth }),
        dayOfWeek: new CronDayOfWeek(dayOfWeek, { nthDayOfWeek, rawValue: rawFields.dayOfWeek }),
        hour: new CronHour(hour, { rawValue: rawFields.hour }),
        minute: new CronMinute(minute, { rawValue: rawFields.minute }),
        month: new CronMonth(month, { rawValue: rawFields.month }),
        second: new CronSecond(second, { rawValue: rawFields.second }),
    });

    return new CronExpression(fields, options, used, expression);
}

export { CronUnit, DayOfWeek, Months, PredefinedExpressions };

export type { RawCronFields };
