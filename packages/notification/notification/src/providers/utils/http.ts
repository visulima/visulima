import type { Result } from "../../types";

/**
 * Normalised HTTP response returned by {@link makeRequest}.
 */
export interface HttpResponse<T = unknown> {
    body: T;
    headers: Record<string, string>;
    status: number;
    statusText: string;
}

export interface MakeRequestOptions {
    body?: BodyInit | null;
    headers?: Record<string, string>;
    method?: string;
    timeout?: number;
}

/**
 * Thin `fetch` wrapper that parses JSON (falling back to text), enforces a timeout
 * and returns a {@link Result}. Edge-runtime safe — uses only `fetch`/`AbortController`.
 * @param url The absolute URL to request.
 * @param options Method, body, headers and timeout for the request.
 * @returns A result with the parsed {@link HttpResponse} on success.
 */
export const makeRequest = async <T = unknown>(url: string, options: MakeRequestOptions = {}): Promise<Result<HttpResponse<T>>> => {
    const controller = new AbortController();
    const timeout = options.timeout ?? 30_000;
    const timer = setTimeout(() => {
        controller.abort();
    }, timeout);

    try {
        const response = await fetch(url, {
            body: options.body,
            headers: options.headers,
            method: options.method ?? "GET",
            signal: controller.signal,
        });

        const text = await response.text();

        let parsed: unknown = text;

        if (text.length > 0) {
            try {
                parsed = JSON.parse(text);
            } catch {
                parsed = text;
            }
        }

        const headers: Record<string, string> = {};

        response.headers.forEach((value, key) => {
            headers[key] = value;
        });

        return {
            data: {
                body: parsed as T,
                headers,
                status: response.status,
                statusText: response.statusText,
            },
            success: true,
        };
    } catch (error) {
        return { error, success: false };
    } finally {
        clearTimeout(timer);
    }
};

/**
 * Whether an HTTP status code should be retried (network-class / transient).
 * @param status HTTP status code.
 * @returns `true` for 408, 429 and any 5xx.
 */
export const isRetryableStatus = (status: number): boolean => status === 408 || status === 429 || status >= 500;

/**
 * Retries an async function with exponential backoff + jitter.
 * @param function_ The async function to run.
 * @param retries Maximum retry attempts (in addition to the first call).
 * @param baseDelay Base backoff delay in ms.
 * @returns The function's resolved value.
 */
export const retry = async <T>(function_: () => Promise<T>, retries = 3, baseDelay = 250): Promise<T> => {
    let lastError: unknown;

    for (let attempt = 0; attempt <= retries; attempt += 1) {
        try {
            // eslint-disable-next-line no-await-in-loop
            return await function_();
        } catch (error) {
            lastError = error;

            if (attempt === retries) {
                break;
            }

            // eslint-disable-next-line sonarjs/pseudo-random
            const delay = baseDelay * 2 ** attempt + Math.floor(Math.random() * baseDelay);

            // eslint-disable-next-line no-await-in-loop,no-promise-executor-return
            await new Promise((resolve) => setTimeout(resolve, delay));
        }
    }

    throw lastError;
};

/**
 * Performs an HTTP request via {@link makeRequest}, retrying on network failures
 * and transient HTTP statuses (see {@link isRetryableStatus}) with exponential
 * backoff + jitter. Unlike {@link retry}, this inspects the resolved response so
 * completed-but-retryable responses (429 / 5xx) are retried too.
 * @param url The absolute URL to request.
 * @param options Method, body, headers and timeout for the request.
 * @param retries Maximum retry attempts (in addition to the first call).
 * @param baseDelay Base backoff delay in ms.
 * @returns The last {@link Result} (success or failure) after exhausting retries.
 */
export const requestWithRetry = async <T = unknown>(
    url: string,
    options: MakeRequestOptions = {},
    retries = 3,
    baseDelay = 250,
): Promise<Result<HttpResponse<T>>> => {
    let last = await makeRequest<T>(url, options);

    for (let attempt = 0; attempt < retries; attempt += 1) {
        const retryable = !last.success || (last.data !== undefined && isRetryableStatus(last.data.status));

        if (!retryable) {
            return last;
        }

        // eslint-disable-next-line sonarjs/pseudo-random
        const delay = baseDelay * 2 ** attempt + Math.floor(Math.random() * baseDelay);

        // eslint-disable-next-line no-await-in-loop,no-promise-executor-return
        await new Promise((resolve) => setTimeout(resolve, delay));
        // eslint-disable-next-line no-await-in-loop
        last = await makeRequest<T>(url, options);
    }

    return last;
};
