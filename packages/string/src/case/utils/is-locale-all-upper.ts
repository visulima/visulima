/**
 * Returns true if the string is considered “all uppercase” in German,
 * where we treat “ß” as acceptable even though Unicode considers it lowercase.
 *
 * @param s The string to test.
 * @param locale Defaults to "de-DE".
 */
import { toUpperCase } from "./string-ops";

export const isAllUpperGerman = (s: string, locale = "de-DE"): boolean => [...s].every((ch) => ch === "ß" || ch === toUpperCase(ch, locale));

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
    return normalized === toUpperCase(normalized, locale);
};

/**
 * For Turkish, we rely on locale‑aware conversion.
 *
 * @param s The string to test.
 * @param locale Defaults to "tr-TR".
 */
export const isAllUpperTurkish = (s: string, locale = "tr-TR"): boolean => s === toUpperCase(s, locale);

/**
 * A generic helper that dispatches to a locale‐specific “is all uppercase” test.
 * For locales, we don’t have a special case for, it falls back to a simple comparison.
 *
 * @param s The string to test.
 * @param locale Optional locale identifier.
 */
export const isAllUpper = (s: string, locale?: string): boolean => {
    if (!locale) {
        return s === toUpperCase(s);
    }

    const normLocale = locale.toLowerCase();

    if (normLocale.startsWith("de")) {
        return isAllUpperGerman(s, locale);
    }
    if (normLocale.startsWith("el")) {
        return isAllUpperGreek(s, locale);
    }
    if (normLocale.startsWith("tr")) {
        return isAllUpperTurkish(s, locale);
    }

    return s === s.toLocaleUpperCase(locale);
};
