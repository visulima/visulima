import disposableDomains from "disposable-domains";
import wildcardDomains from "disposable-domains/wildcard.json" with { type: "json" };

/**
 * Cached disposable domains data to avoid repeated processing.
 */
let cachedDisposableDomains: string[] | undefined;
let cachedWildcardDomains: string[] | undefined;

/**
 * Gets disposable domains data from the disposable-domains package.
 * Caches the result for subsequent calls.
 * @returns Object containing disposable and wildcard domains arrays.
 */
const getDisposableDomains = (): { disposable: string[]; wildcard: string[] } => {
    // Return cached data if available
    if (cachedDisposableDomains !== undefined && cachedWildcardDomains !== undefined) {
        return {
            disposable: cachedDisposableDomains,
            wildcard: cachedWildcardDomains,
        };
    }

    // Process and cache the domains
    cachedDisposableDomains = Array.isArray(disposableDomains) ? disposableDomains : [];
    cachedWildcardDomains = Array.isArray(wildcardDomains) ? wildcardDomains : [];

    return {
        disposable: cachedDisposableDomains,
        wildcard: cachedWildcardDomains,
    };
};

/**
 * Checks if an email address is from a disposable email service.
 * Requires the 'disposable-domains' package to be installed as a peer dependency.
 * @param email The email address to check.
 * @param customDomains Optional set of additional disposable domains to check.
 * @returns True if the email is from a disposable email service, false otherwise.
 * @example
 * ```ts
 * import { isDisposableEmail } from "@visulima/email/validation/is-disposable-email";
 *
 * if (isDisposableEmail("user@mailinator.com")) {
 *     console.log("Disposable email detected!");
 * }
 * ```
 */
const isDisposableEmail = (email: string, customDomains?: Set<string>): boolean => {
    if (!email || typeof email !== "string") {
        return false;
    }

    const normalizedEmail = email.toLowerCase().trim();
    const atIndex = normalizedEmail.indexOf("@");

    // Must have @ symbol and local part before @
    if (atIndex === -1 || atIndex === 0 || atIndex === normalizedEmail.length - 1) {
        return false;
    }

    const domain = normalizedEmail.slice(atIndex + 1);

    if (!domain) {
        return false;
    }

    // Check custom domains first if provided
    if (customDomains && customDomains.has(domain)) {
        return true;
    }

    // Get disposable domains (cached)
    const { disposable: disposableDomainsList, wildcard: wildcardDomainsList } = getDisposableDomains();

    // Check exact domain match
    if (disposableDomainsList.includes(domain)) {
        return true;
    }

    // Check wildcard domains (e.g., *.33mail.com matches subdomain.33mail.com)
    if (wildcardDomainsList) {
        for (const wildcardDomain of wildcardDomainsList) {
            // Remove the leading *.
            const baseDomain = wildcardDomain.replace(/^\*\./, "");

            // Check if the domain ends with the base domain
            if (domain === baseDomain || domain.endsWith(`.${baseDomain}`)) {
                return true;
            }
        }
    }

    return false;
};

export default isDisposableEmail;
