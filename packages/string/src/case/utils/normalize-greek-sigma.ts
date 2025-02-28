/**
 * Normalizes Greek sigma variants.
 *
 * This function converts any final sigma (ς) or non‐final sigma (σ)
 * to a canonical uppercase sigma (Σ) when desired.
 *
 * @param value The string to normalize.
 */
export const normalizeGreekSigma = (value: string): string =>
    // Replace both forms of lowercase sigma with uppercase sigma.
     value.replaceAll(/[σς]/g, "Σ")
;
