/**
 * Check if a type is Boolean.
 * @param type The type to check
 * @returns True if the type is Boolean or BooleanConstructor
 */
export const isBooleanType = (type: unknown): type is BooleanConstructor => type === Boolean || (typeof type === "function" && type.name === "Boolean");

/**
 * Check if a type is Number.
 * @param type The type to check
 * @returns True if the type is Number or NumberConstructor
 */
export const isNumberType = (type: unknown): type is NumberConstructor => type === Number || (typeof type === "function" && type.name === "Number");

/**
 * Check if a type is String.
 * @param type The type to check
 * @returns True if the type is String or StringConstructor
 */
export const isStringType = (type: unknown): type is StringConstructor => type === String || (typeof type === "function" && type.name === "String");
