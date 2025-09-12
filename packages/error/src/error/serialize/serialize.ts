// eslint-disable-next-line import/no-extraneous-dependencies
import isPlainObject from "is-plain-obj";

import type { SerializedError } from "./error-proto";
import { ErrorProto } from "./error-proto";

type CauseError = Error & {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    cause: any;
};

interface JsonError extends Error {
    toJSON: () => SerializedError;
}

const toJsonWasCalled = new WeakSet();

const toJSON = (from: JsonError) => {
    toJsonWasCalled.add(from);

    const json = from.toJSON();

    toJsonWasCalled.delete(from);

    return json;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any,sonarjs/cognitive-complexity
const serializeValue = (value: any, seen: Error[], depth: number, options: Options): any => {
    if (value && value instanceof Uint8Array && value.constructor.name === "Buffer") {
        return "[object Buffer]";
    }

    if (value !== null && typeof value === "object" && typeof value.pipe === "function") {
        return "[object Stream]";
    }

    if (value instanceof Error) {
        if (seen.includes(value)) {
            return "[Circular]";
        }

        // eslint-disable-next-line no-param-reassign
        depth += 1;

        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        return _serialize(value, options, seen, depth);
    }

    if (options.useToJSON && typeof value.toJSON === "function") {
        return value.toJSON();
    }

    if (typeof value === "object" && value instanceof Date) {
        return value.toISOString();
    }

    if (typeof value === "function") {
        return `[Function: ${value.name || "anonymous"}]`;
    }

    if (isPlainObject(value)) {
        // eslint-disable-next-line no-param-reassign
        depth += 1;

        if (options.maxDepth && depth >= options.maxDepth) {
            return {};
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const plainObject: Record<any, any> = {};

        // eslint-disable-next-line guard-for-in,no-loops/no-loops,no-restricted-syntax
        for (const key in value) {
            // eslint-disable-next-line security/detect-object-injection
            plainObject[key] = serializeValue(value[key], seen, depth, options);
        }

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
    seen: Error[],
    depth: number,
    // eslint-disable-next-line sonarjs/cognitive-complexity
): SerializedError => {
    seen.push(error);

    if (options.maxDepth === 0) {
        return {} as SerializedError;
    }

    if (options.useToJSON && typeof (error as JsonError).toJSON === "function" && !toJsonWasCalled.has(error)) {
        return toJSON(error as JsonError);
    }

    const protoError = Object.create(ErrorProto as object) as SerializedError;

    protoError.name = Object.prototype.toString.call(error.constructor) === "[object Function]" ? error.constructor.name : error.name;
    protoError.message = error.message;
    protoError.stack = error.stack;

    if (Array.isArray((error as AggregateError).errors)) {
        const aggregateErrors: SerializedError[] = [];

        // eslint-disable-next-line no-loops/no-loops
        for (const aggregateError of (error as AggregateError).errors) {
            if (!(aggregateError instanceof Error)) {
                throw new TypeError("All errors in the 'errors' property must be instances of Error");
            }

            if (seen.includes(aggregateError)) {
                protoError.errors = [];

                return protoError;
            }

            aggregateErrors.push(_serialize(aggregateError, options, seen, depth));
        }

        protoError.errors = aggregateErrors;
    }

    // Handle aggregate errors

    if ((error as CauseError).cause instanceof Error && !seen.includes((error as CauseError).cause)) {
        protoError.cause = _serialize((error as CauseError).cause, options, seen, depth);
    }

    // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
    for (const key in error) {
        // eslint-disable-next-line security/detect-object-injection
        if (protoError[key] === undefined) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const value = error[key as keyof Error] as any;

            // eslint-disable-next-line security/detect-object-injection
            protoError[key] = serializeValue(value, seen, depth, options);
        }
    }

    if (Array.isArray(options.exclude) && options.exclude.length > 0) {
        // eslint-disable-next-line no-loops/no-loops
        for (const key of options.exclude) {
            try {
                // eslint-disable-next-line security/detect-object-injection,@typescript-eslint/no-dynamic-delete
                delete protoError[key];
            } catch {
                /* empty */
            }
        }
    }

    return protoError as SerializedError;
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
        [],
        0,
    );
