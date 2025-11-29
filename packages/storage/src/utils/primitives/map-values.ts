/**
 * Maps object values using a transformation function.
 * @param object The source object to map values from
 * @param function_ The function to transform each value
 * @returns A new object with transformed values
 * @template T - The type of the transformed values
 */
const mapValues = <T>(object: Record<string, unknown>, function_: (value: unknown) => T): Record<string, T> => {
    const result: Record<string, T> = {};

    Object.keys(object).forEach((key) => {
        result[key] = function_(object[key]);
    });

    return result;
};

export default mapValues;
