import { splitAddress } from "../internal/address";

/**
 * A suggested correction for a likely-misspelled email address.
 */
interface TypoSuggestion {
    /** The suggested corrected domain. */
    domain: string;
    /** The full suggested address (original local part + corrected domain). */
    full: string;
}

/**
 * Options for typo suggestion.
 */
interface TypoOptions {
    /** Popular full domains to match against (e.g. `gmail.com`). */
    domains?: string[];

    /**
     * Distance threshold for the full-domain match.
     * @default 2
     */
    domainThreshold?: number;
    /** Popular second-level domains to match against (e.g. `gmail`). */
    secondLevelDomains?: string[];

    /**
     * Distance threshold for the second-level match.
     * @default 2
     */
    secondLevelThreshold?: number;
    /** Popular top-level domains to match against (e.g. `com`). */
    topLevelDomains?: string[];

    /**
     * Distance threshold for the top-level match.
     * @default 2
     */
    topLevelThreshold?: number;
}

const DEFAULT_DOMAINS = [
    "aol.com",
    "fastmail.com",
    "gmail.com",
    "googlemail.com",
    "hotmail.com",
    "hotmail.co.uk",
    "icloud.com",
    "live.com",
    "mail.com",
    "me.com",
    "msn.com",
    "outlook.com",
    "proton.me",
    "protonmail.com",
    "yahoo.com",
    "yahoo.co.uk",
    "ymail.com",
    "zoho.com",
];

const DEFAULT_SECOND_LEVEL_DOMAINS = [
    "aol",
    "fastmail",
    "gmail",
    "googlemail",
    "hotmail",
    "icloud",
    "live",
    "mail",
    "me",
    "msn",
    "outlook",
    "proton",
    "protonmail",
    "yahoo",
    "ymail",
    "zoho",
];

const DEFAULT_TOP_LEVEL_DOMAINS = ["co.uk", "com", "de", "edu", "fr", "gov", "info", "io", "me", "net", "org"];

/**
 * Sift3 string distance (the algorithm used by mailcheck).
 *
 * A fast, approximate edit distance tuned for short strings like domain names.
 * Lower is closer; identical strings score 0.
 * @param s1 The first string.
 * @param s2 The second string.
 * @returns The approximate distance.
 */
const MAX_OFFSET = 5;

/**
 * Finds the realignment offset after a character mismatch at position `c`:
 * how far ahead in `s1` (or `s2`) the next matching character sits.
 */
const findOffsets = (s1: string, s2: string, c: number): { offset1: number; offset2: number } => {
    for (let index = 0; index < MAX_OFFSET; index += 1) {
        if (c + index < s1.length && s1[c + index] === s2[c]) {
            return { offset1: index, offset2: 0 };
        }

        if (c + index < s2.length && s1[c] === s2[c + index]) {
            return { offset1: 0, offset2: index };
        }
    }

    return { offset1: 0, offset2: 0 };
};

const sift3Distance = (s1: string, s2: string): number => {
    if (s1.length === 0) {
        return s2.length;
    }

    if (s2.length === 0) {
        return s1.length;
    }

    let c = 0;
    let offset1 = 0;
    let offset2 = 0;
    let lcs = 0;

    while (c + offset1 < s1.length && c + offset2 < s2.length) {
        if (s1[c + offset1] === s2[c + offset2]) {
            lcs += 1;
        } else {
            ({ offset1, offset2 } = findOffsets(s1, s2, c));
        }

        c += 1;
    }

    return (s1.length + s2.length) / 2 - lcs;
};

const findClosest = (value: string, candidates: string[], threshold: number): string | undefined => {
    let minDistance = Number.POSITIVE_INFINITY;
    let closest: string | undefined;

    for (const candidate of candidates) {
        if (value === candidate) {
            return value;
        }

        const distance = sift3Distance(value, candidate);

        if (distance < minDistance) {
            minDistance = distance;
            closest = candidate;
        }
    }

    return minDistance <= threshold ? closest : undefined;
};

const splitDomain = (domain: string): { secondLevel: string; topLevel: string } => {
    const parts = domain.split(".");

    if (parts.length >= 3 && DEFAULT_TOP_LEVEL_DOMAINS.includes(parts.slice(-2).join("."))) {
        return { secondLevel: parts.slice(0, -2).join("."), topLevel: parts.slice(-2).join(".") };
    }

    return { secondLevel: parts.slice(0, -1).join("."), topLevel: parts.at(-1) ?? "" };
};

/**
 * Suggests a corrected domain for a likely-misspelled one, using the mailcheck
 * algorithm (full-domain match, then second-level + top-level matching).
 * @param domain The domain to check.
 * @param options Override domain lists and thresholds.
 * @returns The suggested domain, or `undefined` when the domain looks fine.
 */
const suggestDomain = (domain: string, options: TypoOptions = {}): string | undefined => {
    const normalized = domain.toLowerCase().trim();

    const domains = options.domains ?? DEFAULT_DOMAINS;
    const secondLevelDomains = options.secondLevelDomains ?? DEFAULT_SECOND_LEVEL_DOMAINS;
    const topLevelDomains = options.topLevelDomains ?? DEFAULT_TOP_LEVEL_DOMAINS;

    if (domains.includes(normalized)) {
        return undefined;
    }

    const closestFull = findClosest(normalized, domains, options.domainThreshold ?? 2);

    if (closestFull && closestFull !== normalized) {
        return closestFull;
    }

    const { secondLevel, topLevel } = splitDomain(normalized);

    if (!secondLevel || !topLevel) {
        return undefined;
    }

    const closestSecond = findClosest(secondLevel, secondLevelDomains, options.secondLevelThreshold ?? 2) ?? secondLevel;
    const closestTop = findClosest(topLevel, topLevelDomains, options.topLevelThreshold ?? 2) ?? topLevel;

    const suggested = `${closestSecond}.${closestTop}`;

    return suggested === normalized ? undefined : suggested;
};

/**
 * Suggests a corrected email address when the domain looks misspelled
 * (e.g. `user@gmial.com` → `user@gmail.com`).
 * @param email The email address to check.
 * @param options Override domain lists and thresholds.
 * @returns A {@link TypoSuggestion}, or `undefined` when nothing looks wrong.
 * @example
 * ```ts
 * import { suggestEmailTypo } from "@visulima/email-verifier/enrich/typo";
 *
 * suggestEmailTypo("user@gmial.com")?.full; // "user@gmail.com"
 * ```
 */
const suggestEmailTypo = (email: string, options: TypoOptions = {}): TypoSuggestion | undefined => {
    const parts = splitAddress(email);

    if (!parts) {
        return undefined;
    }

    const suggestedDomain = suggestDomain(parts.domain, options);

    if (!suggestedDomain) {
        return undefined;
    }

    return { domain: suggestedDomain, full: `${parts.localPart}@${suggestedDomain}` };
};

export type { TypoOptions, TypoSuggestion };
export { sift3Distance, suggestDomain, suggestEmailTypo };
export default suggestEmailTypo;
