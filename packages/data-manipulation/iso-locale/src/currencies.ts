import { all as countriesAll, byAlpha2 } from "./countries";
import currenciesData from "./data/currencies";
import { currencySymbolMap } from "./data/currency-symbol";
import type { Currency } from "./types";

const NUMERIC_1_3_REGEX = /^\d{1,3}$/;
const ALPHA_3_REGEX = /^[A-Z]{3}$/i;

/**
 * ISO 4217 numeric codes are not unique across time: when a currency is replaced,
 * the successor reuses the predecessor's numeric code. 532 is shared by ANG
 * (Netherlands Antillean guilder, demonetised in 2025) and its successor XCG
 * (Caribbean guilder). Pin the numeric lookup to the active currency so the
 * result does not silently depend on dataset ordering.
 */
const NUMERIC_CODE_PREFERENCE: Record<string, string> = {
    532: "XCG",
};

/**
 * Currency symbol map
 */
const symbolMap: Record<string, string> = {};

// Build symbol map
currencySymbolMap.forEach((entry) => {
    symbolMap[entry.code] = entry.symbol;
});

/**
 * Currencies indexed by code
 */
const currenciesByCode: Record<string, Currency> = {};

/**
 * Currencies indexed by numeric code
 */
const currenciesByNumber: Record<string, Currency> = {};

/**
 * All currencies array with symbols
 */
const currenciesView: ReadonlyArray<Currency> = currenciesData;

const allCurrencies: Currency[] = currenciesView.map((currency) => {
    let symbol = symbolMap[currency.code];

    // If symbol not found or is '?', use currency code as fallback
    if (!symbol || symbol === "?") {
        symbol = currency.code;
    }

    const currencyWithSymbol: Currency = {
        ...currency,
        symbol,
    };

    currenciesByCode[currency.code] = currencyWithSymbol;

    const preferredForNumber = NUMERIC_CODE_PREFERENCE[currency.number];

    if (preferredForNumber === undefined || preferredForNumber === currency.code) {
        currenciesByNumber[currency.number] = currencyWithSymbol;
    }

    return currencyWithSymbol;
});

/**
 * All currencies array
 */
export const all: ReadonlyArray<Currency> = allCurrencies;

/**
 * Get currency by ISO 4217 alphabetic code.
 * @param code 3-letter currency code (e.g., "USD")
 * @returns Currency object or undefined
 */
export const getByCode = (code: string): Currency | undefined => currenciesByCode[code.toUpperCase()];

/**
 * Get currency by ISO 4217 numeric code.
 * @param number 3-digit numeric code (e.g., "840")
 * @returns Currency object or undefined
 */
export const getByNumber = (number: string | number): Currency | undefined => {
    const numericCode = typeof number === "number" ? String(number).padStart(3, "0") : number.padStart(3, "0");

    return currenciesByNumber[numericCode];
};

/**
 * Get currencies used by a country (by alpha-2 code).
 * @param countryCode ISO 3166-1 alpha-2 country code (e.g., "US")
 * @returns Array of Currency objects
 */
export const getByCountry = (countryCode: string): Currency[] => {
    // Use the pre-built alpha-2 map instead of an O(n) scan of the country list.
    const country = byAlpha2[countryCode.toUpperCase()];

    if (!country?.currencies) {
        return [];
    }

    return country.currencies.map((code) => getByCode(code)).filter((currency): currency is Currency => currency !== undefined);
};

/**
 * Get all countries using a specific currency.
 * @param currencyCode ISO 4217 currency code (e.g., "USD")
 * @returns Array of country alpha-2 codes
 */
export const getCountriesByCurrency = (currencyCode: string): string[] => {
    const upperCode = currencyCode.toUpperCase();

    return countriesAll.filter((country) => (country.currencies as ReadonlyArray<string>).includes(upperCode)).map((country) => country.alpha2);
};

/**
 * Get currency symbol for a currency code.
 * @param currencyCode ISO 4217 currency code
 * @returns Currency symbol or the code itself if symbol not found
 */
export const getSymbol = (currencyCode: string): string => {
    const currency = getByCode(currencyCode);

    return currency?.symbol ?? currencyCode.toUpperCase();
};

/**
 * Get currency name for a currency code.
 * @param currencyCode ISO 4217 currency code
 * @returns Currency name or undefined
 */
export const getName = (currencyCode: string): string | undefined => getByCode(currencyCode)?.name;

/**
 * Check if a currency code is valid.
 * @param code Currency code (alphabetic or numeric)
 * @returns true if valid, false otherwise
 */
export const isValid = (code: string | number): boolean => {
    const codeString = String(code);

    // If it's a number or numeric string (3 digits), check numeric codes
    if (typeof code === "number" || NUMERIC_1_3_REGEX.test(codeString)) {
        return getByNumber(code) !== undefined;
    }

    // Otherwise check alphabetic codes (must be 3 letters)
    if (codeString.length === 3 && ALPHA_3_REGEX.test(codeString)) {
        return getByCode(codeString) !== undefined;
    }

    return false;
};

/**
 * Currencies indexed by code
 */
export const byCode: Readonly<Record<string, Currency>> = Object.freeze(currenciesByCode);

/**
 * Currencies indexed by numeric code
 */
export const byNumber: Readonly<Record<string, Currency>> = Object.freeze(currenciesByNumber);

/**
 * Get currency by name (exact match, case-insensitive).
 * @param name Currency name (e.g., "US Dollar")
 * @returns Currency object or undefined
 */
export const getCurrencyByName = (name: string): Currency | undefined => {
    const normalizedName = name.trim();

    return allCurrencies.find((currency) => currency.name.toLowerCase() === normalizedName.toLowerCase());
};

/**
 * Search currencies by name (partial match, case-insensitive).
 * @param query Search query (e.g., "dollar")
 * @returns Array of matching Currency objects
 */
export const searchCurrencies = (query: string): Currency[] => {
    const normalizedQuery = query.trim().toLowerCase();

    if (normalizedQuery.length === 0) {
        return [];
    }

    return allCurrencies.filter((currency) => currency.name.toLowerCase().includes(normalizedQuery));
};

/**
 * Precise type of a single currency record, derived from the const dataset so the
 * literal codes/numbers survive instead of being widened to `string`.
 */
export type CurrencyData = (typeof currenciesData)[number];

/**
 * Literal union of every ISO 4217 alphabetic currency code present in the dataset.
 * Derived directly from the const dataset so it stays in sync automatically.
 */
export type CurrencyCode = CurrencyData["code"];
