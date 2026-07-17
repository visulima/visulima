import type { Result } from "../types";
import isRetryableResult from "./is-retryable-result";

/**
 * Helper function to retry an async function with exponential backoff.
 *
 * A failed attempt is only repeated when {@link isRetryableResult} judges it safe to do so — the
 * send endpoints behind these providers accept no idempotency key, so a request that may already
 * have been acted on is never sent twice. Pass `shouldRetry` to override that policy, e.g. for a
 * genuinely idempotent call that can afford to repeat anything.
 * @param function_ The async function to retry.
 * @param retries Number of retry attempts (default: 3).
 * @param delay Initial delay in milliseconds (default: 300, doubles on each retry).
 * @param shouldRetry Decides whether a failed result may be repeated (default: {@link isRetryableResult}).
 * @returns A result object containing the function result or error.
 */
const retry = async <T>(
    function_: () => Promise<Result<T>>,
    retries: number = 3,
    delay: number = 300,
    shouldRetry: (result: Result<T>) => boolean = isRetryableResult,
): Promise<Result<T>> => {
    try {
        const result = await function_();

        if (result.success || retries <= 0 || !shouldRetry(result)) {
            return result;
        }

        await new Promise<void>((resolve) => {
            setTimeout(() => {
                resolve();
            }, delay);
        });

        return retry(function_, retries - 1, delay * 2, shouldRetry);
    } catch (error) {
        // A throw never carries a server response, so nothing was acted on — unlike a failed
        // result, it is always safe to repeat.
        if (retries <= 0) {
            return {
                error: error instanceof Error ? error : new Error(String(error)),
                success: false,
            };
        }

        await new Promise<void>((resolve) => {
            setTimeout(() => {
                resolve();
            }, delay);
        });

        return retry(function_, retries - 1, delay * 2, shouldRetry);
    }
};

export default retry;
