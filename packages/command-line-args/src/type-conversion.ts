/**
 * Convert a value to the specified type.
 */
export const convertValue = (value: any, type: any): any => {
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

        return value.map((v: any) => type(String(v)));
    }

    if (value === null) {
        return null; // Preserve null values
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

    return type(String(value));
};

/**
 * Check if a type is boolean.
 */
const isBooleanType = (type: any): boolean => type && (type === Boolean || (typeof type === "function" && type.name?.startsWith("Boolean")));

/**
 * Check if a type is number.
 */
const isNumberType = (type: any): boolean => type && (type === Number || (typeof type === "function" && type.name === "Number"));

/**
 * Check if a type is string.
 */
const isStringType = (type: any): boolean => type && (type === String || (typeof type === "function" && type.name === "String"));
