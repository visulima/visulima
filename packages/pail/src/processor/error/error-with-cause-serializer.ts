import { getType } from "../../util/get-type";
import type { SerializedError } from "./error-proto";
import { ErrorProto, seen } from "./error-proto";

type CauseError = Error & {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    cause: any;
};

type Options = {
    readonly maxDepth?: number;
    readonly useToJSON?: boolean;
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
// eslint-disable-next-line sonarjs/cognitive-complexity
export const errorWithCauseSerializer = (error: AggregateError | Error, options: Options = {}): SerializedError => {
    // eslint-disable-next-line no-param-reassign,security/detect-object-injection
    error[seen] = undefined; // tag to prevent re-looking at this

    const protoError = Object.create(ErrorProto) as SerializedError;

    protoError.name = Object.prototype.toString.call(error.constructor) === "[object Function]" ? error.constructor.name : error.name;
    protoError.message = error.message;
    protoError.stack = error.stack;

    if (Array.isArray((error as AggregateError).errors)) {
        protoError.aggregateErrors = (error as AggregateError).errors.map((error_: AggregateError | Error) => errorWithCauseSerializer(error_, options));
    }

    // Handle aggregate errors
    if (getType((error as CauseError).cause) === "Error" && !Object.prototype.hasOwnProperty.call((error as CauseError).cause, seen)) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        protoError.cause = errorWithCauseSerializer((error as CauseError).cause, options);
    }

    // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
    for (const key in error) {
        // eslint-disable-next-line security/detect-object-injection
        if (protoError[key] === undefined) {
            // eslint-disable-next-line security/detect-object-injection
            const value = error[key];

            if (getType(value) === "Error") {
                if (!Object.prototype.hasOwnProperty.call(value, seen)) {
                    // eslint-disable-next-line security/detect-object-injection,@typescript-eslint/no-unsafe-argument
                    protoError[key] = errorWithCauseSerializer(value, options);
                }
            } else if (typeof value === "function") {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,security/detect-object-injection
                protoError[key] = `[Function: ${value.name || "anonymous"}]`;
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

    // eslint-disable-next-line no-param-reassign,security/detect-object-injection,@typescript-eslint/no-dynamic-delete
    delete error[seen]; // clean up tag in case err is serialized again later

    protoError.raw = error;

    return protoError;
};
