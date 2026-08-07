import type { EntryObject, LookupOptions, Options } from "cacheable-lookup";
import CacheableLookup from "cacheable-lookup";

import type { Checker } from "../types";
import normalizeHost from "../utils/normalize-host";

const DISPLAY_NAME = "DNS check for";

interface DnsOptions extends Options {
    family?: "all" | 4 | 6;
    hints?: number;
}

/**
 * Register the `dns` checker to ensure that a domain is reachable.
 */
const dnsCheck = (host: string, expectedAddresses?: string[], options?: DnsOptions): Checker => {
    const { family = "all", hints, ...config } = options ?? {};

    const cacheable = new CacheableLookup(config);

    return async () => {
        try {
            const meta = (await cacheable.lookupAsync(normalizeHost(host), {
                hints,
                ...family === "all" ? { all: true } : { family },
            } as LookupOptions)) as EntryObject | ReadonlyArray<EntryObject>;

            // `Array.isArray` narrows a union to `T & unknown[]`, not to its array
            // member, so the element type comes from the cast rather than the guard.
            const resolvedAddresses: string[] = Array.isArray(meta)
                ? (meta as ReadonlyArray<EntryObject>).map((entry) => entry.address)
                : [(meta as EntryObject).address];

            if (Array.isArray(expectedAddresses) && !resolvedAddresses.some((address) => expectedAddresses.includes(address))) {
                return {
                    displayName: `${DISPLAY_NAME} ${host}`,
                    health: {
                        healthy: false,

                        message: `${DISPLAY_NAME} ${host} returned address ${resolvedAddresses.join(", ")} instead of ${expectedAddresses.join(", ")}.`,
                        timestamp: new Date().toISOString(),
                    },
                    meta: {
                        addresses: meta,
                        host,
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
                    addresses: meta,
                    host,
                },
            };
        } catch (error) {
            return {
                displayName: `${DISPLAY_NAME} ${host}`,
                health: {
                    healthy: false,
                    message: (error as Error).message,
                    timestamp: new Date().toISOString(),
                },
                meta: {
                    host,
                },
            };
        }
    };
};

export default dnsCheck;
