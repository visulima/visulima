import countryRegionsData from "./data/regions";
import type { Region } from "./types";

/**
 * Memoized continent list (the dataset is static).
 */
let sortedContinents: string[] | undefined;

/**
 * Memoized subregion lists keyed by continent filter ("" = all continents).
 */
const subregionCache = new Map<string, string[]>();

/**
 * Memoized intermediary-region lists keyed by continent filter ("" = all continents).
 */
const intermediaryCache = new Map<string, string[]>();

/**
 * Get region information for a country.
 * @param countryCode ISO 3166-1 alpha-2 country code (e.g., "US")
 * @returns Region object or undefined
 */
export const getRegionsForCountry = (countryCode: string): Region | undefined => countryRegionsData[countryCode.toUpperCase()];

/**
 * Get all countries in a continental region.
 * @param continent Continental region (e.g., "Africa", "Americas", "Asia", "Europe", "Oceania", "Antarctica")
 * @returns Array of ISO 3166-1 alpha-2 country codes
 */
export const getCountriesInContinent = (continent: string): string[] =>
    Object.entries(countryRegionsData)
        .filter(([, region]) => region.continent === continent)
        .map(([code]) => code);

/**
 * Get all countries in a geographical subregion.
 * @param subregion Geographical subregion (e.g., "Northern Africa", "Western Europe")
 * @returns Array of ISO 3166-1 alpha-2 country codes
 */
export const getCountriesInSubregion = (subregion: string): string[] =>
    Object.entries(countryRegionsData)
        .filter(([, region]) => region.subregion === subregion)
        .map(([code]) => code);

/**
 * Get all countries in an intermediary region.
 * @param intermediary Intermediary region (e.g., "Sub-Saharan Africa", "Latin America and the Caribbean")
 * @returns Array of ISO 3166-1 alpha-2 country codes
 */
export const getCountriesInIntermediary = (intermediary: string): string[] =>
    Object.entries(countryRegionsData)
        .filter(([, region]) => region.intermediary === intermediary)
        .map(([code]) => code);

/**
 * Get all available continental regions.
 * @returns Array of continental region names
 */
export const getContinents = (): string[] => {
    if (!sortedContinents) {
        const continents = new Set<string>();

        Object.values(countryRegionsData).forEach((region) => {
            continents.add(region.continent);
        });

        sortedContinents = [...continents].toSorted((a, b) => a.localeCompare(b));
    }

    return [...sortedContinents];
};

/**
 * Get all available geographical subregions.
 * @param continent Optional filter by continent
 * @returns Array of subregion names
 */
export const getSubregions = (continent?: string): string[] => {
    const cacheKey = continent ?? "";
    let cached = subregionCache.get(cacheKey);

    if (!cached) {
        const subregions = new Set<string>();

        Object.values(countryRegionsData).forEach((region) => {
            if (!continent || region.continent === continent) {
                subregions.add(region.subregion);
            }
        });

        cached = [...subregions].toSorted((a, b) => a.localeCompare(b));
        subregionCache.set(cacheKey, cached);
    }

    return [...cached];
};

/**
 * Get all available intermediary regions.
 * @param continent Optional filter by continent
 * @returns Array of intermediary region names
 */
export const getIntermediaryRegions = (continent?: string): string[] => {
    const cacheKey = continent ?? "";
    let cached = intermediaryCache.get(cacheKey);

    if (!cached) {
        const intermediaries = new Set<string>();

        Object.values(countryRegionsData).forEach((region) => {
            if (region.intermediary && (!continent || region.continent === continent)) {
                intermediaries.add(region.intermediary);
            }
        });

        cached = [...intermediaries].toSorted((a, b) => a.localeCompare(b));
        intermediaryCache.set(cacheKey, cached);
    }

    return [...cached];
};

/**
 * Get all regions data
 * @returns Record of country codes to regions
 */
export const all: Readonly<Record<string, Region>> = countryRegionsData;
