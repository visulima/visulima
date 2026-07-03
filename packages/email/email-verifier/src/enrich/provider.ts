import type { MxProviderInfo } from "@visulima/email-provider-mx";
import { classifyMxRecords } from "@visulima/email-provider-mx";

import type { MxCheckResult, MxRecord } from "../checks/mx";
import { checkMxRecords } from "../checks/mx";
import { extractDomain } from "../internal/address";
import type { Cache } from "../internal/cache";

/**
 * The enriched provider details for an email address.
 */
interface ProviderDetails {
    /** True when the resolving MX is a Secure Email Gateway (Proofpoint, Mimecast, …). */
    isSecureEmailGateway: boolean;
    /** The MX records the classification was derived from. */
    mxRecords: MxRecord[];
    /** The classified provider, or `undefined` when no MX matched a known provider. */
    provider?: MxProviderInfo;
}

/**
 * Options for provider enrichment.
 */
interface ProviderEnrichOptions {
    cache?: Cache<MxCheckResult>;
    ttl?: number;
}

/**
 * Resolves an email address's mailbox/SEG provider from its MX records.
 *
 * Looks up the domain's MX records, then classifies the highest-priority host
 * via `@visulima/email-provider-mx` — emailable's "SMTP Provider Details" plus
 * Secure-Email-Gateway detection.
 * @param email The email address to enrich.
 * @param options Caching options for the MX lookup.
 * @returns The provider details, including the MX records used.
 * @example
 * ```ts
 * import { enrichProvider } from "@visulima/email-verifier/enrich/provider";
 *
 * const details = await enrichProvider("user@gmail.com");
 * console.log(details.provider?.display); // "Google"
 * ```
 */
const enrichProvider = async (email: string, options: ProviderEnrichOptions = {}): Promise<ProviderDetails> => {
    const domain = extractDomain(email);

    if (!domain) {
        return { isSecureEmailGateway: false, mxRecords: [] };
    }

    const mxCheck = await checkMxRecords(domain, { cache: options.cache, fallbackToAddress: false, ttl: options.ttl });
    const mxRecords = mxCheck.records ?? [];

    if (mxRecords.length === 0) {
        return { isSecureEmailGateway: false, mxRecords };
    }

    const provider = classifyMxRecords(mxRecords);

    return {
        isSecureEmailGateway: provider?.type === "seg",
        mxRecords,
        provider,
    };
};

export type { MxProviderInfo } from "@visulima/email-provider-mx";
export type { ProviderDetails, ProviderEnrichOptions };
export { classifyMx, classifyMxRecords, isSecureEmailGateway } from "@visulima/email-provider-mx";
export { enrichProvider };
export default enrichProvider;
