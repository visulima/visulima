import countryTimezonesData from "./data/timezones";

/**
 * Loose view of the const timezone dataset for internal lookups that index by an
 * arbitrary (upper-cased) country code. The precise const type is preserved on
 * the public {@link byCountry} export and the {@link Timezone} union below.
 */
const countryTimezonesView: Readonly<Record<string, ReadonlyArray<string>>> = countryTimezonesData;

const allTimezonesSet = new Set<string>();

Object.values(countryTimezonesView).forEach((tzList) => {
    tzList.forEach((tz) => allTimezonesSet.add(tz));
});

/**
 * Lazily-built reverse index of timezone -> country codes, so
 * `getCountriesForTimezone` is O(1) instead of re-scanning every country.
 */
let timezoneToCountries: Map<string, string[]> | undefined;

const getTimezoneToCountries = (): Map<string, string[]> => {
    if (!timezoneToCountries) {
        timezoneToCountries = new Map<string, string[]>();

        Object.entries(countryTimezonesView).forEach(([code, timezones]) => {
            timezones.forEach((tz) => {
                const existing = timezoneToCountries?.get(tz);

                if (existing) {
                    existing.push(code);
                } else {
                    timezoneToCountries?.set(tz, [code]);
                }
            });
        });
    }

    return timezoneToCountries;
};

/**
 * Memoized, sorted list of all timezones (the dataset is static).
 */
let sortedTimezones: string[] | undefined;

/**
 * Memoized, sorted list of all countries with timezone data (the dataset is static).
 */
let sortedCountriesWithTimezones: string[] | undefined;

/**
 * Get all timezones for a country.
 * @param countryCode ISO 3166-1 alpha-2 country code (e.g., "US")
 * @returns Array of IANA timezone identifiers or empty array
 */
export const getTimezonesByCountry = (countryCode: string): string[] => {
    const timezones = countryTimezonesView[countryCode.toUpperCase()];

    return timezones ? [...timezones] : [];
};

/**
 * Get all countries using a specific timezone.
 * @param timezone IANA timezone identifier (e.g., "Europe/London")
 * @returns Array of ISO 3166-1 alpha-2 country codes
 */
export const getCountriesForTimezone = (timezone: string): string[] => {
    const countries = getTimezoneToCountries().get(timezone);

    return countries ? [...countries] : [];
};

/**
 * Get all available timezones.
 * @returns Array of all IANA timezone identifiers
 */
export const all = (): string[] => {
    sortedTimezones ??= [...allTimezonesSet].toSorted((a, b) => a.localeCompare(b));

    return [...sortedTimezones];
};

/**
 * Get all countries with timezone data.
 * @returns Array of ISO 3166-1 alpha-2 country codes
 */
export const getCountriesWithTimezones = (): string[] => {
    sortedCountriesWithTimezones ??= Object.keys(countryTimezonesView).toSorted((a, b) => a.localeCompare(b));

    return [...sortedCountriesWithTimezones];
};

/**
 * Check if a timezone is valid (exists in our data).
 * @param timezone IANA timezone identifier
 * @returns true if timezone exists, false otherwise
 */
export const isValidTimezone = (timezone: string): boolean => allTimezonesSet.has(timezone);

/**
 * Get primary timezone for a country (first timezone in the list).
 * @param countryCode ISO 3166-1 alpha-2 country code
 * @returns Primary IANA timezone identifier or undefined
 */
export const getPrimaryTimezone = (countryCode: string): string | undefined => {
    const timezones = getTimezonesByCountry(countryCode);

    return timezones[0];
};

/**
 * All timezones data indexed by country code
 */
export const byCountry: typeof countryTimezonesData = countryTimezonesData;

/**
 * Literal union of every ISO 3166-1 alpha-2 country code that has timezone data.
 */
export type TimezoneCountryCode = keyof typeof countryTimezonesData;

/**
 * Literal union of every IANA timezone identifier present in the dataset.
 */
export type Timezone = (typeof countryTimezonesData)[TimezoneCountryCode][number];
