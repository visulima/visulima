/**
 * Converts German "SS" to "ß" when appropriate for German locales.
 * This is used to handle special cases in German text where "SS" should be converted to "ß".
 * @param value The string to process
 * @returns The processed string with appropriate eszett conversions
 * @example
 * ```typescript
 * normalizeGermanEszett("GROSSE") // => "GROßE"
 * ```
 */
const normalizeGermanEszett = (value: string): string =>
    // Replace "SS" with "ß" only when both letters are uppercase
    // This uses a positive lookbehind to ensure we don't convert "ss" or "Ss"
    value.replaceAll(/(?<![a-zß])SS(?![a-z])/g, "ß");

export default normalizeGermanEszett;
