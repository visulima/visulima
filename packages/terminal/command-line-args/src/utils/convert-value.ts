import { InvalidValueError } from "../errors/index";
import { isBooleanType, isNumberType, isStringType } from "./type-checks";

/**
 * Type constructor function that converts a string to a typed value.
 */
type TypeConstructor = (input: string) => unknown;

/**
 * Options influencing value conversion.
 */
interface ConvertOptions {
    /**
     * The option name, used for error messages when `strictTypes` is enabled.
     */
    optionName?: string;

    /**
     * When `true`, throw {@link InvalidValueError} for `Number` values that parse to `NaN`.
     */
    strictTypes?: boolean;
}

/**
 * Convert a single string through `Number`, throwing in strict mode when the
 * result is `NaN` (and the input was not literally `NaN`).
 */
const toNumber = (value: unknown, strictTypes: boolean | undefined, optionName: string | undefined): number => {
    const result = Number(value);

    if (strictTypes && Number.isNaN(result) && String(value).trim().toLowerCase() !== "nan") {
        throw new InvalidValueError(optionName ?? "", String(value), "Number");
    }

    return result;
};

/**
 * Convert a value to the specified type.
 * @param value The value to convert (can be a single value or array)
 * @param type The target type constructor or custom conversion function
 * @param convertOptions Conversion options (e.g. `strictTypes`)
 * @returns The converted value
 * @throws {InvalidValueError} When `strictTypes` is set and a `Number` value parses to `NaN`
 */
const convertValue = (
    value: unknown,
    type: TypeConstructor | BooleanConstructor | NumberConstructor | StringConstructor,
    convertOptions: ConvertOptions = {},
): unknown => {
    const { optionName, strictTypes } = convertOptions;

    if (Array.isArray(value)) {
        if (isBooleanType(type)) {
            return value.map(Boolean);
        }

        if (isNumberType(type)) {
            return value.map((item: unknown) => toNumber(item, strictTypes, optionName));
        }

        if (isStringType(type)) {
            return value.map(String);
        }

        return value.map((item: unknown) => type(String(item)));
    }

    if (value === null) {
        // eslint-disable-next-line unicorn/no-null
        return null;
    }

    if (isBooleanType(type)) {
        return Boolean(value);
    }

    if (isNumberType(type)) {
        return toNumber(value, strictTypes, optionName);
    }

    if (isStringType(type)) {
        // eslint-disable-next-line @typescript-eslint/no-base-to-string -- CLI values are primitives (string/number/boolean), never plain objects
        return typeof value === "string" ? value : String(value);
    }

    // eslint-disable-next-line @typescript-eslint/no-base-to-string -- CLI values are primitives (string/number/boolean), never plain objects
    return type(typeof value === "string" ? value : String(value));
};

export default convertValue;
