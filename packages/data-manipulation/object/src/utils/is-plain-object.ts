/**
 * Determines whether a value is a plain object (i.e. created from `{}` or `Object.create(null)`).
 * @param value Value to inspect.
 * @returns `true` if the value is a plain object, otherwise `false`.
 */
const isPlainObject = (value: unknown): value is Record<string, unknown> => {
    if (typeof value !== "object" || value === null) {
        return false;
    }

    const prototype = Object.getPrototypeOf(value) as object | null;

    return (prototype === null || prototype === Object.prototype || Object.getPrototypeOf(prototype) === null)
        && !(Symbol.toStringTag in value)
        && !(Symbol.iterator in value);
};

export default isPlainObject;
