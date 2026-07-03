/**
 * Deprecation marshall.
 *
 * Flags packages whose resolved version carries npm's `deprecated` flag.
 * npm sets `versions[v].deprecated` to a non-empty string when a publisher
 * runs `npm deprecate` — it usually points at a security advisory, an
 * abandoned line, or a "use X instead" migration note. Installing a
 * deprecated version silently is a recurring supply-chain footgun, so this
 * is an **error**: the install is blocked until the user opts past it.
 *
 * The resolved version is preferred; when it is absent from the packument
 * (range that no longer resolves to a published version) we fall back to
 * the latest published version so a wholesale package-level deprecation
 * still surfaces.
 */

import { DEFAULT_MARSHALL_CONCURRENCY, mapWithConcurrency } from "./concurrency";
import type { Packument } from "./packument";
import { getPackument } from "./packument";
import { isMarshallDisabled } from "./registry";

export interface DeprecationFinding {
    packageName: string;
    /** The publisher-supplied deprecation message — sanitized, trimmed, length-capped. */
    reason: string;
    /** The version the message was read from (resolved, or latest fallback). */
    version: string;
}

export interface RunDeprecationMarshallOptions {
    /** Package names to skip. */
    allowlist?: string[];
    /** Max packages inspected in parallel. Defaults to {@link DEFAULT_MARSHALL_CONCURRENCY}. */
    concurrency?: number;
    workspaceRoot?: string;
}

/** Longest deprecation reason we render — npm truncates at ~512; terminal sanity caps lower. */
const MAX_REASON_LENGTH = 300;

/**
 * The `deprecated` string is publisher-controlled free text pulled
 * straight off the registry — i.e. attacker-controlled for exactly the
 * malicious packages this marshall exists to flag. `MarshallFinding`
 * is rendered to the terminal as a single unsanitized line, so strip C0/C1
 * control characters (ANSI escapes, CR/LF), collapse whitespace, and cap
 * the length before it ever reaches the formatter.
 */
const sanitizeReason = (raw: string): string => {
    const stripped = raw
        .replaceAll(/\p{Cc}/gu, " ")
        .replaceAll(/\s+/gu, " ")
        .trim();

    return stripped.length > MAX_REASON_LENGTH ? `${stripped.slice(0, MAX_REASON_LENGTH - 1)}…` : stripped;
};

const resolveLatestVersion = (packument: Packument): string | undefined => {
    const tag = packument["dist-tags"]?.latest;

    if (tag !== undefined && Object.hasOwn(packument.versions, tag)) {
        return tag;
    }

    return Object.keys(packument.versions).at(-1);
};

export const runDeprecationMarshall = async (
    packages: { name: string; version: string }[],
    options: RunDeprecationMarshallOptions = {},
): Promise<DeprecationFinding[]> => {
    if (isMarshallDisabled("deprecation")) {
        return [];
    }

    const allowlist = new Set(options.allowlist);
    const concurrency = options.concurrency ?? DEFAULT_MARSHALL_CONCURRENCY;

    const perPackage = await mapWithConcurrency(packages, concurrency, async ({ name, version }): Promise<DeprecationFinding | undefined> => {
        if (allowlist.has(name)) {
            return undefined;
        }

        const packument = await getPackument(name, { workspaceRoot: options.workspaceRoot });

        if (packument === undefined) {
            return undefined;
        }

        const resolvedVersion = Object.hasOwn(packument.versions, version) ? version : resolveLatestVersion(packument);

        if (resolvedVersion === undefined) {
            return undefined;
        }

        const entry = packument.versions[resolvedVersion];

        if (entry === undefined) {
            return undefined;
        }

        const reason = typeof entry.deprecated === "string" ? sanitizeReason(entry.deprecated) : "";

        if (reason === "") {
            return undefined;
        }

        return { packageName: name, reason, version: resolvedVersion };
    });

    return perPackage.filter((entry): entry is DeprecationFinding => entry !== undefined);
};
