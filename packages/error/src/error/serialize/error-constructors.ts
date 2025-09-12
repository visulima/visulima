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

// Type for error constructors (flexible to handle different signatures)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ErrorConstructor = new (...arguments_: any[]) => Error;

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
