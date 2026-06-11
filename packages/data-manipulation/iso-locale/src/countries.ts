import countriesData from "./data/countries";
import { iso6393To6391 } from "./data/iso-639-mapping";
import type { Country } from "./types";

const DIGITS_ONLY_REGEX = /^\d+$/;

/**
 * Countries data indexed by alpha-2 code
 */
const countriesByAlpha2: Record<string, Country> = {};

/**
 * Countries data indexed by alpha-3 code
 */
const countriesByAlpha3: Record<string, Country> = {};

/**
 * Countries data indexed by numeric code
 */
const countriesByNumeric: Record<string, Country> = {};

/**
 * All countries array.
 */
const allCountries: ReadonlyArray<Country> = countriesData as unknown as ReadonlyArray<Country>;

// Build lookup maps
(allCountries as unknown as Country[]).forEach((country) => {
    // Prefer assigned country codes over inactive ones
    const existing = countriesByAlpha2[country.alpha2];

    if (!existing || existing.status === "deleted" || country.status === "assigned") {
        countriesByAlpha2[country.alpha2] = country;
    }

    const existingAlpha3 = countriesByAlpha3[country.alpha3];

    if (!existingAlpha3 || existingAlpha3.status === "deleted" || country.status === "assigned") {
        countriesByAlpha3[country.alpha3] = country;
    }

    if (country.numeric) {
        countriesByNumeric[country.numeric] = country;
    }
});

/**
 * Get country by ISO 3166-1 alpha-2 code.
 * @param code 2-letter country code (e.g., "US")
 * @returns Country object or undefined
 */
export const getByAlpha2 = (code: string): Country | undefined => countriesByAlpha2[code.toUpperCase()];

/**
 * Get country by ISO 3166-1 alpha-3 code.
 * @param code 3-letter country code (e.g., "USA")
 * @returns Country object or undefined
 */
export const getByAlpha3 = (code: string): Country | undefined => countriesByAlpha3[code.toUpperCase()];

/**
 * Get country by ISO 3166-1 numeric code.
 * @param code 3-digit numeric code (e.g., "840")
 * @returns Country object or undefined
 */
export const getByNumeric = (code: string | number): Country | undefined => {
    const numericCode = typeof code === "number" ? String(code).padStart(3, "0") : code.padStart(3, "0");

    return countriesByNumeric[numericCode];
};

/**
 * Resolve a country from a code in any supported format.
 * Numbers and digit-only strings are treated as ISO 3166-1 numeric codes,
 * 2-letter strings as alpha-2, and 3-letter strings as alpha-3.
 * @param countryCode ISO 3166-1 alpha-2, alpha-3, or numeric code
 * @returns Country object or undefined
 */
export const getCountry = (countryCode: string | number): Country | undefined => {
    if (typeof countryCode === "number" || DIGITS_ONLY_REGEX.test(countryCode)) {
        return getByNumeric(countryCode);
    }

    const upperCode = countryCode.toUpperCase();

    if (upperCode.length === 2) {
        return getByAlpha2(upperCode);
    }

    if (upperCode.length === 3) {
        return getByAlpha3(upperCode);
    }

    return undefined;
};

/**
 * Convert alpha-2 code to alpha-3 code.
 * @param alpha2 2-letter country code
 * @returns 3-letter country code or undefined
 */
export const alpha2ToAlpha3 = (alpha2: string): string | undefined => getByAlpha2(alpha2)?.alpha3;

/**
 * Convert alpha-3 code to alpha-2 code.
 * @param alpha3 3-letter country code
 * @returns 2-letter country code or undefined
 */
export const alpha3ToAlpha2 = (alpha3: string): string | undefined => getByAlpha3(alpha3)?.alpha2;

/**
 * Convert alpha-2 code to numeric code.
 * @param alpha2 2-letter country code
 * @returns 3-digit numeric code or undefined
 */
export const alpha2ToNumeric = (alpha2: string): string | undefined => getByAlpha2(alpha2)?.numeric;

/**
 * Convert alpha-3 code to numeric code.
 * @param alpha3 3-letter country code
 * @returns 3-digit numeric code or undefined
 */
export const alpha3ToNumeric = (alpha3: string): string | undefined => getByAlpha3(alpha3)?.numeric;

/**
 * Convert numeric code to alpha-2 code.
 * @param numeric 3-digit numeric code
 * @returns 2-letter country code or undefined
 */
export const numericToAlpha2 = (numeric: string | number): string | undefined => getByNumeric(numeric)?.alpha2;

/**
 * Convert numeric code to alpha-3 code.
 * @param numeric 3-digit numeric code
 * @returns 3-letter country code or undefined
 */
export const numericToAlpha3 = (numeric: string | number): string | undefined => getByNumeric(numeric)?.alpha3;

/**
 * Check if a country code is valid (supports alpha-2, alpha-3, or numeric).
 * @param code Country code in any format
 * @returns true if valid, false otherwise
 */
export const isValid = (code: string | number): boolean => {
    if (typeof code === "number" || DIGITS_ONLY_REGEX.test(code)) {
        return getByNumeric(code) !== undefined;
    }

    const upperCode = code.toUpperCase();

    if (upperCode.length === 2) {
        return getByAlpha2(upperCode) !== undefined;
    }

    if (upperCode.length === 3) {
        return getByAlpha3(upperCode) !== undefined;
    }

    return false;
};

/**
 * Countries indexed by alpha-2 code.
 */
export const byAlpha2: Readonly<Record<string, Country>> = Object.freeze(countriesByAlpha2);

/**
 * Countries indexed by alpha-3 code.
 */
export const byAlpha3: Readonly<Record<string, Country>> = Object.freeze(countriesByAlpha3);

/**
 * Countries indexed by numeric code.
 */
export const byNumeric: Readonly<Record<string, Country>> = Object.freeze(countriesByNumeric);

/**
 * Get flag emoji for a country.
 * @param countryCode ISO 3166-1 alpha-2, alpha-3, or numeric code
 * @returns Flag emoji or undefined
 */
export const getEmoji = (countryCode: string | number): string | undefined => getCountry(countryCode)?.emoji;

/**
 * Get country calling code (phone prefix) for a country.
 * @param countryCode ISO 3166-1 alpha-2, alpha-3, or numeric code
 * @returns First calling code or undefined
 */
export const getCallingCode = (countryCode: string | number): string | undefined => getCountry(countryCode)?.countryCallingCodes?.[0];

/**
 * Get all calling codes for a country.
 * @param countryCode ISO 3166-1 alpha-2, alpha-3, or numeric code
 * @returns Array of calling codes or empty array
 */
export const getCallingCodes = (countryCode: string | number): string[] => getCountry(countryCode)?.countryCallingCodes ?? [];

/**
 * Get languages for a country.
 * @param countryCode ISO 3166-1 alpha-2, alpha-3, or numeric code
 * @returns Array of ISO 639 language codes or empty array
 */
export const getLanguages = (countryCode: string | number): string[] => getCountry(countryCode)?.languages ?? [];

/**
 * Get International Olympic Committee code for a country.
 * @param countryCode ISO 3166-1 alpha-2, alpha-3, or numeric code
 * @returns IOC code or undefined
 */
export const getIOC = (countryCode: string | number): string | undefined => getCountry(countryCode)?.ioc;

/**
 * Get country by name (exact match, case-insensitive).
 * @param name Country name (e.g., "United States")
 * @returns Country object or undefined
 */
export const getCountryByName = (name: string): Country | undefined => {
    const normalizedName = name.trim();

    return (allCountries as unknown as Country[]).find((country) => country.name.toLowerCase() === normalizedName.toLowerCase());
};

/**
 * Search countries by name (partial match, case-insensitive).
 * @param query Search query (e.g., "united")
 * @returns Array of matching Country objects
 */
export const searchCountries = (query: string): Country[] => {
    const normalizedQuery = query.trim().toLowerCase();

    if (normalizedQuery.length === 0) {
        return [];
    }

    return (allCountries as unknown as Country[]).filter((country) => country.name.toLowerCase().includes(normalizedQuery));
};

/**
 * Get the localized display name of a country using the runtime `Intl.DisplayNames` API.
 *
 * Falls back to the English `name` from the dataset when `Intl.DisplayNames` is
 * unavailable or cannot resolve the code (e.g. unsupported region).
 * @param countryCode ISO 3166-1 alpha-2, alpha-3, or numeric code
 * @param locale BCP 47 locale to translate the name into (defaults to "en")
 * @returns Localized country name or undefined if the country is unknown
 */
export const getName = (countryCode: string | number, locale = "en"): string | undefined => {
    const country = getCountry(countryCode);

    if (!country) {
        return undefined;
    }

    if (typeof Intl !== "undefined" && typeof Intl.DisplayNames === "function") {
        try {
            const displayNames = new Intl.DisplayNames([locale], { type: "region" });
            const localized = displayNames.of(country.alpha2);

            // Intl returns the input code unchanged when it cannot resolve a name.
            if (localized && localized !== country.alpha2) {
                return localized;
            }
        } catch {
            // Invalid locale or unsupported environment — fall through to English.
        }
    }

    return country.name;
};

/**
 * Get all countries whose language list includes the given ISO 639 language code.
 *
 * Accepts both ISO 639-1 (2-letter, e.g. "de") and ISO 639-3 (3-letter, e.g. "deu")
 * codes; the underlying dataset stores ISO 639-3, so 2-letter codes are matched
 * against the converted form.
 * @param languageCode ISO 639-1 or ISO 639-3 language code
 * @returns Array of ISO 3166-1 alpha-2 country codes that use the language
 */
export const getCountriesByLanguage = (languageCode: string): string[] => {
    const normalized = languageCode.toLowerCase();

    return (allCountries as unknown as Country[])
        .filter((country) => country.status !== "deleted" && country.languages.some((lang) => lang === normalized || iso6393To6391(lang) === normalized))
        .map((country) => country.alpha2);
};

// Export all at the end
export const all: Country[] = allCountries as unknown as Country[];

/**
 * Literal union of every ISO 3166-1 alpha-2 code present in the dataset.
 * Derived directly from the const dataset so it stays in sync automatically.
 */
export type Alpha2Code = (typeof countriesData)[number]["alpha2"];

/**
 * Literal union of every ISO 3166-1 alpha-3 code present in the dataset.
 */
export type Alpha3Code = (typeof countriesData)[number]["alpha3"];
