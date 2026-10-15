/* eslint-disable @typescript-eslint/naming-convention, @typescript-eslint/no-extraneous-class, @typescript-eslint/no-shadow, @typescript-eslint/no-unnecessary-condition, @typescript-eslint/no-unsafe-argument, @typescript-eslint/restrict-template-expressions, e18e/prefer-static-regex, func-style, jsdoc/require-returns-check, no-param-reassign, sonarjs/different-types-comparison, sonarjs/prefer-regexp-exec -- ported from the reference implementation, whose behaviour its tests pin; these style rules stay relaxed so the code remains easy to compare with the original (the search engine in schedule.ts, zone.ts and cron-expression.ts has no such exceptions) */
import type { CronExpressionOptions } from "./cron-expression";
import { CronExpression } from "./cron-expression";
import { CronFieldCollection } from "./cron-field-collection";
import type { CronFeature, CronFeatures } from "./dialect";
import { resolveFeatures } from "./dialect";
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

const CronUnit = {
    DayOfMonth: "DayOfMonth",
    DayOfWeek: "DayOfWeek",
    Hour: "Hour",
    Minute: "Minute",
    Month: "Month",
    Second: "Second",
} as const;

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
    /**
     * What a bare `*` expands to in each field, worked out the first time it is met. The key carries the
     * field's maximum, because the dialect can change it (`sundayIsOne` narrows the day of week to 0-6)
     * and a `*` must not hand a whole field the expansion of another dialect.
     */
    static readonly #wildcards = new Map<string, (number | string)[]>();

    /**
     * Parses a cron expression and returns a CronExpression object.
     * @param expression The cron expression to parse.
     * @param [options] The options to use when parsing the expression.
     * @param [options.strict] If true, will throw an error if the expression contains both dayOfMonth and dayOfWeek, or a hashed range or step the field cannot satisfy.
     * @param [options.currentDate] The date to use when calculating the next/previous occurrence.
     * @param [options.dialect] The named grammar to hold the expression to; `extended` when none is given.
     * @param [options.features] Syntax to turn on or off on top of the dialect.
     * @returns A CronExpression object.
     */
    public static parse(expression: string, options: CronExpressionOptions = {}): CronExpression {
        const { hashSeed, strict = false } = options;
        const features = resolveFeatures(options.dialect, options.features);
        const rand = seededRandom(hashSeed);
        const used = new Set<CronFeature>();

        const predefined = PredefinedExpressions[expression as keyof typeof PredefinedExpressions] as string | undefined;

        if (predefined !== undefined) {
            if (!features.nicknames) {
                throw CronExpressionParser.#unsupported("nicknames", undefined, expression);
            }

            used.add("nicknames");
            expression = predefined;
        } else if (expression.trim() !== "" && expression.trim().split(/\s+/).length === 6) {
            // A seconds field, judged on what was written rather than on a nickname's expansion.
            used.add("seconds");
        }

        const rawFields = CronExpressionParser.#getRawFields(expression, strict, features);

        if (!(rawFields.dayOfMonth === "*" || rawFields.dayOfWeek === "*" || !strict)) {
            throw new CronParseError("Cannot use both dayOfMonth and dayOfWeek together in strict mode!", { code: "STRICT_DAY_FIELDS" });
        }

        const second = CronExpressionParser.#parseField(
            CronUnit.Second,
            rawFields.second,
            CronSecond.constraints,
            rand,
            strict,
            features,
            used,
        ) as SixtyRange[];
        const minute = CronExpressionParser.#parseField(
            CronUnit.Minute,
            rawFields.minute,
            CronMinute.constraints,
            rand,
            strict,
            features,
            used,
        ) as SixtyRange[];
        const hour = CronExpressionParser.#parseField(CronUnit.Hour, rawFields.hour, CronHour.constraints, rand, strict, features, used) as HourRange[];
        const month = CronExpressionParser.#parseField(CronUnit.Month, rawFields.month, CronMonth.constraints, rand, strict, features, used) as MonthRange[];
        const dayOfMonth = CronExpressionParser.#parseField(
            CronUnit.DayOfMonth,
            rawFields.dayOfMonth,
            CronDayOfMonth.constraints,
            rand,
            strict,
            features,
            used,
        ) as DayOfMonthRange[];
        const { dayOfWeek: _dayOfWeek, nthDayOfWeek } = CronExpressionParser.#parseNthDay(rawFields.dayOfWeek, features, used);
        const dayOfWeekConstraints: CronConstraints = features.sundayIsOne ? { ...CronDayOfWeek.constraints, max: 6 } : CronDayOfWeek.constraints;
        const dayOfWeek = CronExpressionParser.#parseField(
            CronUnit.DayOfWeek,
            _dayOfWeek,
            dayOfWeekConstraints,
            rand,
            strict,
            features,
            used,
        ) as DayOfWeekRange[];

        const fields = new CronFieldCollection({
            dayOfMonth: CronDayOfMonth.fromMonth(month, dayOfMonth, { rawValue: rawFields.dayOfMonth }),
            dayOfWeek: new CronDayOfWeek(dayOfWeek, { nthDayOfWeek, rawValue: rawFields.dayOfWeek }),
            hour: new CronHour(hour, { rawValue: rawFields.hour }),
            minute: new CronMinute(minute, { rawValue: rawFields.minute }),
            month: new CronMonth(month, { rawValue: rawFields.month }),
            second: new CronSecond(second, { rawValue: rawFields.second }),
        });

        return new CronExpression(fields, { ...options, expression, usedFeatures: [...used] });
    }

    /**
     * Builds the error for syntax a dialect does not allow.
     * @param feature The feature that was turned off.
     * @param field The field it was found in, when it is in one.
     * @param token The atom that used it.
     * @returns The error to throw.
     * @private
     */
    static #unsupported(feature: string, field: CronUnit | undefined, token: string): CronParseError {
        return new CronParseError(`Unsupported feature "${feature}" in the selected dialect`, {
            code: "UNSUPPORTED_FEATURE",
            field: field === undefined ? undefined : CronExpressionParser.#fieldName(field),
            token,
        });
    }

    /**
     * Rewrites the numeric weekdays of a day of week field from Cloudflare's scale (1 = Sunday to
     * 7 = Saturday) to this package's (0 = Sunday to 6 = Saturday). A number that is a step (`/2`) is
     * left alone, and the `#` occurrence is stripped before this runs.
     * @param value The day of week field, as written.
     * @returns The field with each weekday number one lower.
     * @throws {CronParseError} When a weekday is outside 1-7, which includes `0` and `8`.
     * @private
     */
    static #shiftSundayIsOneWeekdays(value: string): string {
        // A bare `L` is the last day of the Cloudflare week, Saturday, which sits at 7 before the shift.
        const shifted = value.replaceAll(/(^|,)L(?=,|$)/g, (_match, prefix: string) => `${prefix}7`);

        return shifted.replaceAll(/(?<![#/\d])\d+/g, (digits) => {
            const weekday = Number.parseInt(digits, 10);

            if (weekday < 1 || weekday > 7) {
                throw new CronParseError(`Constraint error, got value ${digits} expected range 1-7`, {
                    code: "FIELD_RANGE",
                    field: CronExpressionParser.#fieldName(CronUnit.DayOfWeek),
                    token: digits,
                });
            }

            return String(weekday - 1);
        });
    }

    /**
     * Get the raw fields from a cron expression.
     * @param expression The cron expression to parse.
     * @param strict If true, will throw an error if the expression contains both dayOfMonth and dayOfWeek.
     * @param features The syntax the chosen dialect allows.
     * @private
     * @returns The raw fields.
     */
    static #getRawFields(expression: string, strict: boolean, features: CronFeatures): RawCronFields {
        if (strict && expression.length === 0) {
            throw new CronParseError("Invalid cron expression", { code: "EMPTY_EXPRESSION" });
        }

        expression = expression || "0 * * * * *";

        if (expression.length > MAX_EXPRESSION_LENGTH) {
            throw new CronParseError(`Invalid cron expression, too long, expected at most ${MAX_EXPRESSION_LENGTH} characters`, {
                code: "EXPRESSION_TOO_LONG",
            });
        }

        const atoms = expression.trim().split(/\s+/);
        const maxFields = features.seconds === "forbid" ? 5 : 6;
        // A sixth field is required by `require` and, as before, by `strict` (unless seconds are forbidden).
        const minFields = features.seconds === "require" || strict ? maxFields : 0;

        if (atoms.length > maxFields) {
            throw new CronParseError("Invalid cron expression, too many fields", { code: "FIELD_COUNT" });
        }

        if (atoms.length < minFields) {
            throw new CronParseError(`Invalid cron expression, expected ${minFields} fields`, { code: "FIELD_COUNT" });
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
     * @param features The syntax the chosen dialect allows.
     * @param used Collects the extensions the expression is made of.
     * @private
     * @returns The parsed field.
     */
    static #parseField(
        field: CronUnit,
        value: string,
        constraints: CronConstraints,
        rand: PRNG,
        strict: boolean,
        features: CronFeatures,
        used: Set<CronFeature>,
    ): (number | string)[] {
        // A bare `*` or `?` is by far the most common field and always expands to the same values.
        const isWildcard = value === "*" || value === "?";

        // `?` has to be checked before the cache: the cache is per field, so a `?` in an earlier
        // expression would otherwise hand back its expansion without asking about the dialect.
        if (value.includes("?")) {
            if (!features.noSpecificTime) {
                throw CronExpressionParser.#unsupported("noSpecificTime", field, value);
            }

            used.add("noSpecificTime");
        }

        const cacheKey = `${field}:${String(constraints.max)}`;
        const known = isWildcard ? CronExpressionParser.#wildcards.get(cacheKey) : undefined;

        if (known) {
            // Every field draws a number, so the seed gives the same picks as ever.
            rand();

            return [...known];
        }

        // Cloudflare numbers the weekdays 1 (Sunday) to 7 (Saturday); rewrite them to 0-6 before the
        // names are substituted, so a name (which means the same day everywhere) is left alone.
        if (field === CronUnit.DayOfWeek && features.sundayIsOne) {
            value = CronExpressionParser.#shiftSundayIsOneWeekdays(value);
        }

        // Replace aliases for month and dayOfWeek
        if (field === CronUnit.Month || field === CronUnit.DayOfWeek) {
            value = value.replaceAll(/[a-z]{3}/gi, (match) => {
                match = match.toLowerCase();
                const replacer = Months[match as keyof typeof Months] || DayOfWeek[match as keyof typeof DayOfWeek];

                if (replacer === undefined) {
                    throw new CronParseError(`Validation error, cannot resolve alias "${match}"`, {
                        code: "UNKNOWN_ALIAS",
                        field: CronExpressionParser.#fieldName(field),
                        token: match,
                    });
                }

                return replacer.toString();
            });
        }

        // Check for valid characters
        if (!constraints.validChars.test(value)) {
            throw new CronParseError(`Invalid characters, got value: ${value}`, {
                code: "FIELD_CHARACTER",
                field: CronExpressionParser.#fieldName(field),
                token: value,
            });
        }

        value = this.#parseWildcard(value, constraints);
        value = this.#parseHashed(value, constraints, rand, field, strict, features, used);

        const values = this.#parseSequence(field, value, constraints, features, used);

        if (isWildcard) {
            CronExpressionParser.#wildcards.set(cacheKey, [...values]);
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
     * @param features The syntax the chosen dialect allows.
     * @param used Collects the extensions the expression is made of.
     * @private
     */
    static #parseHashed(
        value: string,
        constraints: CronConstraints,
        rand: PRNG,
        field: CronUnit,
        strict: boolean,
        features: CronFeatures,
        used: Set<CronFeature>,
    ): string {
        // Every field draws a number, with or without a hashed value in it, so the seed gives the same picks as ever.
        const randomValue = rand();
        let count = 0;

        if (!value.includes("H")) {
            return value;
        }

        if (!features.hashed) {
            throw CronExpressionParser.#unsupported("hashed", field, value);
        }

        used.add("hashed");

        return value.replaceAll(/H(?:\((\d+)-(\d+)\))?(?:\/(\d+))?/g, (_, min, max, step) => {
            // H(range)/step
            if (min && max && step) {
                const minNumber = Number.parseInt(min, 10);
                const maxNumber = Number.parseInt(max, 10);
                const stepNumber = Number.parseInt(step, 10);

                if (stepNumber <= 0) {
                    throw new CronParseError(`Invalid step: ${stepNumber}, must be positive`, {
                        code: "INVALID_STEP",
                        field: CronExpressionParser.#fieldName(field),
                        token: value,
                    });
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
                    throw new CronParseError(`Invalid step: ${stepNumber}, must be positive`, {
                        code: "INVALID_STEP",
                        field: CronExpressionParser.#fieldName(field),
                        token: value,
                    });
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
            throw new CronParseError(`Invalid range: ${min}-${max}, min > max`, {
                code: "INVALID_RANGE",
                field: CronExpressionParser.#fieldName(field),
                token: `${min}-${max}`,
            });
        }

        if (strict && (min < constraints.min || max > constraints.max)) {
            throw new CronParseError(
                `Invalid range: ${min}-${max}, outside the ${constraints.min}-${constraints.max} range of the ${CronExpressionParser.#fieldName(field)} field`,
                { code: "FIELD_RANGE", field: CronExpressionParser.#fieldName(field), token: `${min}-${max}` },
            );
        }

        const rangeMin = Math.max(min, constraints.min);
        const rangeMax = Math.min(max, constraints.max);

        if (rangeMin > rangeMax) {
            throw new CronParseError(`Invalid range: ${min}-${max}, no usable value in the ${CronExpressionParser.#fieldName(field)} field`, {
                code: "FIELD_RANGE",
                field: CronExpressionParser.#fieldName(field),
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
    static #hashedStep(randomValue: number, min: number, max: number, step: number, field: CronUnit, strict: boolean): string {
        if (strict && step > max - min + 1) {
            throw new CronParseError(`Invalid step: ${step}, wider than the ${min}-${max} range of the ${CronExpressionParser.#fieldName(field)} field`, {
                code: "INVALID_STEP",
                field: CronExpressionParser.#fieldName(field),
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
            throw new CronParseError(`Constraint error, too many values in ${field} field, expected at most ${MAX_FIELD_VALUES}`, {
                code: "TOO_MANY_VALUES",
                field: CronExpressionParser.#fieldName(field),
            });
        }
    }

    /**
     * Parse a sequence from a cron expression.
     * @param field The field to parse.
     * @param value The sequence to parse.
     * @param constraints The constraints for the field.
     * @param features The syntax the chosen dialect allows.
     * @param used Collects the extensions the expression is made of.
     * @private
     */
    static #parseSequence(field: CronUnit, value: string, constraints: CronConstraints, features: CronFeatures, used: Set<CronFeature>): (number | string)[] {
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
                    throw new CronParseError(`Constraint error, got value ${result} expected range ${constraints.min}-${constraints.max}`, {
                        code: "FIELD_RANGE",
                        field: CronExpressionParser.#fieldName(field),
                        token: result.toString(),
                    });
                }

                stack.push(field === CronUnit.DayOfWeek ? v % 7 : result);
            }
        }

        const atoms = value.split(",");

        // Cloudflare refuses a day of month text that shares the field with anything else, so `1,15`
        // is fine but `1,15W` and `L-1,L-2` are not.
        CronExpressionParser.#assertNoMixedDayOfMonthText(field, value, atoms, features);

        for (const atom of atoms) {
            CronExpressionParser.#assertMaxFieldValues(field, stack.length);

            if (atom.length === 0) {
                throw new CronParseError("Invalid list value format", { code: "INVALID_LIST", field: CronExpressionParser.#fieldName(field) });
            }

            if (field === CronUnit.DayOfMonth) {
                const day = CronExpressionParser.#readDayOfMonthAtom(atom, features, used);

                if (day !== undefined) {
                    if (!stack.includes(day)) {
                        stack.push(day);
                    }

                    continue;
                }
            } else if (field === CronUnit.DayOfWeek && /^[0-7]L$/.test(atom)) {
                CronExpressionParser.#assertLastDayOfWeek(atom, features, used);
            }

            handleResult(CronExpressionParser.#parseRepeat(field, atom, constraints, features), constraints);
        }

        return stack;
    }

    /**
     * Whether a day of month atom is one of the texts (`L`, `nL`, `LW`, `L-n`, `nW`) rather than a
     * plain day, a range or a step.
     * @param atom One entry of a day of month list.
     * @returns True for a text.
     * @private
     */
    static #isDayOfMonthText(atom: string): boolean {
        return atom === "L" || looksLikeDayOfMonthText(atom) || /^\d{1,2}L$/.test(atom);
    }

    /**
     * Records a `5L` day of week text, rejecting it when the dialect does not take it.
     * @param atom The day of week atom.
     * @param features The syntax the chosen dialect allows.
     * @param used Collects the extensions the expression is made of.
     * @throws {CronParseError} When the dialect does not take `nL`.
     * @private
     */
    static #assertLastDayOfWeek(atom: string, features: CronFeatures, used: Set<CronFeature>): void {
        if (!features.lastDayOfWeek) {
            throw CronExpressionParser.#unsupported("lastDayOfWeek", CronUnit.DayOfWeek, atom);
        }

        used.add("lastDayOfWeek");
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
    static #assertNoMixedDayOfMonthText(field: CronUnit, value: string, atoms: string[], features: CronFeatures): void {
        if (field !== CronUnit.DayOfMonth || features.mixedDayOfMonthText || atoms.length <= 1) {
            return;
        }

        if (!atoms.some((atom) => CronExpressionParser.#isDayOfMonthText(atom))) {
            return;
        }

        throw new CronParseError("Constraint error, a day of month text such as LW or L-3 has to stand alone in this dialect", {
            code: "FIELD_VALUE",
            field: CronExpressionParser.#fieldName(field),
            token: value,
        });
    }

    /**
     * The value a day of month atom stands for, when it is one of the texts that go beyond a plain
     * day: `L`, `nL`, `LW`, `L-n` or `nW`.
     * @param atom One entry of a day of month list.
     * @param features The syntax the chosen dialect allows.
     * @param used Collects the extensions the expression is made of.
     * @returns The normalized value, or undefined when the atom is an ordinary day or range.
     * @throws {CronParseError} When the atom has one of the shapes but is out of range, or turned off.
     * @private
     */
    static #readDayOfMonthAtom(atom: string, features: CronFeatures, used: Set<CronFeature>): string | undefined {
        if (looksLikeDayOfMonthText(atom)) {
            return CronExpressionParser.#normalizeDayOfMonthAtom(atom, features, used);
        }

        if (atom === "L") {
            if (!features.lastDayOfMonth) {
                throw CronExpressionParser.#unsupported("lastDayOfMonth", CronUnit.DayOfMonth, atom);
            }

            used.add("lastDayOfMonth");

            return "L";
        }

        // `5L` is the last day of the month, as the reference implementation reads it: the number before the `L` is ignored.
        if (/^\d{1,2}L$/.test(atom)) {
            if (!features.numberedLastDayOfMonth) {
                throw CronExpressionParser.#unsupported("numberedLastDayOfMonth", CronUnit.DayOfMonth, atom);
            }

            used.add("numberedLastDayOfMonth");

            return "L";
        }

        // `W` only means something in `<day>W` and `LW`, never inside a range or a step.
        if (atom.includes("W")) {
            throw new CronParseError(`Constraint error, got value ${atom} expected W only after a day, as in 15W, or after L, as in LW`, {
                code: "FIELD_VALUE",
                field: CronExpressionParser.#fieldName(CronUnit.DayOfMonth),
                token: atom,
            });
        }

        return undefined;
    }

    /**
     * Reads one of the day of month texts that go beyond a plain day and checks it against the dialect.
     * @param atom One entry of a day of month list, already known to have one of those shapes.
     * @param features The syntax the chosen dialect allows.
     * @param used Collects the extensions the expression is made of.
     * @returns The normalized value.
     * @throws {CronParseError} When a number is out of range, or the text is turned off.
     * @private
     */
    static #normalizeDayOfMonthAtom(atom: string, features: CronFeatures, used: Set<CronFeature>): string {
        const read = readDayOfMonthText(atom);

        if (read === undefined) {
            const hint = atom.startsWith("L") ? "an offset of 1-30 days from the last day" : "a day from 1-31 before the W";

            throw new CronParseError(`Constraint error, got value ${atom} expected ${hint}`, {
                code: "FIELD_VALUE",
                field: CronExpressionParser.#fieldName(CronUnit.DayOfMonth),
                token: atom,
            });
        }

        // The kinds `lastOffset`, `lastWeekday` and `nearestWeekday` name the features one for one.
        if (!features[read.kind]) {
            throw CronExpressionParser.#unsupported(read.kind, CronUnit.DayOfMonth, atom);
        }

        used.add(read.kind);

        return normalizeDayOfMonthText(atom);
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
    static #parseRepeat(field: CronUnit, value: string, constraints: CronConstraints, features: CronFeatures): ParseRangeResponse {
        const atoms = value.split("/");

        if (atoms.length > 2) {
            throw new CronParseError(`Invalid repeat: ${value}`, { code: "INVALID_REPEAT", field: CronExpressionParser.#fieldName(field), token: value });
        }

        if (atoms.length === 2) {
            const [range, step] = atoms as [string, string];
            const stepNumber = Number.parseInt(step, 10);

            CronExpressionParser.#assertStepWithinField(field, stepNumber, constraints, features);

            return CronExpressionParser.#parseRange(field, range.includes("-") ? range : `${range}-${constraints.max}`, stepNumber, constraints);
        }

        return CronExpressionParser.#parseRange(field, value, 1, constraints);
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
    static #assertStepWithinField(field: CronUnit, step: number, constraints: CronConstraints, features: CronFeatures): void {
        const fieldSize = constraints.max - constraints.min + 1;

        if (!features.stepSmallerThanField || step < fieldSize) {
            return;
        }

        throw new CronParseError(
            `Constraint error, step ${step} has to be smaller than the ${fieldSize} values of the ${CronExpressionParser.#fieldName(field)} field`,
            {
                code: "INVALID_STEP",
                field: CronExpressionParser.#fieldName(field),
                token: String(step),
            },
        );
    }

    /**
     * Validate a cron range.
     * @param min The minimum value of the range.
     * @param max The maximum value of the range.
     * @param constraints The constraints for the field.
     * @param field The field being parsed, used when reporting an invalid range.
     * @private
     * @returns
     * @throws {CronParseError} Throws an error if the range is invalid.
     */
    static #validateRange(min: number, max: number, constraints: CronConstraints, field: CronUnit): void {
        const isValid = !Number.isNaN(min) && !Number.isNaN(max) && min >= constraints.min && max <= constraints.max;

        if (!isValid) {
            throw new CronParseError(`Constraint error, got range ${min}-${max} expected range ${constraints.min}-${constraints.max}`, {
                code: "FIELD_RANGE",
                field: CronExpressionParser.#fieldName(field),
                token: `${min}-${max}`,
            });
        }

        if (min > max) {
            throw new CronParseError(`Invalid range: ${min}-${max}, min(${min}) > max(${max})`, {
                code: "INVALID_RANGE",
                field: CronExpressionParser.#fieldName(field),
                token: `${min}-${max}`,
            });
        }
    }

    /**
     * Validate a cron repeat interval.
     * @param repeatInterval The repeat interval to validate.
     * @param field The field being parsed, used when reporting an invalid step.
     * @private
     * @returns
     * @throws {CronParseError} Throws an error if the repeat interval is invalid.
     */
    static #validateRepeatInterval(repeatInterval: number, field: CronUnit): void {
        if (!(!Number.isNaN(repeatInterval) && repeatInterval > 0)) {
            throw new CronParseError(`Constraint error, cannot repeat at every ${repeatInterval} time.`, {
                code: "INVALID_STEP",
                field: CronExpressionParser.#fieldName(field),
                token: String(repeatInterval),
            });
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
     * @param value The range to parse.
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
            throw new CronParseError(`Invalid range: ${value}`, { code: "INVALID_RANGE", field: CronExpressionParser.#fieldName(field), token: value });
        }

        const [min, max] = atoms.map((number_) => Number.parseInt(number_, 10)) as [number, number];

        this.#validateRange(min, max, constraints, field);
        this.#validateRepeatInterval(repeatInterval, field);

        // Create range
        return this.#createRange(field, min, max, repeatInterval);
    }

    /**
     * Parse the nth day of week marker off a day of week field.
     * @param value The day of week field.
     * @param features The syntax the chosen dialect allows.
     * @param used Collects the extensions the expression is made of.
     * @private
     * @returns The field without the marker, and the occurrence number when there was one.
     */
    static #parseNthDay(value: string, features: CronFeatures, used: Set<CronFeature>): { dayOfWeek: string; nthDayOfWeek?: number } {
        const atoms = value.split("#");

        if (atoms.length <= 1) {
            return { dayOfWeek: atoms[0] as string };
        }

        if (!features.nthDayOfWeek) {
            throw CronExpressionParser.#unsupported("nthDayOfWeek", CronUnit.DayOfWeek, value);
        }

        used.add("nthDayOfWeek");

        const nthValue = Number(atoms.at(-1));
        const matches = value.match(/([,\-/])/);

        if (matches !== null) {
            throw new CronParseError(`Constraint error, invalid dayOfWeek \`#\` and \`${matches?.[0]}\` special characters are incompatible`, {
                code: "INVALID_NTH_DAY",
                field: CronExpressionParser.#fieldName(CronUnit.DayOfWeek),
                token: value,
            });
        }

        if (!(atoms.length <= 2 && !Number.isNaN(nthValue) && nthValue >= 1 && nthValue <= 5)) {
            throw new CronParseError("Constraint error, invalid dayOfWeek occurrence number (#)", {
                code: "INVALID_NTH_DAY",
                field: CronExpressionParser.#fieldName(CronUnit.DayOfWeek),
                token: value,
            });
        }

        return { dayOfWeek: atoms[0] as string, nthDayOfWeek: nthValue };
    }

    /**
     * Checks if a character is valid for a field.
     * @param constraints The constraints for the field.
     * @param value The value to check.
     * @private
     * @returns Whether the character is valid.
     */
    static #isValidConstraintChar(constraints: CronConstraints, value: string | number): boolean {
        return constraints.chars.some((char) => value.toString().includes(char));
    }
}

export { CronExpressionParser, CronUnit, DayOfWeek, Months, PredefinedExpressions };
export type { RawCronFields };
