/**
 * Assign `value` to `key` on `target` without triggering the dangerous
 * `__proto__` setter (a prototype-pollution vector).
 *
 * Plain assignment (`target[key] = value`) invokes the inherited `__proto__`
 * accessor when `key === "__proto__"`, which would mutate the object's
 * prototype instead of creating an own property. For every other key plain
 * assignment is used because it is roughly an order of magnitude faster than
 * `Object.defineProperty` with a full descriptor.
 * @param target The object receiving the property.
 * @param key The own-property key to set.
 * @param value The value to assign.
 */
const safeAssign = (target: Record<string, unknown>, key: string, value: unknown): void => {
    if (key === "__proto__") {
        Object.defineProperty(target, key, { configurable: true, enumerable: true, value, writable: true });

        return;
    }

    // eslint-disable-next-line no-param-reassign
    target[key] = value;
};

export default safeAssign;
