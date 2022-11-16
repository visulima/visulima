import type { IPFamily, Options } from "cacheable-lookup";
import CacheableLookup from "cacheable-lookup";

import type { Checker } from "../types";

const DISPLAY_NAME = "DNS check for";

/**
 * Register the `dns` checker to ensure that a domain is reachable.
 */
const dnsCheck = (
    host: string,
    expectedAddresses?: string[],
    options?: {
        family?: IPFamily | "all";
        hints?: number;
    } & Options,
): Checker => async () => {
    const { hints, family = "all", ...config } = options || {};

    const cacheable = new CacheableLookup(config);

    try {
        const meta = await cacheable.lookupAsync(host.replace(/^https?:\/\//, ""), {
            hints,
            ...(family === "all" ? { all: true } : { family: family as IPFamily }),
        });

        if (Array.isArray(expectedAddresses) && !expectedAddresses?.includes(meta.address)) {
            return {
                displayName: `${DISPLAY_NAME} ${host}`,
                health: {
                    healthy: false,
                    message: `${DISPLAY_NAME} ${host} returned address ${meta.address} instead of ${expectedAddresses.join(", ")}.`,
                    timestamp: new Date().toISOString(),
                },
                meta: {
                    host,
                    addresses: meta,
                },
            };
        }

        return {
            displayName: `${DISPLAY_NAME} ${host}`,
            health: {
                healthy: true,
                message: `${DISPLAY_NAME} ${host} were resolved.`,
                timestamp: new Date().toISOString(),
            },
            meta: {
                host,
                addresses: meta,
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
            },
        };
    }
};

export default dnsCheck;
