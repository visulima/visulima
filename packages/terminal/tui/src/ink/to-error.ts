/**
 * Turns any thrown value into an Error. Errors from another realm are kept as they are (`instanceof`
 * misses them), and a value that cannot be converted to a string, such as `Object.create(null)`, still
 * produces an Error instead of throwing while the error is being reported.
 */
export const toError = (value: unknown): Error => {
    if (value instanceof Error || Object.prototype.toString.call(value) === "[object Error]") {
        return value as Error;
    }

    try {
        return new Error(String(value));
    } catch {
        return new Error("Unknown error");
    }
};
