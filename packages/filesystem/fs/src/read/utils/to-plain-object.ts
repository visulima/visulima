/**
 * Recursively replaces null-prototype objects with plain objects.
 *
 * Since version 1.9.0, `smol-toml` parses tables into null-prototype objects
 * to protect against prototype pollution. `readToml` and `readTomlSync` have
 * always returned plain objects, so the parsed value is normalized to keep
 * that contract. Own enumerable properties are preserved as plain data
 * properties (including keys like `__proto__`, matching `JSON.parse`
 * semantics), arrays are traversed, and every other value (for example dates)
 * is returned unchanged.
 * @param value The parsed TOML value.
 * @returns The value with every null-prototype object converted to a plain object.
 */
const toPlainObject = <T>(value: T): T => {
    if (Array.isArray(value)) {
        return (value as unknown as unknown[]).map((entry) => toPlainObject(entry)) as T;
    }

    if (value !== null && typeof value === "object" && Object.getPrototypeOf(value) === null) {
        const source = value as Record<string, unknown>;

        return Object.fromEntries(Object.entries(source).map(([key, entry]) => [key, toPlainObject(entry)])) as T;
    }

    return value;
};

export default toPlainObject;
