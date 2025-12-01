import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);

/**
 * Cached domains data to avoid repeated processing.
 */
let cachedDomains: string[] | undefined;

/**
 * Cached Set of domain strings for O(1) lookup performance.
 */
let cachedDomainSet: Set<string> | undefined;

/**
 * Cached Set of whitelisted common email provider domains.
 */
let whitelistedDomains: Set<string> | undefined;

const filename = fileURLToPath(import.meta.url);
const dirnamePath = dirname(filename);

/**
 * Gets all domain strings from domains.json.
 * Caches the result for subsequent calls.
 * @returns Array of domain strings.
 */
const getDomains = (): string[] => {
    if (cachedDomains === undefined) {
        try {
            const domainsPath = join(dirnamePath, "..", "dist", "domains.json");

            const domainsContent = readFileSync(domainsPath, "utf8");
            const parsed = JSON.parse(domainsContent);

            cachedDomains = Array.isArray(parsed) ? (parsed as string[]) : [];
        } catch {
            cachedDomains = [];
        }
    }

    return cachedDomains;
};

/**
 * Gets a Set of all domain strings for fast O(1) lookups.
 * Caches the result for subsequent calls.
 * @returns Set of domain strings.
 */
const getDomainSet = (): Set<string> => {
    if (cachedDomainSet === undefined) {
        const domains = getDomains();

        cachedDomainSet = new Set(domains);
    }

    return cachedDomainSet;
};

/**
 * Gets a Set of whitelisted common email provider domains.
 * Caches the result for subsequent calls.
 * @returns Set of whitelisted domain strings.
 */
const getWhitelistedDomains = (): Set<string> => {
    if (whitelistedDomains === undefined) {
        try {
            // eslint-disable-next-line import/no-extraneous-dependencies -- Dev dependency used at runtime
            const commonProviders = require("email-providers/common.json") as string[];

            whitelistedDomains = Array.isArray(commonProviders) ? new Set(commonProviders.map((domain) => domain.toLowerCase().trim())) : new Set();
        } catch {
            whitelistedDomains = new Set();
        }
    }

    return whitelistedDomains;
};

/**
 * Checks if a domain is in the disposable email domains list.
 * Supports wildcard matching by checking parent domains (e.g., subdomain.33mail.com matches 33mail.com).
 * Common email providers are whitelisted and never considered disposable.
 * @param domain The domain to check (case-insensitive).
 * @param customDomains Optional set of additional disposable domains to check.
 * @returns True if the domain is disposable, false otherwise.
 */
const isDisposableDomain = (domain: string, customDomains?: Set<string>): boolean => {
    if (!domain || typeof domain !== "string") {
        return false;
    }

    const normalizedDomain = domain.toLowerCase().trim();
    const domainParts = normalizedDomain.split(".");

    // Check whitelist first - common email providers are never disposable
    const whitelist = getWhitelistedDomains();

    if (whitelist.has(normalizedDomain)) {
        return false;
    }

    // Check parent domains against whitelist
    for (let i = 1; i < domainParts.length; i += 1) {
        const parentDomain = domainParts.slice(i).join(".");

        if (whitelist.has(parentDomain)) {
            return false;
        }
    }

    if (customDomains && customDomains.has(normalizedDomain)) {
        return true;
    }

    // Use Set for O(1) lookup performance
    const domainSet = getDomainSet();

    // Check exact match first
    if (domainSet.has(normalizedDomain)) {
        return true;
    }

    // Check parent domains for wildcard matching (e.g., subdomain.33mail.com should match 33mail.com)
    for (let i = 1; i < domainParts.length; i += 1) {
        const parentDomain = domainParts.slice(i).join(".");

        if (domainSet.has(parentDomain)) {
            return true;
        }
    }

    return false;
};

/**
 * Checks if a domain is whitelisted (common email provider).
 * @param normalizedDomain The normalized domain to check.
 * @param domainParts The domain parts array.
 * @returns True if the domain is whitelisted.
 */
const isWhitelistedDomain = (normalizedDomain: string, domainParts: string[]): boolean => {
    const whitelist = getWhitelistedDomains();

    if (whitelist.has(normalizedDomain)) {
        return true;
    }

    return domainParts.slice(1).some((_, index) => {
        const parentDomain = domainParts.slice(index + 1).join(".");

        return whitelist.has(parentDomain);
    });
};

/**
 * Checks if a domain is in the disposable set (excluding whitelist).
 * @param normalizedDomain The normalized domain to check.
 * @param domainParts The domain parts array.
 * @param domainSet The set of disposable domains.
 * @param customDomains Optional set of additional disposable domains.
 * @returns True if the domain is disposable.
 */
const checkDisposableDomain = (normalizedDomain: string, domainParts: string[], domainSet: Set<string>, customDomains?: Set<string>): boolean => {
    if (customDomains && customDomains.has(normalizedDomain)) {
        return true;
    }

    if (domainSet.has(normalizedDomain)) {
        return true;
    }

    return domainParts.slice(1).some((_, index) => {
        const parentDomain = domainParts.slice(index + 1).join(".");

        return domainSet.has(parentDomain);
    });
};

/**
 * Checks if an email address is from a disposable email service.
 * @param email The email address to check.
 * @param customDomains Optional set of additional disposable domains to check.
 * @returns True if the email is from a disposable domain, false otherwise.
 */
const isDisposableEmail = (email: string, customDomains?: Set<string>): boolean => {
    if (!email || typeof email !== "string") {
        return false;
    }

    const normalizedEmail = email.toLowerCase().trim();
    const atIndex = normalizedEmail.indexOf("@");

    if (atIndex === -1 || atIndex === 0 || atIndex === normalizedEmail.length - 1) {
        return false;
    }

    const domain = normalizedEmail.slice(atIndex + 1);

    if (!domain) {
        return false;
    }

    return isDisposableDomain(domain, customDomains);
};

/**
 * Checks multiple email addresses at once.
 * @param emails Array of email addresses to check.
 * @param customDomains Optional set of additional disposable domains to check.
 * @returns Map of email to boolean indicating if it's disposable.
 */
const areDisposableEmails = (emails: string[], customDomains?: Set<string>): Map<string, boolean> => {
    const results = new Map<string, boolean>();
    const domainSet = getDomainSet();

    for (const email of emails) {
        if (!email || typeof email !== "string") {
            results.set(email, false);

            continue;
        }

        const normalizedEmail = email.toLowerCase().trim();
        const atIndex = normalizedEmail.indexOf("@");

        if (atIndex === -1 || atIndex === 0 || atIndex === normalizedEmail.length - 1) {
            results.set(email, false);

            continue;
        }

        const domain = normalizedEmail.slice(atIndex + 1);

        if (!domain) {
            results.set(email, false);

            continue;
        }

        const normalizedDomain = domain.toLowerCase().trim();
        const domainParts = normalizedDomain.split(".");

        // Check whitelist first - common email providers are never disposable
        if (isWhitelistedDomain(normalizedDomain, domainParts)) {
            results.set(email, false);

            continue;
        }

        const isDisposable = checkDisposableDomain(normalizedDomain, domainParts, domainSet, customDomains);

        results.set(email, isDisposable);
    }

    return results;
};

export { areDisposableEmails, isDisposableEmail };
