import type { State } from "../types";
import copyOwnProperties from "../utils/copy-own-properties";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ExtendedError = Error & { code?: any; errno?: any; syscall?: any };

const copyError = <Value extends EvalError | ExtendedError | RangeError | ReferenceError | SyntaxError | TypeError | URIError>(
    object: Value,
    state: State,
): Value => {
    // @ts-expect-error - We don't know the type of the object, can be an error
    const error = new object.constructor(object.message) as EvalError | ExtendedError | RangeError | ReferenceError | SyntaxError | TypeError | URIError;

    // If a `stack` property is present, copy it over...
    if (object.stack) {
        error.stack = object.stack;
    }

    // Node.js specific (system errors)...
    if ((object as ExtendedError).code) {
        (error as ExtendedError).code = (object as ExtendedError).code;
    }

    if ((object as ExtendedError).errno) {
        (error as ExtendedError).errno = (object as ExtendedError).errno;
    }

    if ((object as ExtendedError).syscall) {
        (error as ExtendedError).syscall = (object as ExtendedError).syscall;
    }

    return copyOwnProperties(object, error, state) as Value;
};

export default copyError;
