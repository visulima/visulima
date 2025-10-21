/**
 * Type constructor function that converts a string to a typed value.
 */
type TypeConstructor = (input: string) => unknown;

/**
 * Check if a type is boolean.
 * @param type The type to check
 * @returns True if the type is Boolean or BooleanConstructor
 */
const isBooleanType = (type: unknown): type is BooleanConstructor => type === Boolean || (typeof type === "function" && type.name?.startsWith("Boolean"));

/**
 * Check if a type is number.
 * @param type The type to check
 * @returns True if the type is Number or NumberConstructor
 */
const isNumberType = (type: unknown): type is NumberConstructor => type === Number || (typeof type === "function" && type.name === "Number");

/**
 * Check if a type is string.
 * @param type The type to check
 * @returns True if the type is String or StringConstructor
 */
const isStringType = (type: unknown): type is StringConstructor => type === String || (typeof type === "function" && type.name === "String");

/**
 * Convert a value to the specified type.
 * @param value The value to convert (can be a single value or array)
 * @param type The target type constructor or custom conversion function
 * @returns The converted value
 */
const convertValue = (value: unknown, type: TypeConstructor | BooleanConstructor | NumberConstructor | StringConstructor): unknown => {
    if (Array.isArray(value)) {
        if (isBooleanType(type)) {
            return value.map(Boolean);
        }

        if (isNumberType(type)) {
            return value.map(Number);
        }

        if (isStringType(type)) {
            return value.map(String);
        }

        return value.map((item: unknown) => (type as TypeConstructor)(String(item)));
    }

    if (value === null) {
        return null;
    }

    if (isBooleanType(type)) {
        return Boolean(value);
    }

    if (isNumberType(type)) {
        return Number(value);
    }

    if (isStringType(type)) {
        return String(value);
    }

    return (type as TypeConstructor)(String(value));
};

export default convertValue;
