/**
 * Guarded versions of the reflective operations the dispatcher performs on an
 * unknown value.
 *
 * Every one of them can be hijacked: a `Proxy` trap may throw for any key, and a
 * revoked `Proxy` throws for *every* operation — including `Object.prototype.toString`
 * and `Array.isArray`, which look total but are not. Since the inspector's whole job
 * is to render values of unknown provenance, none of these may be allowed to escape.
 *
 * Each helper wraps exactly one operation and returns a conservative fallback, so a
 * hostile value degrades to honest partial output instead of taking the caller down.
 * On the normal path the only added work is entering a `try` block, which costs
 * nothing at runtime — V8 records handlers in a static table rather than executing
 * anything on entry.
 *
 * The two guards that sit on the hottest path (the `Object.prototype.toString` slug
 * and `Object.getPrototypeOf`) are written inline in `internalInspect` instead, so
 * the successful path there stays exactly the expression it always was, with no call
 * in front of it.
 */

/**
 * `Array.isArray(value)`. Pierces proxies without invoking a trap, but still throws
 * on a revoked one.
 */
export const safeIsArray = (value: unknown): boolean => {
    try {
        return Array.isArray(value);
    } catch {
        return false;
    }
};

/**
 * `value[key]`. Used for the probe reads (custom-inspect symbols, `constructor`)
 * that decide *how* to render, where a missing value and an unreadable one are
 * equivalent — both mean "no special handling applies".
 */
export const safeGet = (value: object, key: PropertyKey): unknown => {
    try {
        return (value as Record<PropertyKey, unknown>)[key];
    } catch {
        return undefined;
    }
};

/**
 * `value instanceof constructor`. Walks the prototype chain, so a throwing
 * `getPrototypeOf` trap propagates out of it.
 */
// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
export const safeInstanceOf = (value: unknown, constructor: Function): boolean => {
    try {
        return value instanceof constructor;
    } catch {
        return false;
    }
};

/**
 * `Object.getOwnPropertyDescriptor(object, key)?.enumerable`. An unreadable
 * descriptor is reported as enumerable so the key survives into the output and the
 * (guarded) value read can report it as unreadable, rather than the property being
 * silently dropped.
 */
export const safeIsEnumerable = (object: object, key: PropertyKey): boolean => {
    try {
        return Object.getOwnPropertyDescriptor(object, key)?.enumerable ?? false;
    } catch {
        return true;
    }
};
