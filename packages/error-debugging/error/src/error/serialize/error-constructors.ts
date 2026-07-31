// Type for error constructors (flexible to handle different signatures)

type ErrorConstructor = new (...arguments_: any[]) => Error;

// Default error constructors that are commonly used.
//
// `AggregateError` has a different constructor signature and is not guaranteed to exist, so it is
// registered conditionally — but from inside the initialiser rather than a follow-up `.set()` call.
// A top-level `.set()` is a module side effect, which contradicts this package's
// `"sideEffects": false` and keeps the whole registry alive in consumer bundles that only pull, say,
// `serializeError` out of the `./error` barrel. A single `new Map(...)` initialiser is pure, so it
// is dropped when nothing uses it. The annotation is spelled out because the spread stops the
// bundler from inferring it.
// eslint-disable-next-line jsdoc/no-bad-blocks -- `/* @__PURE__ */` is a bundler annotation, not JSDoc
const defaultErrorConstructors = /* @__PURE__ */ new Map<string, ErrorConstructor>([
    ["Error", Error],
    ["EvalError", EvalError],
    ["RangeError", RangeError],
    ["ReferenceError", ReferenceError],
    ["SyntaxError", SyntaxError],
    ["TypeError", TypeError],
    ["URIError", URIError],
    ...typeof AggregateError === "undefined" ? [] : [["AggregateError", AggregateError as ErrorConstructor] as [string, ErrorConstructor]],
]);

/**
 * Add a known error constructor to the registry.
 * @param constructor The error constructor to add
 * @param name Optional custom name to use instead of instance.name
 * @throws {Error} If the constructor is already known or incompatible
 */
export const addKnownErrorConstructor = (constructor: ErrorConstructor, name?: string): void => {
    let instance: Error;

    try {
        instance = new constructor();
    } catch (error) {
        throw new Error(`The error constructor "${constructor.name}" is not compatible`, { cause: error });
    }

    const resolvedName = name ?? instance.name;

    if (defaultErrorConstructors.has(resolvedName)) {
        throw new Error(`The error constructor "${resolvedName}" is already known.`);
    }

    defaultErrorConstructors.set(resolvedName, constructor);
};

/**
 * Get all known error constructors.
 */

export const getKnownErrorConstructors = (): Map<string, new (...arguments_: any[]) => Error> => new Map(defaultErrorConstructors);

/**
 * Get a specific error constructor by name.
 */

export const getErrorConstructor = (name: string): (new (...arguments_: any[]) => Error) | undefined => defaultErrorConstructors.get(name);

/**
 * Check if an object looks like a serialized error.
 */
export const isErrorLike = (
    value: unknown,
): value is {
    message?: string;
    name?: string;
    stack?: string;
} =>
    value !== null
    && typeof value === "object"
    && typeof (value as { name?: unknown }).name === "string"
    && typeof (value as { message?: unknown }).message === "string"
    // Must be a known error constructor name or a generic Error
    && (getErrorConstructor((value as { name: string }).name) !== undefined || (value as { name: string }).name === "Error");
