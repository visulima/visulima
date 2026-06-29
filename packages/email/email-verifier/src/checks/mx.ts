import { resolve4, resolve6, resolveMx } from "node:dns/promises";

import type { Cache } from "../internal/cache";

/**
 * MX record information.
 */
interface MxRecord {
    exchange: string;
    priority: number;
}

/**
 * How the domain's mail-acceptance was established.
 *
 * - `mx`: the domain published MX records.
 * - `address`: the domain has no MX but resolves to an A/AAAA record, so by RFC 5321 §5.1 the address itself is treated as an implicit MX.
 * - `none`: neither MX nor address records exist.
 */
type MxResolution = "address" | "mx" | "none";

/**
 * Result of an MX/domain check.
 */
interface MxCheckResult {
    /** True when the domain itself resolves but publishes no MX records. */
    domainResolves: boolean;
    error?: string;
    records?: MxRecord[];
    resolvedVia: MxResolution;
    /** True when the domain can accept mail (has MX or A/AAAA records). */
    valid: boolean;
}

/**
 * Options for MX record checking.
 */
interface MxCheckOptions {
    cache?: Cache<MxCheckResult>;

    /**
     * When true (the default), a domain with no MX records but a resolvable
     * A/AAAA record is still considered able to accept mail (implicit MX).
     */
    fallbackToAddress?: boolean;
    ttl?: number;
}

const hasAddressRecord = async (domain: string): Promise<boolean> => {
    try {
        const v4 = await resolve4(domain);

        if (v4.length > 0) {
            return true;
        }
    } catch {
        // fall through to AAAA
    }

    try {
        const v6 = await resolve6(domain);

        return v6.length > 0;
    } catch {
        return false;
    }
};

/**
 * Builds the implicit-MX result for a domain that has no MX records but does
 * resolve to an A/AAAA address. Per RFC 5321 §5.1 the domain itself acts as the
 * mail exchanger, so we synthesize a priority-0 MX record pointing at the bare
 * domain. This lets downstream provider classification and the SMTP probe treat
 * the implicit MX exactly like a published one (they gate on `records.length`),
 * while `resolvedVia: "address"` keeps the implicit case distinguishable.
 * @param domain The domain that resolved via A/AAAA.
 * @returns The implicit-MX check result.
 */
const buildAddressResult = (domain: string): MxCheckResult => {
    return {
        domainResolves: true,
        records: [{ exchange: domain, priority: 0 }],
        resolvedVia: "address",
        valid: true,
    };
};

const resolveDomain = async (domain: string, fallbackToAddress: boolean): Promise<MxCheckResult> => {
    try {
        const records = await resolveMx(domain);
        const mxRecords: MxRecord[] = records.map((record) => {
            return { exchange: record.exchange, priority: record.priority };
        });

        if (mxRecords.length > 0) {
            return {
                domainResolves: true,
                records: mxRecords.toSorted((a, b) => a.priority - b.priority),
                resolvedVia: "mx",
                valid: true,
            };
        }

        if (fallbackToAddress) {
            const hasAddress = await hasAddressRecord(domain);

            if (hasAddress) {
                return buildAddressResult(domain);
            }
        }

        return { domainResolves: false, records: [], resolvedVia: "none", valid: false };
    } catch (error) {
        // resolveMx throws ENODATA/ENOTFOUND when there are no MX records; try the
        // address fallback before declaring the domain undeliverable.
        if (fallbackToAddress) {
            const hasAddress = await hasAddressRecord(domain);

            if (hasAddress) {
                return buildAddressResult(domain);
            }
        }

        return {
            domainResolves: false,
            error: error instanceof Error ? error.message : String(error),
            resolvedVia: "none",
            valid: false,
        };
    }
};

/**
 * Checks MX records for a domain, with an optional A/AAAA fallback.
 *
 * Distinguishes three states emailable separates as "MX Record Detection" and
 * "Domain Validation": records present (`mx`), no MX but the domain resolves
 * (`address`, implicit MX), and nothing resolves (`none`).
 * @param domain The domain to check.
 * @param options Options including caching and the address fallback toggle.
 * @returns The MX/domain check result.
 * @example
 * ```ts
 * import { checkMxRecords } from "@visulima/email-verifier/checks/mx";
 *
 * const result = await checkMxRecords("example.com");
 * if (result.valid) {
 *     console.log(result.resolvedVia, result.records);
 * }
 * ```
 */
const checkMxRecords = async (domain: string, options: MxCheckOptions = {}): Promise<MxCheckResult> => {
    const { fallbackToAddress = true } = options;
    const ttl = options.ttl ?? 3_600_000;
    // The address fallback changes the result for an MX-less domain, so it must
    // be part of the key — otherwise a `fallbackToAddress:false` caller could
    // read a cached `fallbackToAddress:true` result it explicitly excluded.
    const cacheKey = `${domain}:${String(fallbackToAddress)}`;

    if (options.cache) {
        const cached = await options.cache.get(cacheKey);

        if (cached !== undefined) {
            return cached;
        }
    }

    const result = await resolveDomain(domain, fallbackToAddress);

    if (options.cache) {
        await options.cache.set(cacheKey, result, ttl);
    }

    return result;
};

export type { Cache, InMemoryCache } from "../internal/cache";
export type { MxCheckOptions, MxCheckResult, MxRecord, MxResolution };
export { checkMxRecords };
export default checkMxRecords;
