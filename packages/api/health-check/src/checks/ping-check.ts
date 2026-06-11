import type { extendedPingOptions } from "pingman";
import ping from "pingman";

import type { Checker } from "../types";
import normalizeHost from "../utils/normalize-host";

const DISPLAY_NAME = "Ping check for";

/**
 * Register the `ping` checker to ensure that a domain is reachable.
 */
const pingCheck
    = (host: string, options?: extendedPingOptions): Checker =>
        async () => {
            try {
                const response = await ping(normalizeHost(host), options);

                if (!response.alive) {
                    return {
                        displayName: `${DISPLAY_NAME} ${host}`,
                        health: {
                            healthy: false,
                            message: `Ping failed for ${host}.`,
                            timestamp: new Date().toISOString(),
                        },

                        meta: response,
                    };
                }

                return {
                    displayName: `${DISPLAY_NAME} ${host}`,
                    health: {
                        healthy: true,
                        message: `${DISPLAY_NAME} ${host} was successful.`,
                        timestamp: new Date().toISOString(),
                    },

                    meta: response,
                };
            } catch (error) {
                return {
                    displayName: `${DISPLAY_NAME} ${host}`,
                    health: {
                        healthy: false,
                        message: (error as Error).message,
                        timestamp: new Date().toISOString(),
                    },
                };
            }
        };

export default pingCheck;
