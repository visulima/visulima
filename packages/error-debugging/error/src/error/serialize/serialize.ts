import type { SerializedError } from "./error-proto";
import { ErrorProto } from "./error-proto";

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
    if (typeof value !== "object" || value === null) {
        return false;
    }

    const proto: unknown = Object.getPrototypeOf(value);

    return proto === null || proto === Object.prototype || Object.getPrototypeOf(proto) === null;
};

type CauseError = Error & {
    cause: unknown;
};

interface JsonError extends Error {
    toJSON: () => SerializedError;
}

const toJsonWasCalled = new WeakSet();

/**
 * Make all properties of an object enumerable recursively.
 * This is needed when toJSON() returns a serialized error that will be used in object spreads.
 */
const makePropertiesEnumerable = (object: Record<string, unknown>): void => {
    const props = Object.getOwnPropertyNames(object);

    for (const prop of props) {
        const descriptor = Object.getOwnPropertyDescriptor(object, prop);

        if (descriptor) {
            // Make the property enumerable
            if (!descriptor.enumerable) {
                Object.defineProperty(object, prop, {
                    ...descriptor,
                    enumerable: true,
                });
            }

            // Recursively process nested objects (but not arrays or special types)
            if (
                descriptor.value
                && typeof descriptor.value === "object"
                && !Array.isArray(descriptor.value) // Check if it's a plain object (not Error, Date, etc.)
                && (Object.getPrototypeOf(descriptor.value) === Object.prototype || Object.getPrototypeOf(descriptor.value) === null)
            ) {
                makePropertiesEnumerable(descriptor.value as Record<string, unknown>);
            }
        }
    }
};

const toJSON = (from: JsonError) => {
    toJsonWasCalled.add(from);

    const json = from.toJSON();

    toJsonWasCalled.delete(from);

    // If toJSON returns an object, make all its properties enumerable
    // so they can be used in object spreads and JSON.stringify
    // However, if the object is non-extensible (like when toJSON returns 'this'),
    // preserve the original enumerability to match Error prototype behavior
    if (
        // Only make properties enumerable if the object is extensible
        // Non-extensible objects (like when toJSON returns 'this') should preserve original enumerability
        Object.isExtensible(json)
    ) {
        makePropertiesEnumerable(json);
    }

    return json;
};

// eslint-disable-next-line sonarjs/cognitive-complexity
const serializeValue = (value: unknown, seen: Set<Error>, depth: number, options: Options, seenObjects: Set<object> = new Set()): unknown => {
    if (value && value instanceof Uint8Array && value.constructor.name === "Buffer") {
        return "[object Buffer]";
    }

    if (value !== null && typeof value === "object" && "pipe" in value && typeof (value as Record<string, unknown>).pipe === "function") {
        return "[object Stream]";
    }

    if (value instanceof Error) {
        if (seen.has(value)) {
            return "[Circular]";
        }

        // eslint-disable-next-line no-param-reassign
        depth += 1;

        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        return _serialize(value, options, seen, depth);
    }

    if (
        options.useToJSON
        && value !== null
        && typeof value === "object"
        && "toJSON" in value
        && typeof (value as Record<string, unknown>).toJSON === "function"
    ) {
        return (value as { toJSON: () => unknown }).toJSON();
    }

    if (value instanceof Date) {
        return value.toISOString();
    }

    if (typeof value === "function") {
        return `[Function: ${value.name || "anonymous"}]`;
    }

    if (typeof value === "bigint") {
        return `${String(value)}n`;
    }

    if (isPlainObject(value)) {
        if (seenObjects.has(value)) {
            return "[Circular]";
        }

        // Check if we would exceed maxDepth after incrementing
        // If depth + 1 >= maxDepth, return empty object (we serialize the object itself but not its contents)
        if (options.maxDepth !== undefined && options.maxDepth !== Number.POSITIVE_INFINITY && depth + 1 >= options.maxDepth) {
            return {};
        }

        // eslint-disable-next-line no-param-reassign
        depth += 1;

        seenObjects.add(value);

        const plainObject: Record<string, unknown> = {};

        // eslint-disable-next-line guard-for-in,no-restricted-syntax
        for (const key in value) {
            plainObject[key] = serializeValue(value[key], seen, depth, options, seenObjects);
        }

        seenObjects.delete(value);

        return plainObject;
    }

    // Gracefully handle non-configurable errors like `DOMException`.
    try {
        return value;
    } catch {
        return "[Not Available]";
        /* empty */
    }
};

// eslint-disable-next-line @typescript-eslint/naming-convention,no-underscore-dangle
const _serialize = (
    error: AggregateError | Error | JsonError,
    options: Options,
    seen: Set<Error>,
    depth: number,
    // eslint-disable-next-line sonarjs/cognitive-complexity
): SerializedError => {
    seen.add(error);

    if (options.maxDepth === 0) {
        return {} as SerializedError;
    }

    if (options.useToJSON && typeof (error as JsonError).toJSON === "function" && !toJsonWasCalled.has(error)) {
        return toJSON(error as JsonError);
    }

    const protoError = Object.create(ErrorProto) as SerializedError;

    // Set error properties with correct enumerability
    // Serialized errors are plain objects, so all properties should be enumerable
    // for JSON serialization, object spreading, and toStrictEqual comparisons
    Object.defineProperty(protoError, "name", {
        configurable: true,
        enumerable: true,
        value: Object.prototype.toString.call(error.constructor) === "[object Function]" ? error.constructor.name : error.name,
        writable: true,
    });
    Object.defineProperty(protoError, "message", {
        configurable: true,
        enumerable: true,
        value: error.message,
        writable: true,
    });
    Object.defineProperty(protoError, "stack", {
        configurable: true,
        enumerable: true,
        value: error.stack,
        writable: true,
    });

    if (Array.isArray((error as AggregateError).errors)) {
        const aggregateErrors: SerializedError[] = [];

        for (const aggregateError of (error as AggregateError).errors) {
            if (!(aggregateError instanceof Error)) {
                throw new TypeError("All errors in the 'errors' property must be instances of Error");
            }

            if (seen.has(aggregateError)) {
                Object.defineProperty(protoError, "errors", {
                    configurable: true,
                    enumerable: true,
                    value: [],
                    writable: true,
                });

                return protoError;
            }

            aggregateErrors.push(_serialize(aggregateError, options, seen, depth));
        }

        Object.defineProperty(protoError, "errors", {
            configurable: true,
            enumerable: true,
            value: aggregateErrors,
            writable: true,
        });
    }

    // Handle cause property
    const causeValue = (error as CauseError).cause;

    if (causeValue !== undefined && causeValue !== null) {
        if (causeValue instanceof Error) {
            if (seen.has(causeValue)) {
                Object.defineProperty(protoError, "cause", {
                    configurable: true,
                    enumerable: true,
                    value: "[Circular]",
                    writable: true,
                });
            } else {
                Object.defineProperty(protoError, "cause", {
                    configurable: true,
                    enumerable: true,
                    value: _serialize(causeValue, options, seen, depth),
                    writable: true,
                });
            }
        } else {
            // Non-Error cause - serialize it as a regular value
            const serializedCause = serializeValue(causeValue, seen, depth, options);

            Object.defineProperty(protoError, "cause", {
                configurable: true,
                enumerable: true,
                value: serializedCause,
                writable: true,
            });
        }
    }

    // eslint-disable-next-line no-restricted-syntax
    for (const key in error) {
        // Skip properties we've already explicitly set
        if (key === "name" || key === "message" || key === "stack" || key === "cause" || key === "errors") {
            continue;
        }

        const value: unknown = error[key as keyof Error];
        const serializedValue = serializeValue(value, seen, depth, options);

        // All properties should be enumerable for serialized errors (plain objects)
        Object.defineProperty(protoError, key, {
            configurable: true,
            enumerable: true,
            value: serializedValue,
            writable: true,
        });
    }

    if (Array.isArray(options.exclude) && options.exclude.length > 0) {
        for (const key of options.exclude) {
            try {
                // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
                delete protoError[key];
            } catch {
                /* empty */
            }
        }
    }

    return protoError;
};

export type Options = {
    exclude?: string[];
    maxDepth?: number;
    useToJSON?: boolean;
};

/**
 * Serialize an `Error` object into a plain object.
 */
export const serialize = (error: AggregateError | Error | JsonError, options: Options = {}): SerializedError =>
    _serialize(
        error,
        {
            exclude: options.exclude ?? [],
            maxDepth: options.maxDepth ?? Number.POSITIVE_INFINITY,
            useToJSON: options.useToJSON ?? false,
        },
        new Set(),
        0,
    );
