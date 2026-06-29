import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Options accepted by the lookup helpers.
 */
interface FreeEmailOptions {
    /**
     * Domains that should never be treated as free, even if they appear in the
     * built-in list. Checked before the free list, with the same
     * wildcard/subdomain semantics (so `gmail.com` also excludes
     * `mail.gmail.com`). Useful as a runtime escape hatch for domains you host
     * yourself that happen to leak into upstream free-provider sources.
     */
    allowDomains?: Set<string>;

    /**
     * Additional free-provider domains to check on top of the built-in list.
     * These are matched with the same wildcard/subdomain semantics as the
     * built-in list (so a custom `my-free-mail.com` also matches
     * `sub.my-free-mail.com`).
     */
    customDomains?: Set<string>;
}

/**
 * Matches a trailing dot in a domain (e.g. a fully-qualified `example.com.`).
 * Hoisted to module scope so it is compiled once rather than per call.
 */
const TRAILING_DOT_REGEX = /\.$/;

/**
 * Cached Set of domain strings for O(1) lookup performance.
 *
 * Only the Set is retained long-term; the intermediate array produced while
 * loading is discarded so the list is not kept resident twice.
 */
let cachedDomainSet: Set<string> | undefined;

/**
 * Tracks whether the built-in list has been loaded successfully at least once.
 */
let listLoaded = false;

/**
 * Tracks whether the domains-load failure warning has already been emitted,
 * so the warning is surfaced once rather than on every call.
 */
let hasWarnedOnDomainsFailure = false;

const filename = fileURLToPath(import.meta.url);
const dirnamePath = dirname(filename);

/**
 * Reads and parses the generated `dist/domains.json` from disk (Node runtimes).
 * @returns Array of domain strings, or `undefined` if the file is missing/corrupt.
 */
const readDomainsFile = (): string[] | undefined => {
    try {
        const domainsPath = join(dirnamePath, "..", "dist", "domains.json");
        const domainsContent = readFileSync(domainsPath, "utf8");
        const parsed: unknown = JSON.parse(domainsContent);

        return Array.isArray(parsed) ? (parsed as string[]) : [];
    } catch (error) {
        // Surface the failure once so a broken install (missing/corrupted dist/domains.json)
        // is detectable, but stay resilient by returning undefined (caller decides the fallback).
        if (!hasWarnedOnDomainsFailure) {
            hasWarnedOnDomainsFailure = true;

            // eslint-disable-next-line no-console
            console.warn("[@visulima/free-email-domains] Failed to load dist/domains.json; free email detection is disabled.", error);
        }

        return undefined;
    }
};

/**
 * Gets a Set of all built-in free-provider domains for fast O(1) lookups.
 *
 * The Set is built lazily on first use and cached for the process lifetime.
 * On Node this reads `dist/domains.json`; in edge/browser/bundled runtimes call
 * `setDomains` (typically with the `@visulima/free-email-domains/domains`
 * array) before any lookup so no filesystem access is attempted.
 * @returns Set of domain strings (empty if the list could not be loaded).
 */
const getDomainSet = (): Set<string> => {
    if (cachedDomainSet === undefined) {
        const domains = readDomainsFile();

        if (domains === undefined) {
            // Do not cache the empty fallback so a later successful read (e.g. once
            // dist/domains.json is restored, or after setDomains) can populate it.
            return new Set<string>();
        }

        cachedDomainSet = new Set(domains);
        listLoaded = true;
    }

    return cachedDomainSet;
};

/**
 * Injects the free-domain list explicitly, bypassing the Node filesystem
 * loader entirely.
 *
 * Call this once at startup in edge/browser/bundled runtimes (Cloudflare Workers,
 * Next.js middleware/edge, Deno, etc.) where `node:fs` is unavailable or the dist
 * file path cannot be resolved. The recommended source is the statically
 * importable list:
 *
 * ```ts
 * import { setDomains } from "@visulima/free-email-domains";
 * import domains from "@visulima/free-email-domains/domains" with { type: "json" };
 *
 * setDomains(domains);
 * ```
 * @param domains Array of free-provider domain strings.
 */
const setDomains = (domains: ReadonlyArray<string>): void => {
    cachedDomainSet = new Set(domains);
    listLoaded = true;
    hasWarnedOnDomainsFailure = false;
};

/**
 * Eagerly loads the built-in free-provider list (Node runtimes).
 *
 * Calling this at process/module startup moves the synchronous read + parse of
 * the `dist/domains.json` file off the request hot path, so the first
 * `isFreeEmail` call no longer stalls the event loop mid-request. It is a thin
 * async wrapper around the same lazy loader, so calling it is optional and
 * idempotent.
 * @returns A promise that resolves once the list is loaded (or the load failed).
 */
const preload = async (): Promise<void> => {
    // The list lives in a single JSON file; building the Set is synchronous, but
    // exposing it as async lets callers await it during startup without blocking.
    await Promise.resolve();

    getDomainSet();
};

/**
 * Reports whether the built-in free-provider list is currently loaded.
 *
 * Returns `false` when the list has not been accessed yet, or when loading
 * failed (missing/corrupt `dist/domains.json`). Callers that gate behaviour on
 * free-provider detection can use this to detect the degraded state instead of
 * silently treating every address as non-free.
 * @returns True if the built-in list is loaded and non-degraded.
 */
const isListLoaded = (): boolean => listLoaded;

/**
 * Extracts and validates the domain from an email address.
 * @param email The email address to extract domain from.
 * @returns The normalized (lowercased, trimmed) domain string, or undefined if invalid.
 */
const extractDomain = (email: string): string | undefined => {
    if (!email || typeof email !== "string") {
        return undefined;
    }

    const normalizedEmail = email.toLowerCase().trim();
    const atIndex = normalizedEmail.lastIndexOf("@");

    if (atIndex === -1 || atIndex === 0 || atIndex === normalizedEmail.length - 1) {
        return undefined;
    }

    const domain = normalizedEmail.slice(atIndex + 1).replace(TRAILING_DOT_REGEX, "");

    return domain || undefined;
};

/**
 * Normalizes the options argument, accepting either the legacy set of
 * additional free domains or the richer options object.
 * @param options Either a Set of custom free domains or a `FreeEmailOptions` object.
 * @returns Normalized options.
 */
const normalizeOptions = (options?: Set<string> | FreeEmailOptions): FreeEmailOptions => {
    if (options instanceof Set) {
        return { customDomains: options };
    }

    return options ?? {};
};

/**
 * Checks if a domain (or any of its parent domains) is present in the given set.
 * Implements wildcard/subdomain matching, e.g. `mail.gmail.com` matches `gmail.com`.
 * @param normalizedDomain The already lowercased/trimmed domain.
 * @param domainParts The domain split on `.`.
 * @param set The set to match against.
 * @returns True if the domain or a parent domain is in the set.
 */
const matchesWithParents = (normalizedDomain: string, domainParts: string[], set: Set<string>): boolean => {
    if (set.has(normalizedDomain)) {
        return true;
    }

    for (let index = 1; index < domainParts.length; index += 1) {
        if (set.has(domainParts.slice(index).join("."))) {
            return true;
        }
    }

    return false;
};

/**
 * Checks if a bare domain belongs to a free email provider.
 *
 * Supports wildcard matching by checking parent domains (e.g.,
 * `mail.gmail.com` matches `gmail.com`) for the built-in list, custom domains,
 * and allowlisted domains alike.
 *
 * Useful when you already have a bare domain (from an MX lookup or a parsed
 * signup form) and do not want to fabricate an `x@domain` address.
 * @param domain The domain to check (case-insensitive).
 * @param options Either a Set of additional free domains or a `FreeEmailOptions` object.
 * @returns True if the domain is a free provider, false otherwise.
 */
const isFreeDomain = (domain: string, options?: Set<string> | FreeEmailOptions): boolean => {
    if (!domain || typeof domain !== "string") {
        return false;
    }

    const { allowDomains, customDomains } = normalizeOptions(options);

    const normalizedDomain = domain.toLowerCase().trim();
    const domainParts = normalizedDomain.split(".");

    // Allowlist wins: a domain (or any parent) on the allowlist is never treated as free.
    if (allowDomains && allowDomains.size > 0 && matchesWithParents(normalizedDomain, domainParts, allowDomains)) {
        return false;
    }

    // Custom domains use the same wildcard/subdomain semantics as the built-in list.
    if (customDomains && customDomains.size > 0 && matchesWithParents(normalizedDomain, domainParts, customDomains)) {
        return true;
    }

    return matchesWithParents(normalizedDomain, domainParts, getDomainSet());
};

/**
 * Checks if an email address is from a free email service.
 * @param email The email address to check.
 * @param options Either a Set of additional free domains, or a `FreeEmailOptions` object with `allowDomains`/`customDomains`.
 * @returns True if the email is from a free-provider domain, false otherwise.
 */
const isFreeEmail = (email: string, options?: Set<string> | FreeEmailOptions): boolean => {
    const domain = extractDomain(email);

    if (!domain) {
        return false;
    }

    return isFreeDomain(domain, options);
};

/**
 * Checks multiple email addresses at once.
 * @param emails Array of email addresses to check.
 * @param options Either a Set of additional free domains, or a `FreeEmailOptions` object with `allowDomains`/`customDomains`.
 * @returns Map of email to boolean indicating if it's a free-provider address.
 */
const areFreeEmails = (emails: string[], options?: Set<string> | FreeEmailOptions): Map<string, boolean> => {
    const results = new Map<string, boolean>();

    for (const email of emails) {
        results.set(email, isFreeEmail(email, options));
    }

    return results;
};

export type { FreeEmailOptions };
export { areFreeEmails, extractDomain, isFreeDomain, isFreeEmail, isListLoaded, preload, setDomains };
