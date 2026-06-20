import NotificationError from "../errors/notification-error";
import type { Result } from "../types";

/**
 * A successful {@link Result} with its data narrowed to be present.
 */
export type OkResult<T> = Result<T> & { data: T; success: true };

/**
 * A failed {@link Result}, narrowed to the failure case.
 */
export type FailResult<T> = Result<T> & { success: false };

/**
 * Returns whether a {@link Result} succeeded, narrowing `data` to be present.
 * @param result The result to test.
 * @returns `true` when the result is successful.
 */
export const isOk = <T>(result: Result<T>): result is OkResult<T> => result.success;

/**
 * Returns whether a {@link Result} failed.
 * @param result The result to test.
 * @returns `true` when the result is a failure.
 */
// eslint-disable-next-line unicorn/prevent-abbreviations
export const isErr = <T>(result: Result<T>): result is FailResult<T> => !result.success;

/**
 * Returns the data of a successful {@link Result}, or throws its error.
 * @param result The result to unwrap.
 * @returns The contained data.
 * @throws {NotificationError} The result's error (wrapped when it is not already an `Error`).
 */
export const unwrap = <T>(result: Result<T>): T => {
    if (result.success) {
        return result.data as T;
    }

    if (result.error instanceof Error) {
        throw result.error;
    }

    throw new NotificationError("result", "Called unwrap() on a failed result", { cause: result.error });
};

/**
 * Returns the data of a successful {@link Result}, or a fallback when it failed.
 * @param result The result to unwrap.
 * @param fallback The value to return on failure.
 * @returns The data, or the fallback.
 */
export const unwrapOr = <T>(result: Result<T>, fallback: T): T => {
    if (result.success) {
        return result.data as T;
    }

    return fallback;
};

/**
 * Maps the data of a successful {@link Result}, passing failures through unchanged.
 * @param result The result to map.
 * @param function_ The mapper applied to the data on success.
 * @returns A new result with the mapped data, or the original failure.
 */
export const mapOk = <T, U>(result: Result<T>, function_: (data: T) => U): Result<U> => {
    if (result.success) {
        return { data: function_(result.data as T), success: true };
    }

    return { error: result.error, success: false };
};

/**
 * Runs an async function and captures its outcome as a {@link Result}, never throwing.
 * @param function_ The async function to run.
 * @returns A successful result with the value, or a failed result with the thrown error.
 */
export const tryAsync = async <T>(function_: () => Promise<T>): Promise<Result<T>> => {
    try {
        return { data: await function_(), success: true };
    } catch (error) {
        return { error, success: false };
    }
};
