import { getByAlpha2, getLanguages } from "./countries";
import { getByCountry, getCountriesByCurrency } from "./currencies";
import { convert6393To6391 } from "./data/iso-639-mapping";

/**
 * Get currency code from locale or country code.
 * Supports BCP 47 tags (en-US), underscore format (en_US), or ISO 3166-1 alpha-2 (US).
 * @param locale Locale string or country code
 * @returns ISO 4217 currency code or undefined
 */
export const getCurrency = (locale: string): string | undefined => {
    // Extract country code from locale
    let countryCode: string | undefined;

    // Handle BCP 47 format: en-US, pt-BR, etc.
    if (locale.includes("-")) {
        const parts = locale.split("-");

        // Find the country part (usually 2-letter after language)
        for (let i = 1; i < parts.length; i += 1) {
            const part = parts[i]?.toUpperCase();

            if (part && part.length === 2 && /^[A-Z]{2}$/.test(part)) {
                countryCode = part;
                break;
            }
        }
    } else if (locale.includes("_")) {
        // Handle underscore format: en_US, pt_BR, etc.
        const parts = locale.split("_");
        const part = parts.at(-1)?.toUpperCase();

        if (part && part.length === 2 && /^[A-Z]{2}$/.test(part)) {
            countryCode = part;
        }
    } else if (locale.length === 2) {
        // Assume it's a direct country code
        countryCode = locale.toUpperCase();
    }

    if (!countryCode) {
        return undefined;
    }

    // Get currencies for the country (returns primary currency first)
    const currencies = getByCountry(countryCode);

    return currencies[0]?.code;
};

/**
 * Get all country codes (alpha-2) that use a specific currency.
 * @param currencyCode ISO 4217 currency code (e.g., "EUR")
 * @returns Array of ISO 3166-1 alpha-2 country codes
 */
export const getLocales = (currencyCode: string): string[] => getCountriesByCurrency(currencyCode);

/**
 * Parse a BCP 47 language tag into its components.
 * @param tag BCP 47 language tag (e.g., "en-US", "zh-Hant-TW")
 * @returns Parsed components or undefined if invalid
 */
export const parseBCP47Tag = (tag: string): { country?: string; language: string; script?: string } | undefined => {
    const parts = tag.split("-");

    if (parts.length === 0 || (parts[0]?.length ?? 0) < 2) {
        return undefined;
    }

    const language = (parts[0] ?? "").toLowerCase();

    // Validate language code format (2-3 letters, ISO 639-1 or ISO 639-2)
    if (!/^[a-z]{2,3}$/.test(language)) {
        return undefined;
    }

    let country: string | undefined;
    let script: string | undefined;

    // BCP 47 format: language-Script-Country or language-Country
    for (let i = 1; i < parts.length; i += 1) {
        const part = parts[i];

        if (!part) {
            continue;
        }

        // Script codes are 4 letters, country codes are 2 letters
        if (part.length === 4 && /^[A-Z]{4}$/i.test(part)) {
            script = part;
        } else if (part.length === 2 && /^[A-Z]{2}$/.test(part.toUpperCase())) {
            country = part.toUpperCase();
        }
    }

    const result: { country?: string; language: string; script?: string } = { language };

    if (country) {
        result.country = country;
    }

    if (script) {
        result.script = script;
    }

    return result;
};

/**
 * Generate a BCP 47 language tag from language and country codes.
 * @param languageCode ISO 639-1 language code (e.g., "en")
 * @param countryCode ISO 3166-1 alpha-2 country code (e.g., "US")
 * @param script Optional script code (e.g., "Latn", "Hant")
 * @returns BCP 47 tag (e.g., "en-US", "zh-Hant-TW")
 */
export const generateBCP47Tag = (languageCode: string, countryCode: string, script?: string): string => {
    const parts = [languageCode.toLowerCase()];

    if (script) {
        parts.push(script);
    }

    parts.push(countryCode.toUpperCase());

    return parts.join("-");
};

/**
 * Get all BCP 47 language tags for a country.
 * @param countryCode ISO 3166-1 alpha-2 country code (e.g., "US")
 * @returns Array of BCP 47 tags (e.g., ["en-US"])
 */
export const getBCP47Tags = (countryCode: string): string[] => {
    const country = getByAlpha2(countryCode);

    if (!country) {
        return [];
    }

    const languages = getLanguages(countryCode);
    const iso6391Codes = convert6393To6391(languages);

    if (iso6391Codes.length === 0) {
        return [];
    }

    return iso6391Codes.map((lang) => generateBCP47Tag(lang, countryCode));
};

/**
 * Validate a BCP 47 language tag format.
 * @param tag BCP 47 language tag to validate
 * @returns true if format is valid, false otherwise
 */
export const isValidBCP47Tag = (tag: string): boolean => {
    if (!tag || tag.trim().length === 0) {
        return false;
    }

    const parsed = parseBCP47Tag(tag);

    if (!parsed) {
        return false;
    }

    // Language code must be 2-3 letters (ISO 639-1 or ISO 639-2)
    if (parsed.language.length < 2 || parsed.language.length > 3) {
        return false;
    }

    // If country is present, it must be 2 letters
    if (parsed.country && parsed.country.length !== 2) {
        return false;
    }

    // If script is present, it must be 4 letters
    if (parsed.script && parsed.script.length !== 4) {
        return false;
    }

    return true;
};
