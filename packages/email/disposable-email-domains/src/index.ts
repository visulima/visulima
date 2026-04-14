import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Cached domains data to avoid repeated processing.
 */
let cachedDomains: string[] | undefined;

/**
 * Cached Set of domain strings for O(1) lookup performance.
 */
let cachedDomainSet: Set<string> | undefined;

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
 * Extracts and validates the domain from an email address.
 * @param email The email address to extract domain from.
 * @returns The normalized domain string, or undefined if invalid.
 */
const extractDomain = (email: string): string | undefined => {
    if (!email || typeof email !== "string") {
        return undefined;
    }

    const normalizedEmail = email.toLowerCase().trim();
    const atIndex = normalizedEmail.indexOf("@");

    if (atIndex === -1 || atIndex === 0 || atIndex === normalizedEmail.length - 1) {
        return undefined;
    }

    const domain = normalizedEmail.slice(atIndex + 1);

    return domain || undefined;
};

/**
 * Checks if a domain is in the disposable email domains list.
 * Supports wildcard matching by checking parent domains (e.g., subdomain.33mail.com matches 33mail.com).
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

    if (customDomains?.has(normalizedDomain)) {
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
 * Checks if an email address is from a disposable email service.
 * @param email The email address to check.
 * @param customDomains Optional set of additional disposable domains to check.
 * @returns True if the email is from a disposable domain, false otherwise.
 */
export const isDisposableEmail = (email: string, customDomains?: Set<string>): boolean => {
    const domain = extractDomain(email);

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
export const areDisposableEmails = (emails: string[], customDomains?: Set<string>): Map<string, boolean> => {
    const results = new Map<string, boolean>();

    for (const email of emails) {
        results.set(email, isDisposableEmail(email, customDomains));
    }

    return results;
};
