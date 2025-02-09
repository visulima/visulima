/**
 * Normalizes Greek sigma variants.
 *
 * This function converts any final sigma (ς) or non‐final sigma (σ)
 * to a canonical uppercase sigma (Σ) when desired.
 *
 * @param value The string to normalize.
 * @param locale Should be "el" or similar.
 */
export const normalizeGreekSigma = (value: string, locale?: string): string => {
    if (!locale?.toLowerCase().startsWith("el")) {
        return value;
    }

    // Replace both forms of lowercase sigma with uppercase sigma.
    return value.replaceAll(/[σς]/g, "Σ");
};
