import type { Checker } from "../types";

const DISPLAY_NAME = "HTTP check for";

/**
 * Default per-request timeout (in milliseconds) applied when the caller does
 * not provide their own `AbortSignal`. Prevents a stalled upstream from leaving
 * the report's `Promise.all` pending forever.
 */
const DEFAULT_TIMEOUT = 5000;

interface HttpCheckOptions {
    expected?: { body?: string; status?: number };
    fetchOptions?: RequestInit;

    /**
     * Per-request timeout, in milliseconds, used to build an `AbortSignal` when
     * the caller does not pass one via `fetchOptions.signal`. Defaults to
     * `5000`. Pass `0` to disable the default timeout.
     */
    timeout?: number;
}

const resolveHostLabel = (host: RequestInfo | URL): string => {
    if (typeof host === "string") {
        return host;
    }

    if (host instanceof URL) {
        return host.href;
    }

    return host.url;
};

/**
 * Register the `http` checker to ensure http body and status is correct.
 */
const httpCheck
    = (host: RequestInfo | URL, options?: HttpCheckOptions): Checker =>
        async () => {
            const hostLabel = resolveHostLabel(host);

            const fetchOptions: RequestInit = { ...options?.fetchOptions };

            // Apply a default abort timeout unless the caller supplied their own
            // signal or explicitly disabled it with `timeout: 0`.
            const timeout = options?.timeout ?? DEFAULT_TIMEOUT;

            if (fetchOptions.signal == null && timeout > 0) {
                fetchOptions.signal = AbortSignal.timeout(timeout);
            }

            try {
                const response = await fetch(host, fetchOptions);

                if (options?.expected?.status !== undefined && options.expected.status !== response.status) {
                    throw new Error(`${DISPLAY_NAME} ${hostLabel} returned status ${response.status} instead of ${options.expected.status}`);
                }

                if (options?.expected?.body !== undefined) {
                    const textBody = await response.text();

                    if (textBody !== options.expected.body) {
                        throw new Error(
                            `${DISPLAY_NAME} ${hostLabel} returned body ${JSON.stringify(textBody)} instead of ${JSON.stringify(options.expected.body)}`,
                        );
                    }
                }

                return {
                    displayName: `${DISPLAY_NAME} ${hostLabel}`,
                    health: {
                        healthy: true,
                        message: `${DISPLAY_NAME} ${hostLabel} was successful.`,
                        timestamp: new Date().toISOString(),
                    },
                    meta: {
                        host: hostLabel,
                        method: options?.fetchOptions?.method ?? "GET",
                        status: response.status,
                    },
                };
            } catch (error) {
                return {
                    displayName: `${DISPLAY_NAME} ${hostLabel}`,
                    health: {
                        healthy: false,
                        message: (error as Error).message,
                        timestamp: new Date().toISOString(),
                    },
                    meta: {
                        host: hostLabel,
                        method: options?.fetchOptions?.method ?? "GET",
                    },
                };
            }
        };

export type { HttpCheckOptions };

export default httpCheck;
