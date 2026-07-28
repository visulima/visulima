/**
 * Error thrown for HTTP responses that must not be retried (client errors that
 * are not `429`). Carrying a distinct type lets `sendWithRetry` fail fast instead
 * of running the generic retry loop.
 */
class NonRetryableHttpError extends Error {}

/**
 * Minimal Response interface for fetch-like responses.
 */
interface FetchResponse {
    headers: { forEach: (callback: (value: string, key: string) => void) => void; get: (name: string) => string | null };
    ok: boolean;
    status: number;
    statusText: string;
    text: () => Promise<string>;
}

/**
 * Callback invoked with the paired request/response for debugging purposes.
 */
type DebugRequestResponseCallback = (requestResponse: {
    req: { body: string | Uint8Array; headers: Record<string, string>; method: string; url: string };
    res: { body: string; headers: Record<string, string>; status: number; statusText: string };
}) => void;

/**
 * Calculates exponential backoff delay.
 * @param baseDelay Base delay in milliseconds
 * @param attempt Current attempt number
 * @returns Delay in milliseconds
 */
const calculateBackoffDelay = (baseDelay: number, attempt: number): number => baseDelay * 2 ** attempt;

/**
 * Upper bound (ms) applied to a server-supplied `Retry-After` so a hostile or
 * misconfigured value cannot stall the pipeline indefinitely.
 */
const MAX_RETRY_AFTER_MS = 60_000;

/** Matches the RFC 7231 delta-seconds form of `Retry-After` (an integer number of seconds). */
const DELTA_SECONDS_REGEX = /^\d+$/;

/**
 * Parses an HTTP `Retry-After` header value.
 *
 * Supports both forms defined by RFC 7231:
 * - delta-seconds (e.g. `"120"`)
 * - HTTP-date (e.g. `"Wed, 21 Oct 2015 07:28:00 GMT"`)
 *
 * The resulting delay is clamped to `[0, MAX_RETRY_AFTER_MS]`. Returns `undefined`
 * when the value cannot be parsed (so the caller falls back to exponential backoff
 * instead of `setTimeout(resolve, NaN)`, which would fire immediately).
 * @param value The raw `Retry-After` header value.
 * @returns Delay in milliseconds, or `undefined` if unparseable.
 */
const parseRetryAfter = (value: string): number | undefined => {
    const trimmed = value.trim();

    // delta-seconds form: an integer number of seconds.
    if (DELTA_SECONDS_REGEX.test(trimmed)) {
        const seconds = Number.parseInt(trimmed, 10);

        return Math.min(Math.max(seconds, 0) * 1000, MAX_RETRY_AFTER_MS);
    }

    // HTTP-date form: parse and compute the delta from now.
    const dateMs = Date.parse(trimmed);

    if (Number.isNaN(dateMs)) {
        return undefined;
    }

    const delta = dateMs - Date.now();

    return Math.min(Math.max(delta, 0), MAX_RETRY_AFTER_MS);
};

/**
 * Sleeps for the specified number of milliseconds.
 * @param delay Delay in milliseconds
 */
const sleep = (delay: number): Promise<void> =>
    new Promise((resolve) => {
        setTimeout(resolve, delay);
    });

/**
 * Converts request body to fetch-compatible format.
 * @param body The request body (string or Uint8Array)
 * @returns Fetch-compatible body or undefined
 */
const prepareRequestBody = (body: string | Uint8Array): BodyInit | undefined => {
    if (typeof body === "string") {
        return body;
    }

    // Uint8Array needs to be converted for fetch compatibility
    return new Uint8Array(body.buffer, body.byteOffset, body.byteLength) as unknown as BodyInit;
};

/**
 * Processes a successful HTTP response.
 * @param response The fetch response
 * @param url The request URL
 * @param method The HTTP method
 * @param headers The request headers
 * @param body The request body
 * @param onDebugRequestResponse Optional callback for debugging
 * @param onError Optional error callback
 * @returns True if the request should be retried, false otherwise
 */
const processResponse = async (
    response: FetchResponse,
    url: string,
    method: string,
    headers: Record<string, string>,
    body: string | Uint8Array,
    onDebugRequestResponse?: DebugRequestResponseCallback,
    onError?: (error: Error) => void,
): Promise<boolean> => {
    const responseHeaders: Record<string, string> = {};

    response.headers.forEach((value: string, key: string) => {
        responseHeaders[key] = value;
    });

    const responseBody = await response.text();

    const requestResponse = {
        req: {
            body,
            headers,
            method,
            url,
        },
        res: {
            body: responseBody,
            headers: responseHeaders,
            status: response.status,
            statusText: response.statusText,
        },
    };

    if (onDebugRequestResponse) {
        onDebugRequestResponse(requestResponse);
    }

    // Success
    if (response.ok) {
        return false;
    }

    // Non-retryable client errors
    if (response.status < 500 && response.status !== 429) {
        const error = new NonRetryableHttpError(`HTTP ${String(response.status)}: ${response.statusText}`);

        if (onError) {
            onError(error);
        }

        throw error;
    }

    // Retryable errors (429 or 5xx)
    return true;
};

/**
 * Handles rate limiting response.
 * @param response The fetch response
 * @param respectRateLimit Whether to respect rate limiting
 * @param retryDelay Base delay between retries
 * @param attempt Current attempt number
 * @param maxRetries Maximum number of retries
 * @returns Delay in milliseconds if should retry, undefined otherwise
 */
const handleRateLimit = (response: FetchResponse, respectRateLimit: boolean, retryDelay: number, attempt: number, maxRetries: number): number | undefined => {
    if (response.status === 429 && respectRateLimit && attempt < maxRetries) {
        const retryAfter = response.headers.get("retry-after");
        const parsed = retryAfter ? parseRetryAfter(retryAfter) : undefined;

        // Fall back to exponential backoff when the header is missing or unparseable
        // (previously an HTTP-date value produced NaN and fired the retry immediately).
        return parsed ?? calculateBackoffDelay(retryDelay, attempt);
    }

    return undefined;
};

/**
 * Handles server error response.
 * @param response The fetch response
 * @param retryDelay Base delay between retries
 * @param attempt Current attempt number
 * @param maxRetries Maximum number of retries
 * @returns Delay in milliseconds if should retry, undefined otherwise
 */
const handleServerError = (response: FetchResponse, retryDelay: number, attempt: number, maxRetries: number): number | undefined => {
    if (response.status >= 500 && attempt < maxRetries) {
        return calculateBackoffDelay(retryDelay, attempt);
    }

    return undefined;
};

/**
 * Calculates retry delay based on response status and attempt number.
 * @param response The fetch response
 * @param respectRateLimit Whether to respect rate limiting
 * @param retryDelay Base delay between retries
 * @param attempt Current attempt number
 * @param maxRetries Maximum number of retries
 * @returns Delay in milliseconds if should retry, undefined otherwise
 */
const calculateRetryDelay = (
    response: FetchResponse,
    respectRateLimit: boolean,
    retryDelay: number,
    attempt: number,
    maxRetries: number,
): number | undefined => {
    const rateLimitDelay = handleRateLimit(response, respectRateLimit, retryDelay, attempt, maxRetries);

    if (rateLimitDelay !== undefined) {
        return rateLimitDelay;
    }

    return handleServerError(response, retryDelay, attempt, maxRetries);
};

/**
 * Handles retry logic for failed requests.
 * @param error The error that occurred
 * @param attempt Current attempt number
 * @param maxRetries Maximum number of retries
 * @param retryDelay Base delay between retries
 * @param onError Optional error callback
 * @returns True if should retry, false otherwise
 */
const handleRetryError = async (
    error: unknown,
    attempt: number,
    maxRetries: number,
    retryDelay: number,
    onError?: (error: Error) => void,
): Promise<boolean> => {
    if (attempt < maxRetries) {
        const delay = calculateBackoffDelay(retryDelay, attempt);

        await sleep(delay);

        return true;
    }

    if (onError) {
        onError(error as Error);
    }

    return false;
};

/**
 * Stable per-request configuration shared across every retry attempt. Built once by
 * {@link sendWithRetry} and threaded through {@link performRequestAttempt} so the
 * per-attempt signature stays small.
 */
interface RetryRequestContext {
    body: string | Uint8Array;
    headers: Record<string, string>;
    maxRetries: number;
    method: string;
    onDebugRequestResponse?: DebugRequestResponseCallback;
    onError?: (error: Error) => void;
    respectRateLimit: boolean;
    retryDelay: number;
    url: string;
}

/**
 * Outcome of a single request attempt: either the request is complete (`{ done: true }`)
 * and the retry loop should stop, or a retry is warranted after `retryInMs` milliseconds.
 */
type AttemptResult = { done: true } | { retryInMs: number };

/**
 * Performs a single request attempt.
 * @param context Stable per-request configuration shared across attempts.
 * @param attempt Current attempt number (0-based).
 */
const performRequestAttempt = async (context: RetryRequestContext, attempt: number): Promise<AttemptResult> => {
    const { body, headers, maxRetries, method, onDebugRequestResponse, onError, respectRateLimit, retryDelay, url } = context;

    const requestBody = prepareRequestBody(body);

    const response = await fetch(url, {
        body: requestBody,
        headers,
        method,
    });

    const shouldRetry = await processResponse(response, url, method, headers, body, onDebugRequestResponse, onError);

    if (!shouldRetry) {
        return { done: true };
    }

    const retryDelayValue = calculateRetryDelay(response, respectRateLimit, retryDelay, attempt, maxRetries);

    if (retryDelayValue !== undefined) {
        return { retryInMs: retryDelayValue };
    }

    // Max retries reached or non-retryable error
    if (!response.ok) {
        const error = new Error(`HTTP ${String(response.status)}: ${response.statusText}`);

        if (onError) {
            onError(error);
        }

        throw error;
    }

    return { done: true };
};

/**
 * Sends an HTTP request with retry logic and rate limiting support.
 * @param url The URL to send the request to
 * @param method The HTTP method to use
 * @param headers Request headers
 * @param body The request body (string or Uint8Array)
 * @param maxRetries Maximum number of retry attempts
 * @param retryDelay Base delay between retries in milliseconds
 * @param respectRateLimit Whether to respect rate limiting (429 responses)
 * @param onDebugRequestResponse Optional callback for debugging requests/responses
 * @param onError Optional callback for error handling
 */
const sendWithRetry = async (
    url: string,
    method: string,
    headers: Record<string, string>,
    body: string | Uint8Array,
    maxRetries: number,
    retryDelay: number,
    respectRateLimit: boolean,
    onDebugRequestResponse?: DebugRequestResponseCallback,
    onError?: (error: Error) => void,
): Promise<void> => {
    const context: RetryRequestContext = {
        body,
        headers,
        maxRetries,
        method,
        onDebugRequestResponse,
        onError,
        respectRateLimit,
        retryDelay,
        url,
    };

    let attempt = 0;

    while (attempt <= maxRetries) {
        try {
            // eslint-disable-next-line no-await-in-loop
            const result = await performRequestAttempt(context, attempt);

            if ("retryInMs" in result) {
                // eslint-disable-next-line no-await-in-loop
                await sleep(result.retryInMs);
                attempt += 1;
            } else {
                return;
            }
        } catch (error) {
            // Non-retryable client errors (4xx except 429) already reported via onError
            // inside processResponse; fail fast instead of running the retry loop.
            if (error instanceof NonRetryableHttpError) {
                throw error;
            }

            // eslint-disable-next-line no-await-in-loop
            const shouldRetry = await handleRetryError(error, attempt, maxRetries, retryDelay, onError);

            if (!shouldRetry) {
                throw error;
            }

            attempt += 1;
        }
    }
};

export { parseRetryAfter };
export default sendWithRetry;
