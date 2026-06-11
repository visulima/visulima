// Countries
export type { Alpha2Code, Alpha3Code } from "./countries";
export {
    alpha2ToAlpha3,
    alpha2ToNumeric,
    alpha3ToAlpha2,
    alpha3ToNumeric,
    byAlpha2,
    byAlpha3,
    byNumeric,
    all as countriesAll,
    getByAlpha2,
    getByAlpha3,
    getByNumeric,
    getCallingCode,
    getCallingCodes,
    getCountriesByLanguage,
    getCountry,
    getCountryByName,
    getName as getCountryName,
    getEmoji,
    getIOC,
    getLanguages,
    isValid as isValidCountry,
    numericToAlpha2,
    numericToAlpha3,
    searchCountries,
} from "./countries";

// Re-export for convenience (original names)
export { all as countries } from "./countries";
export { isValid } from "./countries";
// Currencies
export type { CurrencyCode } from "./currencies";
export {
    byCode,
    byNumber,
    all as currenciesAll,
    getByCode,
    getByCountry,
    getByNumber,
    getCountriesByCurrency,
    getCurrencyByName,
    getName,
    getSymbol,
    isValid as isValidCurrency,
    searchCurrencies,
} from "./currencies";
export { all as currencies } from "./currencies";

// ISO 639 mapping utilities
export { convert6393To6391, iso6393To6391 } from "./data/iso-639-mapping";

// Locale utilities
export { generateBCP47Tag, getBCP47Tags, getCurrency, getLanguageName, getLocales, isValidBCP47Tag, parseBCP47Tag } from "./locale";

// Regions
export {
    getContinents,
    getCountriesInContinent,
    getCountriesInIntermediary,
    getCountriesInSubregion,
    getIntermediaryRegions,
    getRegionsForCountry,
    getSubregions,
    all as regions,
} from "./regions";

// Timezones
export {
    getCountriesForTimezone,
    getCountriesWithTimezones,
    getPrimaryTimezone,
    getTimezonesByCountry,
    isValidTimezone,
    all as timezonesAll,
    byCountry as timezonesByCountry,
} from "./timezones";

// Types
export type { Country, Currency, CurrencySymbolEntry, Region } from "./types";
