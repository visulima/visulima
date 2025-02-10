/**
 * Converts German "SS" to "ß" when appropriate for German locales.
 * This is used to handle special cases in German text where "SS" should be converted to "ß".
 *
 * @param value - The string to process
 * @param locale - The locale to check for German language
 * @returns The processed string with appropriate eszett conversions
 *
 * @example
 * ```typescript
 * normalizeGermanEszett("GROSSE") // => "GROßE"
 * ```
 */
export const normalizeGermanEszett = (value: string, locale?: string): string => {
    // Only apply this conversion for German locales
    if (!locale?.startsWith("de")) {
        return value;
    }

    // Replace "SS" with "ß" only when both letters are uppercase
    // This uses a positive lookbehind to ensure we don't convert "ss" or "Ss"
    return value.replaceAll(/(?<![a-zß])SS(?![a-z])/g, "ß");
};
