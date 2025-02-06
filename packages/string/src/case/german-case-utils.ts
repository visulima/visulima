/**
 * Converts German uppercase "SS" to "ß" in a string.
 * This is a special case conversion that only applies to German text.
 * It should be used after other case conversions have been applied.
 *
 * @param value - The string to convert
 * @param locale - The locale to use for case conversion
 * @returns The converted string
 *
 * @example
 * ```typescript
 * germanUpperSsToSz("STRASSE") // => "STRAßE"
 * germanUpperSsToSz("GROSSE") // => "GROßE"
 * ```
 */
export const germanUpperSsToSz = (value: string, locale?: string | string[]): string => {
    // Only apply this conversion for German locales
    if (!locale || (Array.isArray(locale) ? !locale.some((l) => l.startsWith("de")) : !locale.startsWith("de"))) {
        return value;
    }

    // Replace "SS" with "ß" only when both letters are uppercase
    // This uses a positive lookbehind to ensure we don't convert "ss" or "Ss"
    return value.replace(/(?<![a-zß])SS(?![a-z])/g, "ß");
};
