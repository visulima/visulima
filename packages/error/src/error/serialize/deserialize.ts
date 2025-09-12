// eslint-disable-next-line import/no-extraneous-dependencies
import isPlainObject from "is-plain-obj";

import { getErrorConstructor, isErrorLike } from "./error-constructors";
import NonError from "./non-error";

interface DeserializeOptions {
    maxDepth?: number;
}

/**
 * Options for deserializing error objects.
 */
type DeserializeOptionsType = DeserializeOptions;

const defaultOptions: DeserializeOptions = {
    maxDepth: Number.POSITIVE_INFINITY,
};

/**
 * Deserialize a plain object, potentially reconstructing it as an Error.
 */
const deserializePlainObject = (object: Record<string, unknown>, options: DeserializeOptionsType, depth = 0): Error => {
    // Check if it looks like a serialized error first
    if (isErrorLike(object)) {
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        return reconstructError(object, options, depth);
    }

    // Check maxDepth for non-error objects
    if (options.maxDepth !== undefined && depth >= options.maxDepth) {
        return new NonError(JSON.stringify(object));
    }

    // Not an error-like object
    return new NonError(JSON.stringify(object));
};

/**
 * Reconstruct an AggregateError from serialized data.
 */
const reconstructAggregateError = (
    Constructor: new (...arguments_: unknown[]) => Error,
    errors: unknown[],
    message: unknown,
    options: DeserializeOptionsType,
    depth: number,
): Error => {
    // Reconstruct the errors array first
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    const reconstructedErrors = errors.map((error_) => deserializeValue(error_, options, depth + 1));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return new (Constructor as any)(reconstructedErrors, message);
};

/**
 * Reconstruct an Error from a serialized error object.
 */
const reconstructError = (serialized: Record<string, unknown>, options: DeserializeOptionsType, depth: number): Error => {
    // Check maxDepth for error reconstruction
    if (options.maxDepth !== undefined && depth >= options.maxDepth) {
        return new NonError(JSON.stringify(serialized));
    }

    const { cause, errors, message, name, stack, ...properties } = serialized;

    // Get the appropriate constructor
    const Constructor = getErrorConstructor(name as string) || Error;

    // Create the error instance, handling AggregateError specially
    const error
        = name === "AggregateError" && Array.isArray(errors)
            ? reconstructAggregateError(Constructor as new (...arguments_: unknown[]) => Error, errors, message, options, depth)
            : new Constructor(message as string);

    // Restore the name if it was different
    if (name && error.name !== name) {
        error.name = name as string;
    }

    // Restore the stack if provided
    if (stack) {
        error.stack = stack as string;
    }

    // Restore other properties
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    restoreErrorProperties(error, properties, cause, name, options, depth);

    // Restore cause if present
    if (cause !== undefined) {
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        error.cause = deserializeValue(cause, options, depth + 1);
    }

    // Make properties enumerable where appropriate
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    makePropertiesEnumerable(error, serialized);

    return error;
};

/**
 * Deserialize a nested value.
 */
const deserializeValue = (value: unknown, options: DeserializeOptionsType, depth: number): unknown => {
    if (isPlainObject(value)) {
        return deserializePlainObject(value, options, depth);
    }

    if (Array.isArray(value)) {
        return value.map((item) => deserializeValue(item, options, depth));
    }

    return value;
};

/**
 * Restore additional properties on an error object.
 */
const restoreErrorProperties = (
    error: Error,
    properties: Record<string, unknown>,
    cause: unknown,
    name: unknown,
    options: DeserializeOptionsType,
    depth: number,
): void => {
    const errorCopy = error as unknown as Record<string, unknown>;

    for (const [key, value] of Object.entries(properties)) {
        if (key === "cause" && cause !== undefined) {
            // Cause is already handled above, skip
            continue;
        } else if (key === "errors" && name === "AggregateError") {
            // Errors are already handled above for AggregateError, skip
            continue;
        } else {
            // Recursively deserialize nested values
            errorCopy[key] = deserializeValue(value, options, depth + 1);
        }
    }
};

/**
 * Make error properties enumerable based on the original serialized object.
 */
const makePropertiesEnumerable = (error: Error, serialized: Record<string, unknown>): void => {
    // Get all properties from the error (including inherited ones)
    const errorProperties = new Set<string>();

    // Add standard Error properties
    errorProperties.add("name");
    errorProperties.add("message");
    errorProperties.add("stack");

    // Add any additional properties that were in the serialized object
    for (const key of Object.keys(serialized)) {
        errorProperties.add(key);
    }

    // Define properties to ensure proper enumerability
    for (const key of errorProperties) {
        if (key in error) {
            const descriptor = Object.getOwnPropertyDescriptor(error, key);

            if (descriptor && !descriptor.enumerable) {
                // Make it enumerable if it wasn't
                Object.defineProperty(error, key, {
                    ...descriptor,
                    enumerable: true,
                });
            }
        }
    }
};

/**
 * Handle primitive values by wrapping them in NonError.
 */
const handlePrimitive = (value: string | number | boolean | null): NonError => new NonError(JSON.stringify(value));

/**
 * Handle arrays by wrapping them in NonError.
 */
const handleArray = (value: unknown[]): NonError => new NonError(JSON.stringify(value));

/**
 * Handle plain objects.
 */
const handlePlainObject = (value: Record<string, unknown>, config: DeserializeOptionsType): Error => {
    if (isErrorLike(value)) {
        return reconstructError(value, config, 0);
    }

    return deserializePlainObject(value, config);
};

/**
 * Deserialize a value back to its original form.
 * If the value looks like a serialized error, it will be reconstructed as an Error instance.
 * Otherwise, it will be wrapped in a NonError.
 */
const deserialize = (value: unknown, options: DeserializeOptionsType = {}): Error => {
    const config = { ...defaultOptions, ...options };

    // If it's already an Error, return it as-is
    if (value instanceof Error) {
        return value;
    }

    // Handle null
    if (value === null) {
        // eslint-disable-next-line unicorn/no-null
        return handlePrimitive(null);
    }

    // Handle primitives
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        return handlePrimitive(value as string | number | boolean);
    }

    // Handle arrays
    if (Array.isArray(value)) {
        return handleArray(value);
    }

    // Check if it looks like a serialized error (this handles objects with prototypes like serialized errors)
    if (isErrorLike(value)) {
        return reconstructError(value as Record<string, unknown>, config, 0);
    }

    // Handle plain objects
    if (isPlainObject(value)) {
        return handlePlainObject(value as Record<string, unknown>, config);
    }

    // Handle other types
    return new NonError(JSON.stringify(value));
};

export default deserialize;
