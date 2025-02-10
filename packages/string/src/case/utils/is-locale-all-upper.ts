/**
 * Returns true if the string is considered “all uppercase” in German,
 * where we treat “ß” as acceptable even though Unicode considers it lowercase.
 *
 * @param s The string to test.
 * @param locale Defaults to "de-DE".
 */

export const isAllUpperGerman = (s: string, locale = "de-DE"): boolean => [...s].every((ch) => ch === "ß" || ch === ch.toLocaleUpperCase(locale));

/**
 * For Greek, we want to treat the final sigma (ς) as equivalent to uppercase sigma (Σ)
 * for the purpose of deciding if the string is “all uppercase.”
 *
 * @param s The string to test.
 * @param locale Defaults to "el-GR".
 */
export const isAllUpperGreek = (s: string, locale = "el-GR"): boolean => {
    // Normalize any final sigma (ς) to the standard uppercase sigma (Σ)
    const normalized = s.replaceAll("ς", "Σ");

    return normalized === normalized.toLocaleUpperCase(locale);
};

/**
 * For Turkish, we rely on locale‑aware conversion.
 *
 * @param s The string to test.
 * @param locale Defaults to "tr-TR".
 */
export const isAllUpperTurkish = (s: string, locale = "tr-TR"): boolean => s === s.toLocaleUpperCase(locale);

/**
 * A generic helper that dispatches to a locale‐specific “is all uppercase” test.
 * For locales, we don’t have a special case for, it falls back to a simple comparison.
 *
 * @param s The string to test.
 * @param locale Optional locale identifier.
 */
// Cache for locale-specific uppercase results
const upperCache = new Map<string, boolean>();
const CACHE_MAX_SIZE = 2000;

export const isAllUpper = (s: string, locale?: string): boolean => {
    // Generate cache key based on locale and string
    const cacheKey = locale ? `${locale}:${s}` : s;
    const cached = upperCache.get(cacheKey);

    if (cached !== undefined) {
        return cached;
    }

    let result: boolean;

    if (locale) {
        const normLocale = locale.toLowerCase();

        if (normLocale.startsWith("de")) {
            result = isAllUpperGerman(s, locale);
        } else if (normLocale.startsWith("el")) {
            result = isAllUpperGreek(s, locale);
        } else if (normLocale.startsWith("tr")) {
            result = isAllUpperTurkish(s, locale);
        } else {
            result = s === s.toLocaleUpperCase(locale);
        }
    } else {
        result = s === s.toUpperCase();
    }

    // Cache the result if we haven't exceeded the cache size
    if (upperCache.size < CACHE_MAX_SIZE) {
        upperCache.set(cacheKey, result);
    }

    return result;
};
