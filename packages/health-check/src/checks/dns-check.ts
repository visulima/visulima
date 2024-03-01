import type { EntryObject, LookupOptions, Options } from "cacheable-lookup";
import CacheableLookup from "cacheable-lookup";

import type { Checker } from "../types";

const DISPLAY_NAME = "DNS check for";

interface DnsOptions extends Options {
    family?: "all" | 4 | 6;
    hints?: number;
}

/**
 * Register the `dns` checker to ensure that a domain is reachable.
 */
const dnsCheck =
    (host: string, expectedAddresses?: string[], options?: DnsOptions): Checker =>
    async () => {
        const { family = "all", hints, ...config } = options ?? {};

        // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-assignment
        const cacheable = new CacheableLookup(config);

        try {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-assignment
            const meta: EntryObject = await cacheable.lookupAsync(host.replace(/^https?:\/\//, ""), {
                hints,
                ...(family === "all" ? { all: true } : { family }),
            } as LookupOptions);

            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-argument
            if (Array.isArray(expectedAddresses) && !expectedAddresses.includes(meta.address)) {
                return {
                    displayName: `${DISPLAY_NAME} ${host}`,
                    health: {
                        healthy: false,
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                        message: `${DISPLAY_NAME} ${host} returned address ${meta.address} instead of ${expectedAddresses.join(", ")}.`,
                        timestamp: new Date().toISOString(),
                    },
                    meta: {
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
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
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
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

export default dnsCheck;
