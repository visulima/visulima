import type { RetryOptions } from "../../types";

/**
 * Builds an options bag for `fs.rm` / `fs.rmSync` from a `RetryOptions`
 * input, omitting `maxRetries` / `retryDelay` when they're `undefined`.
 *
 * Node ≥22.3 validates the rm options bag and throws
 * `ERR_INVALID_ARG_TYPE` when either field is set to `undefined`
 * — passing them through unconditionally (via spread or explicit
 * assignment) would crash callers that supplied `{}` or
 * `{ retryDelay: undefined }`.
 */
const buildRmOptions = (options?: RetryOptions): { force: true; maxRetries?: number; recursive: true; retryDelay?: number } => {
    const rmOptions: { force: true; maxRetries?: number; recursive: true; retryDelay?: number } = { force: true, recursive: true };

    if (options?.maxRetries !== undefined) {
        rmOptions.maxRetries = options.maxRetries;
    }

    if (options?.retryDelay !== undefined) {
        rmOptions.retryDelay = options.retryDelay;
    }

    return rmOptions;
};

export default buildRmOptions;
