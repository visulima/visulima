/* eslint-disable @typescript-eslint/no-unsafe-call */
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

    state.cache.set(object, error);

    // Reading `object.stack` materialises V8's lazy stack accessor into a data
    // property so `copyOwnProperties` below copies the actual trace instead of an
    // accessor that would recompute against the freshly-constructed clone. The Node
    // system-error fields (`code`/`errno`/`syscall`) are plain own data properties, so
    // `copyOwnProperties` already reproduces them (falsy values included).
    if (object.stack) {
        error.stack = object.stack;
    }

    return copyOwnProperties(object, error, state) as Value;
};

export default copyError;
