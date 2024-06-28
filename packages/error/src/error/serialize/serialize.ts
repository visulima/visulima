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

// eslint-disable-next-line @typescript-eslint/naming-convention,no-underscore-dangle
const _serialize = (
    error: AggregateError | Error | JsonError,
    options: Options,
    seen: WeakSet<Error>,
    depth: number,
    to?: SerializedError,
): SerializedError => {
    seen.add(error);

    if (options.useToJSON && typeof (error as JsonError).toJSON === "function" && !toJsonWasCalled.has(error)) {
        return toJSON(error as JsonError);
    }

    const protoError = Object.create(ErrorProto as object) as SerializedError;

    protoError.name = Object.prototype.toString.call(error.constructor) === "[object Function]" ? error.constructor.name : error.name;
    protoError.message = error.message;
    protoError.stack = error.stack;

    if (Array.isArray((error as AggregateError).errors)) {
        protoError.errors = (error as AggregateError).errors.map((error_: AggregateError | Error) => _serialize(error_, options, seen, depth, to));
    }

    // Handle aggregate errors
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    if ((error as CauseError).cause instanceof Error && !seen.has((error as CauseError).cause)) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        protoError.cause = _serialize((error as CauseError).cause, options, seen, depth, to);
    }

    // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
    for (const key in error) {
        // eslint-disable-next-line security/detect-object-injection
        if (protoError[key] === undefined) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const value = error[key as keyof Error] as any;

            if (value && value instanceof Uint8Array && value.constructor.name === "Buffer") {
                // eslint-disable-next-line security/detect-object-injection
                protoError[key] = "[object Buffer]";
            } else if (value !== null && typeof value === "object" && typeof value.pipe === "function") {
                // eslint-disable-next-line security/detect-object-injection
                protoError[key] = "[object Stream]";
            } else if (value instanceof Error) {
                if (seen.has(value)) {
                    // eslint-disable-next-line security/detect-object-injection
                    protoError[key] = "[Circular]";
                } else {
                    // eslint-disable-next-line no-param-reassign
                    depth += 1;

                    // eslint-disable-next-line security/detect-object-injection
                    protoError[key] = _serialize(value, options, seen, depth, to);
                }
            } else if (typeof value === "function") {
                // eslint-disable-next-line security/detect-object-injection
                protoError[key] = "[Function: " + (value.name || "anonymous") + "]";
            } else {
                // Gracefully handle non-configurable errors like `DOMException`.
                try {
                    // eslint-disable-next-line security/detect-object-injection
                    protoError[key] = value;
                } catch {
                    /* empty */
                }
            }
        }
    }

    seen.delete(error); // clean up tag in case err is serialized again later

    if (Array.isArray(options.exclude) && options.exclude.length > 0) {
        // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
        for (const key of options.exclude) {
            try {
                // eslint-disable-next-line security/detect-object-injection,@typescript-eslint/no-dynamic-delete
                delete protoError[key];
            } catch {
                /* empty */
            }
        }
    }

    // eslint-disable-next-line no-param-reassign
    to = protoError;

    return protoError as SerializedError;
};

export type Options = {
    exclude?: string[];
    maxDepth?: number;
    useToJSON?: boolean;
};

/**
 * Serialize an `Error` object into a plain object.
 *
 * - Non-error values are passed through.
 * - Custom properties are preserved.
 * - Buffer properties are replaced with `[object Buffer]`.
 * - Circular references are handled.
 * - If the input object has a `.toJSON()` method, then it's called instead of serializing the object's properties.
 * - It's up to `.toJSON()` implementation to handle circular references and enumerability of the properties.
 */
export const serialize = (error: AggregateError | Error | JsonError, options: Options = {}): SerializedError => {
    const seenSet = new WeakSet();

    return _serialize(
        error,
        {
            exclude: options.exclude ?? [],
            maxDepth: options.maxDepth ?? Number.POSITIVE_INFINITY,
            useToJSON: options.useToJSON ?? false,
        },
        seenSet,
        0,
    );
};
