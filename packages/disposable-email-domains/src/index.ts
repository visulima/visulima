import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import repositoriesConfig from "../scripts/config/repositories.json" with { type: "json" };

/**
 * Cached domains data to avoid repeated processing.
 */
let cachedDomains: DomainEntry[] | undefined;

/**
 * Cached Set of domain strings for O(1) lookup performance.
 */
let cachedDomainSet: Set<string> | undefined;

const filename = fileURLToPath(import.meta.url);
const dirnamePath = dirname(filename);

/**
 * Gets all domain entries from domains.json.
 * Caches the result for subsequent calls.
 * @returns Array of domain entries.
 */
const getDomains = (): DomainEntry[] => {
    if (cachedDomains === undefined) {
        try {
            const domainsPath = join(dirnamePath, "..", "dist", "domains.json");

            const domainsContent = readFileSync(domainsPath, "utf8");
            const parsed = JSON.parse(domainsContent) as DomainEntry[];

            cachedDomains = Array.isArray(parsed) ? parsed : [];
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

        cachedDomainSet = new Set(domains.map((entry) => entry.domain));
    }

    return cachedDomainSet;
};

/**
 * Repository configuration from repositories.json.
 */
export interface RepositoryConfig {
    /**
     * Blocklist files to process.
     */
    blocklist_files?: string[];

    /**
     * Repository description.
     */
    description?: string;

    /**
     * The repository name.
     */
    name: string;

    /**
     * Priority level (lower is higher priority).
     */
    priority?: number;

    /**
     * The repository type.
     */
    type: string;

    /**
     * The repository URL.
     */
    url: string;
}

/**
 * Domain entry structure from domains.json.
 */
export interface DomainEntry {
    /**
     * The disposable email domain.
     */
    domain: string;

    /**
     * Date when the domain was first seen.
     */
    firstSeen: string;

    /**
     * Date when the domain was last seen.
     */
    lastSeen: string;

    /**
     * Array of source repository URLs that contributed this domain.
     */
    sources: string[];
}

/**
 * Type representing valid repository names from the config.
 */
export type RepositoryName = (typeof repositoriesConfig)[number]["name"];

/**
 * Type representing valid repository URLs from the config.
 */
export type RepositoryUrl = (typeof repositoriesConfig)[number]["url"];

/**
 * Type representing a valid source identifier (name or URL).
 */
export type RepositorySource = RepositoryName | RepositoryUrl;

/**
 * Gets all disposable email domains as a simple array of strings.
 * @returns Array of domain strings.
 */
export const getDomainList = (): string[] => getDomains().map((entry) => entry.domain);

/**
 * Checks if a domain is in the disposable email domains list.
 * @param domain The domain to check (case-insensitive).
 * @param customDomains Optional set of additional disposable domains to check.
 * @returns True if the domain is disposable, false otherwise.
 */
export const isDisposableDomain = (domain: string, customDomains?: Set<string>): boolean => {
    if (!domain || typeof domain !== "string") {
        return false;
    }

    const normalizedDomain = domain.toLowerCase().trim();

    // Check custom domains first if provided
    if (customDomains && customDomains.has(normalizedDomain)) {
        return true;
    }

    // Use Set for O(1) lookup performance
    const domainSet = getDomainSet();

    return domainSet.has(normalizedDomain);
};

/**
 * Gets metadata for a specific domain.
 * @param domain The domain to look up (case-insensitive).
 * @returns Domain entry if found, undefined otherwise.
 */
export const getDomainMetadata = (domain: string): DomainEntry | undefined => {
    if (!domain || typeof domain !== "string") {
        return undefined;
    }

    const normalizedDomain = domain.toLowerCase().trim();
    const domains = getDomains();

    return domains.find((entry) => entry.domain === normalizedDomain);
};

/**
 * Checks if an email address is from a disposable email service.
 * @param email The email address to check.
 * @param customDomains Optional set of additional disposable domains to check.
 * @returns True if the email is from a disposable domain, false otherwise.
 */
export const isDisposableEmail = (email: string, customDomains?: Set<string>): boolean => {
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
 * Searches for domains matching a pattern.
 * @param pattern Search pattern (case-insensitive, supports partial matches).
 * @returns Array of matching domain entries.
 */
export const searchDomains = (pattern: string): DomainEntry[] => {
    if (!pattern || typeof pattern !== "string") {
        return [];
    }

    const normalizedPattern = pattern.toLowerCase().trim();
    const domains = getDomains();

    return domains.filter((entry) => entry.domain.includes(normalizedPattern));
};

/**
 * Gets the total count of disposable email domains.
 * @returns Number of domains in the list.
 */
export const getDomainCount = (): number => getDomains().length;

/**
 * Gets all domain entries with full metadata.
 * @returns Array of all domain entries.
 */
export const getAllDomains = (): DomainEntry[] => [...getDomains()];

/**
 * Gets domains that were seen from a specific source.
 * @param source The source repository name or URL to filter by.
 * @returns Array of domain entries from the specified source.
 */
export const getDomainsBySource = (source: RepositorySource): DomainEntry[] => {
    if (!source || typeof source !== "string") {
        return [];
    }

    const normalizedSource = source.toLowerCase().trim();
    const domains = getDomains();

    // Find repository if source matches a repository name or URL
    const repository = repositoriesConfig.find((repo) => repo.name.toLowerCase() === normalizedSource || repo.url.toLowerCase() === normalizedSource);

    // If repository found, match against its URL (sources are stored as URLs)
    // Otherwise, do a partial match for flexibility
    if (repository) {
        const searchUrl = repository.url.toLowerCase();

        return domains.filter((entry) => entry.sources.some((s) => s.toLowerCase() === searchUrl));
    }

    return domains.filter((entry) => entry.sources.some((s) => s.toLowerCase().includes(normalizedSource)));
};

/**
 * Statistics about the disposable email domains.
 */
export interface DomainStatistics {
    /**
     * Date range of when domains were first seen.
     */
    dateRange: {
        /**
         * Earliest first seen date.
         */
        earliest: string | undefined;

        /**
         * Latest first seen date.
         */
        latest: string | undefined;
    };

    /**
     * Count of domains per source.
     */
    domainsPerSource: Record<string, number>;

    /**
     * Total number of domains.
     */
    totalDomains: number;

    /**
     * Number of unique sources.
     */
    uniqueSources: number;
}

/**
 * Gets statistics about the disposable email domains.
 * @returns Statistics object with domain counts and metadata.
 */
export const getStatistics = (): DomainStatistics => {
    const domains = getDomains();
    const sourceCounts: Record<string, number> = {};
    const firstSeenDates: string[] = [];

    for (const entry of domains) {
        // Count domains per source
        for (const source of entry.sources) {
            sourceCounts[source] = (sourceCounts[source] ?? 0) + 1;
        }

        // Collect first seen dates
        if (entry.firstSeen) {
            firstSeenDates.push(entry.firstSeen);
        }
    }

    // Sort dates to find earliest and latest
    const sortedDates = firstSeenDates.toSorted();

    return {
        dateRange: {
            earliest: sortedDates[0],
            latest: sortedDates[sortedDates.length - 1],
        },
        domainsPerSource: sourceCounts,
        totalDomains: domains.length,
        uniqueSources: Object.keys(sourceCounts).length,
    };
};

/**
 * Checks multiple domains at once.
 * @param domains Array of domains to check.
 * @param customDomains Optional set of additional disposable domains to check.
 * @returns Map of domain to boolean indicating if it's disposable.
 */
export const batchCheckDomains = (domains: string[], customDomains?: Set<string>): Map<string, boolean> => {
    const results = new Map<string, boolean>();
    const domainSet = getDomainSet();

    for (const domain of domains) {
        if (!domain || typeof domain !== "string") {
            results.set(domain, false);

            continue;
        }

        const normalizedDomain = domain.toLowerCase().trim();

        // Check custom domains first if provided
        if (customDomains && customDomains.has(normalizedDomain)) {
            results.set(domain, true);

            continue;
        }

        results.set(domain, domainSet.has(normalizedDomain));
    }

    return results;
};

/**
 * Checks multiple email addresses at once.
 * @param emails Array of email addresses to check.
 * @param customDomains Optional set of additional disposable domains to check.
 * @returns Map of email to boolean indicating if it's disposable.
 */
export const batchCheckEmails = (emails: string[], customDomains?: Set<string>): Map<string, boolean> => {
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

        // Check custom domains first if provided
        if (customDomains && customDomains.has(normalizedDomain)) {
            results.set(email, true);

            continue;
        }

        results.set(email, domainSet.has(normalizedDomain));
    }

    return results;
};
