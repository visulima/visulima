/* eslint-disable @typescript-eslint/member-ordering, @typescript-eslint/prefer-nullish-coalescing, @typescript-eslint/restrict-template-expressions, @typescript-eslint/unbound-method, jsdoc/informative-docs, no-plusplus, sonarjs/regex-complexity, unicorn/no-null, unicorn/no-object-as-default-parameter -- ported from the reference implementation, whose behaviour its tests pin; these style rules stay relaxed so the code remains easy to compare with the original (the search engine in schedule.ts, zone.ts and cron-expression.ts has no such exceptions) */
import { CronParseError, fieldNameOf } from "../errors";
import type { CronChars, CronConstraints, CronFieldType, CronMax, CronMin } from "./types";

/** One regular expression for every call: a regex literal inside a getter is made anew each time it runs. */
const VALID_CHARS = /^[?,*\dH/-]+$|^.*H\(\d+-\d+\)\/\d.*$|^.*H\(\d+-\d+\).*$|^.*H\/\d.*$/;

/**
 * Represents the serialized form of a cron field.
 * @typedef {object} SerializedCronField
 * @property {boolean} wildcard - Indicates if the field is a wildcard.
 * @property {(number|string)[]} values - The values of the field.
 */
type SerializedCronField = {
    values: (number | string)[];
    wildcard: boolean;
};

/**
 * Represents the options for a cron field.
 * @typedef {object} CronFieldOptions
 * @property {string} rawValue - The raw value of the field.
 * @property {boolean} [wildcard] - Indicates if the field is a wildcard.
 * @property {number} [nthDayOfWeek] - The nth day of the week.
 */
type CronFieldOptions = {
    nthDayOfWeek?: number;
    rawValue?: string;
    wildcard?: boolean;
};

/**
 * Represents a field within a cron expression.
 * This is a base class and should not be instantiated directly.
 * @class CronField
 */
abstract class CronField {
    readonly #hasLastChar: boolean = false;

    readonly #hasQuestionMarkChar: boolean = false;

    readonly #wildcard: boolean = false;

    readonly #values: (number | string)[] = [];

    protected readonly options: CronFieldOptions & { rawValue: string } = { rawValue: "" };

    /**
     * Returns the minimum value allowed for this field.
     */
    public static get min(): CronMin {
        /* istanbul ignore next */
        throw new Error("min must be overridden");
    }

    /**
     * Returns the maximum value allowed for this field.
     */
    public static get max(): CronMax {
        /* istanbul ignore next */
        throw new Error("max must be overridden");
    }

    /**
     * Returns the allowed characters for this field.
     */
    public static get chars(): ReadonlyArray<CronChars> {
        /* istanbul ignore next - this is overridden */
        return Object.freeze([]);
    }

    /**
     * Returns the regular expression used to validate this field.
     */
    public static get validChars(): RegExp {
        return VALID_CHARS;
    }

    /**
     * Returns the constraints for this field.
     */
    public static get constraints(): CronConstraints {
        return { chars: this.chars, max: this.max, min: this.min, validChars: this.validChars };
    }

    /**
     * CronField constructor. Initializes the field with the provided values.
     * @param values Values for this field
     * @param [options] Options provided by the parser
     * @throws {TypeError} if the constructor is called directly
     * @throws {Error} if validation fails
     */
    protected constructor(values: (number | string)[], options: CronFieldOptions = { rawValue: "" }) {
        if (!Array.isArray(values)) {
            throw new TypeError(`${this.constructor.name} Validation error, values is not an array`);
        }

        if (values.length === 0) {
            throw new Error(`${this.constructor.name} Validation error, values contains no values`);
        }

        /* istanbul ignore next */
        this.options = {
            ...options,
            rawValue: options.rawValue ?? "",
        };
        // Parsed values arrive in order, so only sort a list that is not.
        this.#values = [...values];

        if (!CronField.#isSorted(this.#values)) {
            this.#values.sort(CronField.sorter);
        }

        this.#wildcard = this.options.wildcard === undefined ? this.#isWildcardValue() : this.options.wildcard;
        // Numbers sort before text, so a list with no text in it ends in a number and has no marker to look for.
        const hasText = typeof this.#values.at(-1) === "string";

        this.#hasLastChar = this.options.rawValue.includes("L") || (hasText && values.includes("L"));
        this.#hasQuestionMarkChar = this.options.rawValue.includes("?") || (hasText && values.includes("?"));
    }

    /**
     * Returns the minimum value allowed for this field.
     * @returns
     */
    public get min(): number {
        // return the static value from the child class
        return (this.constructor as typeof CronField).min;
    }

    /**
     * Returns the maximum value allowed for this field.
     * @returns
     */
    public get max(): number {
        // return the static value from the child class
        return (this.constructor as typeof CronField).max;
    }

    /**
     * Returns an array of allowed special characters for this field.
     * @returns
     */
    public get chars(): ReadonlyArray<string> {
        // return the frozen static value from the child class
        return (this.constructor as typeof CronField).chars;
    }

    /**
     * Indicates whether this field has a "last" character.
     * @returns
     */
    public get hasLastChar(): boolean {
        return this.#hasLastChar;
    }

    /**
     * Indicates whether this field has a "question mark" character.
     * @returns
     */
    public get hasQuestionMarkChar(): boolean {
        return this.#hasQuestionMarkChar;
    }

    /**
     * Indicates whether this field is a wildcard.
     * @returns
     */
    public get isWildcard(): boolean {
        return this.#wildcard;
    }

    /**
     * Returns an array of allowed values for this field.
     * @returns
     */
    public get values(): CronFieldType {
        return this.#values as CronFieldType;
    }

    /**
     * Helper function to sort values in ascending order.
     * @param a First value to compare
     * @param b Second value to compare
     * @returns - A negative, zero, or positive value, depending on the sort order
     */
    public static sorter(a: number | string, b: number | string): number {
        const aIsNumber = typeof a === "number";
        const bIsNumber = typeof b === "number";

        if (aIsNumber && bIsNumber) {
            return a - b;
        }

        if (!aIsNumber && !bIsNumber) {
            return a.localeCompare(b);
        }

        return aIsNumber ? /* istanbul ignore next - A will always be a number until L-2 is supported */ -1 : 1;
    }

    /**
     * Find the next (or previous when `reverse` is true) numeric value in a sorted list.
     * Returns null if there's no value strictly after/before the current one.
     * @param values Sorted numeric values
     * @param currentValue Current value to compare against
     * @param reverse When true, search in reverse for previous smaller value
     */
    public static findNearestValueInList(values: number[], currentValue: number, reverse: boolean): number | null {
        if (reverse) {
            for (let i = values.length - 1; i >= 0; i--) {
                if ((values[i] as number) < currentValue) {
                    return values[i] as number;
                }
            }

            return null;
        }

        for (const value of values) {
            if (value > currentValue) {
                return value;
            }
        }

        return null;
    }

    /**
     * Instance helper that operates on this field's numeric `values`.
     * @param currentValue Current value to compare against
     * @param reverse When true, search in reverse for previous smaller value
     */
    public findNearestValue(currentValue: number, reverse: boolean): number | null {
        return (this.constructor as typeof CronField).findNearestValueInList(this.values as number[], currentValue, reverse);
    }

    /**
     * Serializes the field to an object.
     * @returns
     */
    public serialize(): SerializedCronField {
        return {
            values: this.#values,
            wildcard: this.#wildcard,
        };
    }

    /**
     * Validates the field values against the allowed range and special characters.
     * @throws {Error} if validation fails
     */

    /**
     * Whether a value that is not a number is one this field accepts. By default that is a character this field
     * allows, with up to two digits before it (`5L`).
     * @param value The text.
     * @returns True when it is accepted.
     */
    protected isValidText(value: string): boolean {
        return this.chars.some((char) => new RegExp(String.raw`^\d{0,2}${char}$`).test(value));
    }

    public validate(): void {
        const { chars, max, min } = this;

        for (const value of this.#values) {
            const valid = typeof value === "number" ? value >= min && value <= max : this.isValidText(value);

            if (!valid) {
                const charsString = chars.length > 0 ? ` or chars ${chars.join("")}` : "";

                throw new CronParseError(`${this.constructor.name} Validation error, got value ${value} expected range ${min}-${max}${charsString}`, {
                    code: "FIELD_RANGE",
                    field: fieldNameOf(this.constructor.name),
                    token: String(value),
                });
            }
        }

        // The values are sorted, so equal ones are next to each other.
        for (let index = 1; index < this.#values.length; index += 1) {
            if (this.#values[index] === this.#values[index - 1]) {
                throw new CronParseError(`${this.constructor.name} Validation error, duplicate values found: ${this.#values[index]}`, {
                    code: "DUPLICATE_VALUE",
                    field: fieldNameOf(this.constructor.name),
                    token: String(this.#values[index]),
                });
            }
        }
    }

    static #isSorted(values: ReadonlyArray<number | string>): boolean {
        for (let index = 1; index < values.length; index += 1) {
            const previous = values[index - 1] as number | string;
            const current = values[index] as number | string;
            const inOrder = typeof previous === "number" && typeof current === "number" ? previous <= current : CronField.sorter(previous, current) <= 0;

            if (!inOrder) {
                return false;
            }
        }

        return true;
    }

    /**
     * Determines if the field is a wildcard based on the values.
     * When options.rawValue is not empty, it checks if the raw value is a wildcard, otherwise it checks if all values in the range are included.
     * @returns
     */
    #isWildcardValue(): boolean {
        if (this.options.rawValue.length > 0) {
            return ["*", "?"].includes(this.options.rawValue);
        }

        const present = new Set(this.#values);

        return Array.from({ length: this.max - this.min + 1 }, (_, i) => i + this.min).every((value) => present.has(value));
    }
}

export { CronField };
export type { CronFieldOptions, SerializedCronField };
