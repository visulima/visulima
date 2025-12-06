/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Calculates exponential backoff delay.
 * @param baseDelay Base delay in milliseconds
 * @param attempt Current attempt number
 * @returns Delay in milliseconds
 */
const calculateBackoffDelay = (baseDelay: number, attempt: number): number => baseDelay * 2 ** attempt;

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
    return new Uint8Array(body.buffer, body.byteOffset, body.byteLength) as any;
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
    response: any,
    url: string,
    method: string,
    headers: Record<string, string>,
    body: string | Uint8Array,
    onDebugRequestResponse?: (requestResponse: {
        req: { body: string | Uint8Array; headers: Record<string, string>; method: string; url: string };
        res: { body: string; headers: Record<string, string>; status: number; statusText: string };
    }) => void,
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
        const error = new Error(`HTTP ${response.status}: ${response.statusText}`);

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
const handleRateLimit = (response: any, respectRateLimit: boolean, retryDelay: number, attempt: number, maxRetries: number): number | undefined => {
    if (response.status === 429 && respectRateLimit && attempt < maxRetries) {
        const retryAfter = response.headers.get("retry-after");

        return retryAfter ? Number.parseInt(retryAfter, 10) * 1000 : calculateBackoffDelay(retryDelay, attempt);
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
const handleServerError = (response: any, retryDelay: number, attempt: number, maxRetries: number): number | undefined => {
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
const calculateRetryDelay = (response: any, respectRateLimit: boolean, retryDelay: number, attempt: number, maxRetries: number): number | undefined => {
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
    onDebugRequestResponse?: (requestResponse: {
        req: { body: string | Uint8Array; headers: Record<string, string>; method: string; url: string };
        res: { body: string; headers: Record<string, string>; status: number; statusText: string };
    }) => void,
    onError?: (error: Error) => void,
): Promise<void> => {
    let attempt = 0;

    while (attempt <= maxRetries) {
        try {
            const requestBody = prepareRequestBody(body);

            // eslint-disable-next-line no-await-in-loop
            const response = await fetch(url, {
                body: requestBody,
                headers,
                method,
            });

            // eslint-disable-next-line no-await-in-loop
            const shouldRetry = await processResponse(response, url, method, headers, body, onDebugRequestResponse, onError);

            if (!shouldRetry) {
                return;
            }

            const retryDelayValue = calculateRetryDelay(response, respectRateLimit, retryDelay, attempt, maxRetries);

            if (retryDelayValue !== undefined) {
                // eslint-disable-next-line no-await-in-loop
                await sleep(retryDelayValue);
                attempt += 1;
                continue;
            }

            // Max retries reached or non-retryable error
            if (!response.ok) {
                const error = new Error(`HTTP ${response.status}: ${response.statusText}`);

                if (onError) {
                    onError(error);
                }

                throw error;
            }

            return;
        } catch (error) {
            // eslint-disable-next-line no-await-in-loop
            const shouldRetry = await handleRetryError(error, attempt, maxRetries, retryDelay, onError);

            if (shouldRetry) {
                attempt += 1;
                continue;
            }

            throw error;
        }
    }
};

export default sendWithRetry;
