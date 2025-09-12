// Default error constructors that are commonly used
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const defaultErrorConstructors = new Map<string, new (...arguments_: any[]) => Error>([
    ["Error", Error],
    ["EvalError", EvalError],
    ["RangeError", RangeError],
    ["ReferenceError", ReferenceError],
    ["SyntaxError", SyntaxError],
    ["TypeError", TypeError],
    ["URIError", URIError],
]);

// Handle AggregateError separately since it has a different constructor signature
if (typeof AggregateError !== "undefined") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    defaultErrorConstructors.set("AggregateError", AggregateError as new (...arguments_: any[]) => Error);
}

// Check if a constructor is compatible with Error
const isErrorConstructor = (constructor: unknown): constructor is new (message?: string) => Error => {
    if (typeof constructor !== "function") {
        return false;
    }

    // Check if it has the Error prototype in its chain
    try {
        const instance = new (constructor as new (...arguments_: unknown[]) => Error)();

        return instance instanceof Error;
    } catch {
        return false;
    }
};

// Type for error constructors (flexible to handle different signatures)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ErrorConstructor = new (...arguments_: any[]) => Error;

/**
 * Add a known error constructor to the registry.
 * @param constructor The error constructor to add
 * @throws {Error} If the constructor is already known or incompatible
 */
export const addKnownErrorConstructor = (constructor: ErrorConstructor): void => {
    const { name } = constructor;

    if (defaultErrorConstructors.has(name)) {
        throw new Error(`The error constructor "${name}" is already known.`);
    }

    if (!isErrorConstructor(constructor)) {
        throw new Error(`The error constructor "${name}" is not compatible`);
    }

    defaultErrorConstructors.set(name, constructor);
};

/**
 * Get all known error constructors.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const getKnownErrorConstructors = (): Map<string, new (...arguments_: any[]) => Error> => new Map(defaultErrorConstructors);

/**
 * Get a specific error constructor by name.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
