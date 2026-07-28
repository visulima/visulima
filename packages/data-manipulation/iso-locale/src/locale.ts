import { getByAlpha2, getLanguages } from "./countries";
import { getByCountry, getCountriesByCurrency } from "./currencies";
import { convert6393To6391, iso6393To6391 } from "./data/iso-639-mapping";
import { getDisplayNames } from "./display-names";

const ALPHA2_REGEX = /^[A-Z]{2}$/;
const LANG_REGEX = /^[a-z]{2,3}$/;
const SCRIPT_REGEX = /^[A-Z]{4}$/i;
const UN_M49_REGEX = /^\d{3}$/;
const VARIANT_REGEX = /^(?:[\da-z]{5,8}|\d[\da-z]{3})$/i;
const SINGLETON_REGEX = /^[\da-z]$/i;
const EXTENSION_SUBTAG_REGEX = /^[\da-z]{1,8}$/i;
const EXTLANG_REGEX = /^[a-z]{3}$/i;

/**
 * Get currency code from locale or country code.
 * Supports BCP 47 tags (en-US), underscore format (en_US), or ISO 3166-1 alpha-2 (US).
 * @param locale Locale string or country code
 * @returns ISO 4217 currency code or undefined
 */
export const getCurrency = (locale: string): string | undefined => {
    // Extract country code from locale
    let countryCode: string | undefined;

    // Normalize BCP 47 (en-US) and underscore (en_US, en_US_POSIX) formats to a
    // single separator so one extraction loop covers both (and mixed) inputs.
    const normalized = locale.replaceAll("_", "-");

    if (normalized.includes("-")) {
        const parts = normalized.split("-");

        // Find the country part (usually 2-letter after language)
        for (let i = 1; i < parts.length; i += 1) {
            const part = parts[i]?.toUpperCase();

            if (part?.length === 2 && ALPHA2_REGEX.test(part)) {
                countryCode = part;
                break;
            }
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
 * Get the localized display name of a language using the runtime `Intl.DisplayNames` API.
 *
 * Accepts both ISO 639-1 (2-letter, e.g. "de") and ISO 639-3 (3-letter, e.g. "deu")
 * codes — 3-letter codes are converted to their 2-letter form first.
 * @param languageCode ISO 639-1 or ISO 639-3 language code
 * @param locale BCP 47 locale to translate the name into (defaults to "en")
 * @returns Localized language name or undefined if it cannot be resolved
 */
export const getLanguageName = (languageCode: string, locale = "en"): string | undefined => {
    const normalized = languageCode.toLowerCase();
    // The dataset stores ISO 639-3; Intl expects ISO 639-1, so convert when needed.
    let iso6391 = normalized;

    if (normalized.length === 3) {
        iso6391 = iso6393To6391(normalized) ?? normalized;
    }

    const displayNames = getDisplayNames("language", locale);

    if (displayNames) {
        try {
            const localized = displayNames.of(iso6391);

            // Intl returns the input code unchanged when it cannot resolve a name.
            if (localized && localized !== iso6391) {
                return localized;
            }
        } catch {
            // Unresolvable language code.
        }
    }

    return undefined;
};

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
    if (!LANG_REGEX.test(language)) {
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
        if (part.length === 4 && SCRIPT_REGEX.test(part)) {
            script = part;
        } else if (part.length === 2 && ALPHA2_REGEX.test(part.toUpperCase())) {
            country = part.toUpperCase();
        } else if (part.length === 3 && UN_M49_REGEX.test(part)) {
            // UN M.49 numeric region code (e.g., "419")
            country = part;
        }
        // Any other subtag (registered variant, or unrecognized) is ignored by the
        // lenient parser. Strictness is enforced by isValidBCP47Tag, not here.
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
        // Canonicalize script subtags to title case (BCP 47), e.g. "hant" -> "Hant".
        parts.push(script.charAt(0).toUpperCase() + script.slice(1).toLowerCase());
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
// eslint-disable-next-line sonarjs/cognitive-complexity -- strict BCP 47 validation re-scans every subtag shape; the sequential guards are the spec and clearer inline
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

    // If country is present, it must be a 2-letter alpha region or a 3-digit UN M.49 region
    if (parsed.country && !ALPHA2_REGEX.test(parsed.country) && !UN_M49_REGEX.test(parsed.country)) {
        return false;
    }

    // If script is present, it must be 4 letters
    if (parsed.script && parsed.script.length !== 4) {
        return false;
    }

    // Reject tags containing unrecognized/garbage subtags. parseBCP47Tag is
    // intentionally lenient (it silently drops anything it can't classify), so
    // strictness is enforced here by re-scanning every non-language subtag per the
    // RFC 5646 grammar: 4-letter script, 2-letter alpha / 3-digit UN M.49 region,
    // 3-letter extlang, registered variant, or a singleton that opens an extension
    // (or private-use) sequence of 1-8 char alphanumeric subtags. Empty subtags
    // (double or trailing hyphens) are invalid.
    const subtags = tag.split("-");

    // Whether the scan is currently consuming an extension / private-use sequence
    // introduced by a singleton subtag, and whether that sequence has at least one
    // following subtag (a dangling singleton is invalid).
    let inExtension = false;
    let extensionHasContent = false;

    for (let i = 1; i < subtags.length; i += 1) {
        const part = subtags[i];

        if (!part) {
            return false;
        }

        // A singleton (single alphanumeric) opens an extension, or private-use for "x".
        if (part.length === 1 && SINGLETON_REGEX.test(part)) {
            if (inExtension && !extensionHasContent) {
                return false;
            }

            inExtension = true;
            extensionHasContent = false;

            continue;
        }

        if (inExtension) {
            if (!EXTENSION_SUBTAG_REGEX.test(part)) {
                return false;
            }

            extensionHasContent = true;

            continue;
        }

        const isScript = part.length === 4 && SCRIPT_REGEX.test(part);
        const isAlpha2Region = part.length === 2 && ALPHA2_REGEX.test(part.toUpperCase());
        const isM49Region = part.length === 3 && UN_M49_REGEX.test(part);
        const isExtlang = part.length === 3 && EXTLANG_REGEX.test(part);
        const isVariant = VARIANT_REGEX.test(part);

        if (!isScript && !isAlpha2Region && !isM49Region && !isExtlang && !isVariant) {
            return false;
        }
    }

    // A trailing singleton with no following subtag is invalid.
    if (inExtension && !extensionHasContent) {
        return false;
    }

    return true;
};
