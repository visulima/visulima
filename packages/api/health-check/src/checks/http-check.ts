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
            try {
            // eslint-disable-next-line compat/compat
                const response = await fetch(host, options?.fetchOptions ?? {});

                if (options?.expected?.status !== undefined && options.expected.status !== response.status) {
                    throw new Error(`${DISPLAY_NAME} ${host as string} returned status ${response.status} instead of ${options.expected.status}`);
                }

                if (options?.expected?.body !== undefined) {
                    const textBody = await response.text();

                    try {
                        deepStrictEqual(textBody, options.expected.body);
                    } catch {
                        throw new Error(
                            `${DISPLAY_NAME} ${host as string} returned body ${JSON.stringify(textBody)} instead of ${JSON.stringify(options.expected.body)}`,
                        );
                    }
                }

                return {
                    displayName: `${DISPLAY_NAME} ${host as string}`,
                    health: {
                        healthy: true,
                        message: `${DISPLAY_NAME} ${host as string} was successful.`,
                        timestamp: new Date().toISOString(),
                    },
                    meta: {
                        host,
                        method: options?.fetchOptions?.method ?? "GET",
                        status: response.status,
                    },
                };
            } catch (error) {
                return {
                    displayName: `${DISPLAY_NAME} ${host as string}`,
                    health: {
                        healthy: false,
                        message: (error as Error).message,
                        timestamp: new Date().toISOString(),
                    },
                    meta: {
                        host,
                        method: options?.fetchOptions?.method ?? "GET",
                    },
                };
            }
        };

export default httpCheck;
