import { resolveMx } from "node:dns/promises";

import type { Cache } from "../cache";

export type { Cache, InMemoryCache } from "../cache";

/**
 * MX record information.
 */
export interface MxRecord {
    exchange: string;
    priority: number;
}

/**
 * Result of MX record check.
 */
export interface MxCheckResult {
    error?: string;
    records?: MxRecord[];
    valid: boolean;
}

/**
 * Options for MX record checking.
 */
export interface MxCheckOptions {
    cache?: Cache<MxCheckResult>;
    ttl?: number;
}

/**
 * Checks MX records for a domain.
 * @param domain The domain to check MX records for.
 * @param options Options for MX record checking, including caching.
 * @returns Result containing MX records or error.
 * @example
 * ```ts
 * import { checkMxRecords } from "@visulima/email/validation/check-mx-records";
 * import { InMemoryCache } from "@visulima/email/utils/cache";
 *
 * const cache = new InMemoryCache();
 * const result = await checkMxRecords("example.com", { cache });
 * if (result.valid) {
 *     console.log("MX records:", result.records);
 * }
 * ```
 */
export const checkMxRecords = async (domain: string, options: MxCheckOptions = {}): Promise<MxCheckResult> => {
    const ttl = options.ttl ?? 3_600_000; // Default 1 hour

    if (options.cache) {
        const cached = await options.cache.get(domain);

        if (cached !== undefined) {
            return cached;
        }
    }

    try {
        const records = await resolveMx(domain);
        const mxRecords: MxRecord[] = records.map((record) => {
            return {
                exchange: record.exchange,
                priority: record.priority,
            };
        });

        const result: MxCheckResult = {
            records: mxRecords.toSorted((a, b) => a.priority - b.priority),
            valid: mxRecords.length > 0,
        };

        if (options.cache) {
            await options.cache.set(domain, result, ttl);
        }

        return result;
    } catch (error) {
        const result: MxCheckResult = {
            error: error instanceof Error ? error.message : String(error),
            valid: false,
        };

        if (options.cache) {
            await options.cache.set(domain, result, ttl);
        }

        return result;
    }
};
