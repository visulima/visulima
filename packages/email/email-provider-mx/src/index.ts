import type { MxProviderEntry, MxProviderType } from "./data";
import { MX_PROVIDERS } from "./data";

/**
 * The classification of a single MX host, without the raw match patterns.
 */
interface MxProviderInfo {
    /** Human-friendly label for display, e.g. `"Google Workspace"`. */
    display: string;

    /** Stable provider identifier, e.g. `"google"`. */
    provider: string;

    /** Whether the host is a mailbox host, free consumer provider, or SEG. */
    type: MxProviderType;
}

/**
 * A single MX record as returned by `dns.resolveMx` (Node) or equivalent DNS
 * libraries.
 */
interface MxRecord {
    /** The mail exchanger hostname, e.g. `"aspmx.l.google.com"`. */
    exchange: string;

    /** The record priority/preference; lower wins. */
    priority: number;
}

interface PatternIndexEntry {
    info: MxProviderInfo;
    pattern: string;
}

/**
 * Flattened `{ pattern -> info }` index, sorted by pattern length descending so
 * the most specific (longest) suffix wins. For example
 * `mail.protection.outlook.com` is tried before `outlook.com`.
 */
const PATTERN_INDEX: PatternIndexEntry[] = MX_PROVIDERS.flatMap((entry: MxProviderEntry): PatternIndexEntry[] =>
    entry.patterns.map((pattern: string): PatternIndexEntry => {
        return {
            info: { display: entry.display, provider: entry.provider, type: entry.type },
            pattern: pattern.toLowerCase(),
        };
    }),
).toSorted((a: PatternIndexEntry, b: PatternIndexEntry): number => b.pattern.length - a.pattern.length);

/**
 * Matches a trailing dot in a host (e.g. a fully-qualified `aspmx.l.google.com.`).
 * Hoisted to module scope so it is compiled once rather than per call.
 */
const TRAILING_DOT_REGEX = /\.$/;

/**
 * Normalizes an MX host for comparison: lowercased, trimmed, trailing dot removed.
 * @param mxHost The raw MX hostname.
 * @returns The normalized hostname.
 */
const normalizeHost = (mxHost: string): string => mxHost.toLowerCase().trim().replace(TRAILING_DOT_REGEX, "");

/**
 * Checks whether `host` equals `pattern` or ends with `.pattern`, so matching
 * only happens on a dot boundary (so `notgoogle.com` does not match `google.com`).
 * @param host The already-normalized host.
 * @param pattern The already-normalized registrable suffix.
 * @returns True if the host is the pattern or a subdomain of it.
 */
const matchesSuffix = (host: string, pattern: string): boolean => host === pattern || host.endsWith(`.${pattern}`);

/**
 * Classifies a single MX hostname into the mail provider behind it.
 *
 * The host is normalized (lowercased, trimmed, trailing dot stripped) and
 * matched against the most specific (longest) known registrable suffix on a dot
 * boundary. Unknown hosts return `undefined`.
 * @example
 * ```ts
 * import { classifyMx } from "@visulima/email-provider-mx";
 *
 * classifyMx("aspmx.l.google.com");
 * // → { provider: "google", type: "mailbox", display: "Google Workspace" }
 *
 * classifyMx("mx0a-00000000.pphosted.com");
 * // → { provider: "proofpoint", type: "seg", display: "Proofpoint" }
 *
 * classifyMx("mail.example.com"); // → undefined
 * ```
 * @param mxHost The MX hostname (e.g. the `exchange` field of a DNS MX record).
 * @returns The provider info, or `undefined` if the host is not recognized.
 */
const classifyMx = (mxHost: string): MxProviderInfo | undefined => {
    if (!mxHost || typeof mxHost !== "string") {
        return undefined;
    }

    const host = normalizeHost(mxHost);

    if (!host) {
        return undefined;
    }

    for (const { info, pattern } of PATTERN_INDEX) {
        if (matchesSuffix(host, pattern)) {
            // Return a copy so callers cannot mutate the shared index entry.
            return { ...info };
        }
    }

    return undefined;
};

/**
 * Classifies a set of MX records, returning the provider of the primary
 * (lowest-priority) record that is recognized.
 *
 * Records are sorted by ascending priority and the first one that classifies is
 * returned. Secure Email Gateways are typically published as the primary
 * (lowest-priority) MX, so this surfaces the gateway in front of the mailbox
 * host — usually the answer you want.
 * @example
 * ```ts
 * import { classifyMxRecords } from "@visulima/email-provider-mx";
 *
 * classifyMxRecords([
 *     { exchange: "alt1.aspmx.l.google.com", priority: 20 },
 *     { exchange: "aspmx.l.google.com", priority: 10 },
 * ]);
 * // → { provider: "google", type: "mailbox", display: "Google Workspace" }
 * ```
 * @param records The MX records to classify (e.g. from `dns.resolveMx`).
 * @returns The provider info of the first recognized record by priority, or `undefined`.
 */
const classifyMxRecords = (records: MxRecord[]): MxProviderInfo | undefined => {
    if (!Array.isArray(records) || records.length === 0) {
        return undefined;
    }

    const sorted = records.toSorted((a: MxRecord, b: MxRecord): number => a.priority - b.priority);

    for (const record of sorted) {
        const info = classifyMx(record.exchange);

        if (info) {
            return info;
        }
    }

    return undefined;
};

/**
 * Reports whether an MX hostname belongs to a Secure Email Gateway (SEG) such
 * as Proofpoint, Mimecast, Barracuda, Cisco, Trend Micro, Sophos, Forcepoint,
 * Symantec/MessageLabs, or Cloudflare Area 1.
 * @example
 * ```ts
 * import { isSecureEmailGateway } from "@visulima/email-provider-mx";
 *
 * isSecureEmailGateway("mx0a-00000000.pphosted.com"); // → true
 * isSecureEmailGateway("aspmx.l.google.com"); // → false
 * ```
 * @param mxHost The MX hostname.
 * @returns True if the host is a known SEG.
 */
const isSecureEmailGateway = (mxHost: string): boolean => classifyMx(mxHost)?.type === "seg";

export type { MxProviderEntry, MxProviderType } from "./data";
export type { MxProviderInfo, MxRecord };
export { MX_PROVIDERS } from "./data";
export { classifyMx, classifyMxRecords, isSecureEmailGateway };
