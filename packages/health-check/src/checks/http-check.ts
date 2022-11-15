import { deepStrictEqual } from "node:assert";

import type { Checker } from "../types";

const DISPLAY_NAME = "HTTP check for";

/**
 * Register the `http` checker to ensure http body and status is correct.
 */
const httpCheck =
    (host: RequestInfo | URL, fetchOption?: RequestInit, expected?: { status?: number; body?: string }): Checker =>
    async () => {
        try {
            // eslint-disable-next-line compat/compat
            const response = await fetch(host, fetchOption);

            if (typeof expected?.status !== "undefined" && expected?.status !== response.status) {
                throw new Error(`${DISPLAY_NAME} ${host} returned status ${response.status} instead of ${expected.status}`);
            }

            if (typeof expected?.body !== "undefined") {
                const textBody = await response.text();

                try {
                    deepStrictEqual(textBody, expected.body);
                } catch {
                    throw new Error(`${DISPLAY_NAME} ${host} returned body ${JSON.stringify(textBody)} instead of ${JSON.stringify(expected.body)}`);
                }
            }

            return {
                displayName: `${DISPLAY_NAME} ${host}`,
                health: {
                    healthy: true,
                    message: `${DISPLAY_NAME} ${host} was successful.`,
                    timestamp: new Date().toISOString(),
                },
                meta: {
                    host,
                    method: fetchOption?.method || "GET",
                    status: response.status,
                },
            };
        } catch (error: any) {
            return {
                displayName: `${DISPLAY_NAME} ${host}`,
                health: {
                    healthy: false,
                    message: error.message,
                    timestamp: new Date().toISOString(),
                },
                meta: {
                    host,
                    method: fetchOption?.method || "GET",
                },
            };
        }
    };

export default httpCheck;
