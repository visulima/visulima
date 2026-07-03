/**
 * Country data structure following ISO 3166-1
 */
export interface Country {
    /** ISO 3166-1 alpha-2 code (2-letter) */
    alpha2: string;
    /** ISO 3166-1 alpha-3 code (3-letter) */
    alpha3: string;
    /** Country calling codes (phone prefixes) */
    countryCallingCodes?: ReadonlyArray<string>;
    /** ISO 4217 currency codes used in this country */
    currencies: ReadonlyArray<string>;
    /** Flag emoji */
    emoji?: string;
    /** International Olympic Committee code */
    ioc?: string;
    /** ISO 639 language codes */
    languages: ReadonlyArray<string>;
    /** English name of the country */
    name: string;
    /** ISO 3166-1 numeric code (3-digit string) */
    numeric?: string;
    /** ISO status: 'assigned', 'reserved', 'deleted', etc. */
    status?: string;
}

/**
 * Currency data structure following ISO 4217
 */
export interface Currency {
    /** ISO 4217 alphabetic code (3-letter) */
    code: string;
    /** Number of decimal digits (minor units); `undefined` for currencies without a defined minor unit (e.g. precious metals) */
    decimals: number | undefined;
    /** Full currency name */
    name: string;
    /** ISO 4217 numeric code (3-digit string) */
    number: string;
    /** Currency symbol */
    symbol?: string;
}

/**
 * Currency symbol mapping entry
 */
export interface CurrencySymbolEntry {
    code: string;
    name: string;
    number: string;
    symbol: string;
}

/**
 * Region data structure following UN geoscheme
 */
export interface Region {
    /** Continental region (e.g., "Africa", "Americas", "Asia", "Europe", "Oceania", "Antarctica") */
    continent: string;
    /** Intermediary region (e.g., "Sub-Saharan Africa", "Latin America and the Caribbean", "North America") */
    intermediary?: string;
    /** Geographical subregion (e.g., "Northern Africa", "Western Europe", "Eastern Asia") */
    subregion: string;
}
