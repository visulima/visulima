import EmailError from "../errors/email-error";
import type { Result } from "../types";

const hasBuffer = globalThis.Buffer !== undefined;

/**
 * Request options compatible with both Fetch API and Node.js http
 */
export interface RequestOptions {
    [key: string]: unknown;
    headers?: Record<string, string>;
    method?: string;
    timeout?: number;
}

/**
 * Makes an HTTP request using Fetch API (compatible with Node.js 20.19+, Deno, Bun, Cloudflare Workers).
 * @param url The URL to make the request to.
 * @param options Request options including method, headers, and timeout.
 * @param data Optional request body data (string, Buffer, or Uint8Array).
 * @returns A result object containing the response data or error.
 */
// eslint-disable-next-line sonarjs/cognitive-complexity
export const makeRequest = async (url: string | URL, options: RequestOptions = {}, data?: string | Buffer | Uint8Array): Promise<Result<unknown>> => {
    const urlObject = typeof url === "string" ? new URL(url) : url;

    try {
        const headers = new Headers();

        if (options.headers) {
            Object.entries(options.headers).forEach(([key, value]) => {
                headers.set(key, value);
            });
        }

        const fetchOptions: RequestInit = {
            headers,
            method: options.method || (data ? "POST" : "GET"),
        };

        if (data) {
            if (typeof data === "string") {
                fetchOptions.body = data;
            } else if (data instanceof Uint8Array) {
                fetchOptions.body = data as BodyInit;
            } else if (hasBuffer && (data as unknown) instanceof (globalThis.Buffer as unknown as typeof Buffer)) {
                // Convert Buffer to Uint8Array for better fetch API compatibility
                fetchOptions.body = new Uint8Array(data as ArrayLike<number>) as BodyInit;
            } else {
                // Fallback: convert to Uint8Array
                fetchOptions.body = new Uint8Array(data as ArrayLike<number>) as BodyInit;
            }
        }

        let controller: AbortController | undefined;
        let timeoutId: ReturnType<typeof setTimeout> | undefined;

        if (options.timeout) {
            controller = new AbortController();
            timeoutId = setTimeout(() => {
                controller?.abort();
            }, options.timeout);
            fetchOptions.signal = controller.signal;
        }

        try {
            const response = await fetch(urlObject.toString(), fetchOptions);

            if (timeoutId) {
                clearTimeout(timeoutId);
            }

            const contentType = response.headers.get("content-type") || "";
            const isJson = contentType.includes("application/json");

            let parsedBody: unknown;

            if (isJson) {
                try {
                    parsedBody = await response.json();
                } catch {
                    parsedBody = await response.text();
                }
            } else {
                parsedBody = await response.text();
            }

            const isSuccess = response.status >= 200 && response.status < 300;

            const headersObject: Record<string, string> = {};

            response.headers.forEach((value, key) => {
                headersObject[key] = value;
            });

            return {
                data: {
                    body: parsedBody,
                    headers: headersObject,
                    statusCode: response.status,
                },
                error: isSuccess ? undefined : new EmailError("http", `Request failed with status ${response.status}`, { code: response.status.toString() }),
                success: isSuccess,
            };
        } catch (error) {
            if (timeoutId) {
                clearTimeout(timeoutId);
            }

            if (error instanceof Error && error.name === "AbortError") {
                return {
                    error: new EmailError("http", `Request timed out after ${options.timeout}ms`),
                    success: false,
                };
            }

            throw error;
        }
    } catch (error) {
        return {
            error: new EmailError("http", `Request failed: ${error instanceof Error ? error.message : String(error)}`, {
                cause: error instanceof Error ? error : new Error(String(error)),
            }),
            success: false,
        };
    }
};
