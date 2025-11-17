/**
 * Retry configuration options for storage operations
 */
export interface RetryConfig {
    /**
     * Multiplier for exponential backoff (e.g., 2 means delays double each retry)
     * @default 2
     */
    backoffMultiplier?: number;

    /**
     * Custom function to calculate delay for a specific retry attempt
     * @param attempt The current retry attempt (0-indexed)
     * @param error The error that occurred
     * @returns Delay in milliseconds, or undefined to use default exponential backoff
     */
    calculateDelay?: (attempt: number, error: unknown) => number | undefined;

    /**
     * Initial delay in milliseconds before first retry
     * @default 1000
     */
    initialDelay?: number;

    /**
     * Maximum delay in milliseconds between retries
     * @default 30000
     */
    maxDelay?: number;

    /**
     * Maximum number of retry attempts
     * @default 3
     */
    maxRetries?: number;

    /**
     * HTTP status codes that should trigger a retry
     * @default [408, 429, 500, 502, 503, 504]
     */
    retryableStatusCodes?: number[];

    /**
     * Custom function to determine if an error should be retried
     * @param error The error that occurred
     * @returns true if the error should be retried, false otherwise
     */
    shouldRetry?: (error: unknown) => boolean;
}

/**
 * Default retry configuration
 */
const defaultRetryConfig: Required<RetryConfig> = {
    backoffMultiplier: 2,
    calculateDelay: undefined,
    initialDelay: 1000,
    maxDelay: 30_000,
    maxRetries: 3,
    retryableStatusCodes: [408, 429, 500, 502, 503, 504],
    shouldRetry: () => true,
};

/**
 * Determines if an error is retryable based on common patterns
 * @param error The error to check
 * @param retryableStatusCodes HTTP status codes that should trigger retry
 * @returns true if the error is retryable
 */
export const isRetryableError = (error: unknown, retryableStatusCodes: number[] = defaultRetryConfig.retryableStatusCodes): boolean => {
    // Network errors (ECONNRESET, ETIMEDOUT, etc.)
    if (error instanceof Error) {
        const errorCode = (error as any).code;
        const errorName = error.name;

        // Network-related errors
        if (
            errorCode === "ECONNRESET"
            || errorCode === "ETIMEDOUT"
            || errorCode === "ENOTFOUND"
            || errorCode === "ECONNREFUSED"
            || errorCode === "EAI_AGAIN"
            || errorName === "NetworkError"
            || errorName === "TimeoutError"
        ) {
            return true;
        }

        // AWS SDK errors
        if ((error as any).$metadata) {
            const statusCode = (error as any).$metadata.httpStatusCode;

            if (statusCode && retryableStatusCodes.includes(statusCode)) {
                return true;
            }

            // AWS SDK v3 retryable flag
            if ((error as any).$fault === "server") {
                return true;
            }
        }

        // AWS SDK v2 errors
        if ((error as any).retryable === true) {
            return true;
        }

        // Azure Storage errors
        if ((error as any).statusCode && retryableStatusCodes.includes((error as any).statusCode)) {
            return true;
        }

        // Check for retryable flag in error
        if ((error as any).retryable === true) {
            return true;
        }
    }

    return false;
};

/**
 * Calculate exponential backoff delay
 * @param attempt Current retry attempt (0-indexed)
 * @param initialDelay Initial delay in milliseconds
 * @param backoffMultiplier Multiplier for exponential backoff
 * @param maxDelay Maximum delay in milliseconds
 * @returns Delay in milliseconds
 */
const calculateExponentialBackoff = (attempt: number, initialDelay: number, backoffMultiplier: number, maxDelay: number): number => {
    const delay = initialDelay * backoffMultiplier ** attempt;

    return Math.min(delay, maxDelay);
};

/**
 * Sleep for a specified number of milliseconds
 * @param ms Milliseconds to sleep
 */
const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Retry an async operation with exponential backoff
 * @param fn The async function to retry
 * @param config Retry configuration
 * @returns The result of the function
 * @throws The last error if all retries are exhausted
 */
export const retry = async <T>(function_: () => Promise<T>, config: RetryConfig = {}): Promise<T> => {
    const {
        backoffMultiplier = defaultRetryConfig.backoffMultiplier,
        calculateDelay = defaultRetryConfig.calculateDelay,
        initialDelay = defaultRetryConfig.initialDelay,
        maxDelay = defaultRetryConfig.maxDelay,
        maxRetries = defaultRetryConfig.maxRetries,
        retryableStatusCodes = defaultRetryConfig.retryableStatusCodes,
        shouldRetry = defaultRetryConfig.shouldRetry,
    } = config;

    let lastError: unknown;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await function_();
        } catch (error: unknown) {
            lastError = error;

            // Don't retry if we've exhausted all attempts
            if (attempt >= maxRetries) {
                break;
            }

            // Check if error is retryable
            const isRetryable = shouldRetry(error) || isRetryableError(error, retryableStatusCodes);

            if (!isRetryable) {
                throw error;
            }

            // Calculate delay for this retry attempt
            const delay = calculateDelay ? calculateDelay(attempt, error) : calculateExponentialBackoff(attempt, initialDelay, backoffMultiplier, maxDelay);

            if (delay !== undefined && delay > 0) {
                await sleep(delay);
            }
        }
    }

    throw lastError;
};

/**
 * Create a retry wrapper function with pre-configured settings
 * @param config Retry configuration
 * @returns A function that wraps async operations with retry logic
 */
export const createRetryWrapper
    = (config: RetryConfig = {}) =>
        <T>(function_: () => Promise<T>): Promise<T> =>
            retry(function_, config);
