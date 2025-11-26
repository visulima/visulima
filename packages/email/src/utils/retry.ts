import type { Result } from "../types";

/**
 * Helper function to retry a function with exponential backoff
 * @param function_ The async function to retry
 * @param retries Number of retry attempts (default: 3)
 * @param delay Initial delay in milliseconds (default: 300, doubles on each retry)
 * @returns A result object containing the function result or error
 */
const retry = async <T>(function_: () => Promise<Result<T>>, retries: number = 3, delay: number = 300): Promise<Result<T>> => {
    try {
        const result = await function_();

        if (result.success || retries <= 0) {
            return result;
        }

        await new Promise((resolve) => setTimeout(resolve, delay));

        return retry(function_, retries - 1, delay * 2);
    } catch (error) {
        if (retries <= 0) {
            return {
                error: error instanceof Error ? error : new Error(String(error)),
                success: false,
            };
        }

        await new Promise((resolve) => setTimeout(resolve, delay));

        return retry(function_, retries - 1, delay * 2);
    }
};

export default retry;
