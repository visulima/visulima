import { deepStrictEqual } from "node:assert";

import type { Checker } from "../types";

const DISPLAY_NAME = "HTTP check for";

/**
 * Register the `http` checker to ensure http body and status is correct.
 */
const httpCheck
    = (
        host: RequestInfo | URL,
        options?: {
            expected?: { body?: string; status?: number };
            fetchOptions?: RequestInit;
        },
    ): Checker =>
        async () => {
            const hostLabel = typeof host === "string" ? host : host instanceof URL ? host.href : (host as Request).url;

            try {
                const response = await fetch(host, options?.fetchOptions ?? {});

                if (options?.expected?.status !== undefined && options.expected.status !== response.status) {
                    throw new Error(`${DISPLAY_NAME} ${hostLabel} returned status ${response.status} instead of ${options.expected.status}`);
                }

                if (options?.expected?.body !== undefined) {
                    const textBody = await response.text();

                    try {
                        deepStrictEqual(textBody, options.expected.body);
                    } catch {
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

export default httpCheck;
