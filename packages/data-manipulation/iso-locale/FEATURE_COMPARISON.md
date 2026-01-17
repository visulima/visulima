# Feature Comparison: @visulima/iso-locale vs country-data-list

## Countries ✅ FULLY SUPPORTED

| Feature             | country-data-list | @visulima/iso-locale             | Status |
| ------------------- | ----------------- | -------------------------------- | ------ |
| name                | ✅                | ✅ `country.name`                | ✅     |
| alpha2              | ✅                | ✅ `country.alpha2`              | ✅     |
| alpha3              | ✅                | ✅ `country.alpha3`              | ✅     |
| status              | ✅                | ✅ `country.status`              | ✅     |
| currencies          | ✅                | ✅ `country.currencies`          | ✅     |
| languages           | ✅ (ISO 639-2)    | ✅ (ISO 639-3)                   | ✅     |
| countryCallingCodes | ✅                | ✅ `country.countryCallingCodes` | ✅     |
| ioc                 | ✅                | ✅ `country.ioc`                 | ✅     |
| emoji               | ✅                | ✅ `country.emoji`               | ✅     |

**Utility Functions:**

- ✅ `getByAlpha2(code)` - Get country by alpha-2
- ✅ `getByAlpha3(code)` - Get country by alpha-3
- ✅ `getByNumeric(code)` - Get country by numeric
- ✅ `getCountryByName(name)` - Get country by exact name
- ✅ `searchCountries(query)` - Search countries by partial name
- ✅ `getEmoji(countryCode)` - Get flag emoji
- ✅ `getCallingCode(countryCode)` - Get first calling code
- ✅ `getCallingCodes(countryCode)` - Get all calling codes
- ✅ `getLanguages(countryCode)` - Get languages for country
- ✅ `getIOC(countryCode)` - Get IOC code
- ✅ Code conversion utilities (alpha2 ↔ alpha3 ↔ numeric)
- ✅ Validation utilities

---

## Currencies ✅ FULLY SUPPORTED

| Feature  | country-data-list | @visulima/iso-locale   | Status |
| -------- | ----------------- | ---------------------- | ------ |
| code     | ✅                | ✅ `currency.code`     | ✅     |
| name     | ✅                | ✅ `currency.name`     | ✅     |
| number   | ✅                | ✅ `currency.number`   | ✅     |
| decimals | ✅                | ✅ `currency.decimals` | ✅     |
| symbol   | ✅                | ✅ `currency.symbol`   | ✅     |

**Utility Functions:**

- ✅ `getByCode(code)` - Get currency by code
- ✅ `getByNumber(number)` - Get currency by number
- ✅ `getByCountry(countryCode)` - Get currencies for country
- ✅ `getCountriesByCurrency(currencyCode)` - Get countries using currency
- ✅ `getCurrencyByName(name)` - Get currency by exact name
- ✅ `searchCurrencies(query)` - Search currencies by partial name
- ✅ `getSymbol(currencyCode)` - Get currency symbol (returns code if not found)
- ✅ `getName(currencyCode)` - Get currency name

---

## Currency Symbol Utilities ⚠️ PARTIALLY SUPPORTED

| Function                    | country-data-list              | @visulima/iso-locale             | Status                  |
| --------------------------- | ------------------------------ | -------------------------------- | ----------------------- |
| `getSymbolFromCurrency`     | ✅                             | ✅ `getSymbol`                   | ✅ (same functionality) |
| `getNameFromCurrency`       | ✅                             | ✅ `getName`                     | ✅ (same functionality) |
| `getSafeSymbolFromCurrency` | ✅ (returns code if not found) | ✅ `getSymbol` (already safe)    | ✅ (built-in)           |
| `getSafeNameFromCurrency`   | ✅ (returns code if not found) | ⚠️ `getName` (returns undefined) | ⚠️ Different behavior   |
| `currencySymbolMap`         | ✅ (exported)                  | ❌ (internal only)               | ❌ Not exported         |

**Note:** Our `getSymbol` already returns the code if symbol not found (safe behavior), but `getName` returns `undefined` instead of the code.

---

## Languages ❌ NOT SUPPORTED

| Feature                   | country-data-list | @visulima/iso-locale           | Status                |
| ------------------------- | ----------------- | ------------------------------ | --------------------- |
| Language data structure   | ✅                | ❌                             | ❌                    |
| name                      | ✅                | ❌                             | ❌                    |
| alpha2 (ISO 639-1)        | ✅                | ⚠️ (via mapping)               | ⚠️                    |
| alpha3 (ISO 639-2/T)      | ✅                | ✅ (ISO 639-3 in country data) | ⚠️ Different standard |
| bibliographic             | ✅                | ❌                             | ❌                    |
| Language lookup functions | ✅                | ❌                             | ❌                    |

**What we have:**

- ✅ Languages as arrays in country data (ISO 639-3 codes)
- ✅ ISO 639-3 to ISO 639-1 mapping utility (`iso6393To6391`)
- ❌ No standalone language data structure
- ❌ No language lookup functions

---

## Timezones ❌ NOT SUPPORTED

| Feature                   | country-data-list | @visulima/iso-locale | Status |
| ------------------------- | ----------------- | -------------------- | ------ |
| IANA timezone database    | ✅                | ❌                   | ❌     |
| `getTimezonesByCountry`   | ✅                | ❌                   | ❌     |
| `getCountriesForTimezone` | ✅                | ❌                   | ❌     |
| `getUtcOffset`            | ✅                | ❌                   | ❌     |
| `timezones.all`           | ✅                | ❌                   | ❌     |

**Status:** Not implemented. Would require IANA timezone database integration.

---

## Regions and Continents ❌ NOT SUPPORTED

| Feature                | country-data-list | @visulima/iso-locale | Status |
| ---------------------- | ----------------- | -------------------- | ------ |
| Region data            | ✅                | ❌                   | ❌     |
| Continent data         | ✅                | ❌                   | ❌     |
| `getRegionsForCountry` | ✅                | ❌                   | ❌     |
| `getCountriesInRegion` | ✅                | ❌                   | ❌     |

**Status:** Not implemented. Would require regional/continental data.

---

## BCP 47 / Locale Support ✅ ENHANCED

| Feature                    | country-data-list | @visulima/iso-locale | Status          |
| -------------------------- | ----------------- | -------------------- | --------------- |
| `getCurrency(locale)`      | ✅                | ✅                   | ✅              |
| `getLocales(currencyCode)` | ✅                | ✅                   | ✅              |
| `parseBCP47Tag`            | ❌                | ✅                   | ✅ **Enhanced** |
| `generateBCP47Tag`         | ❌                | ✅                   | ✅ **Enhanced** |
| `getBCP47Tags`             | ❌                | ✅                   | ✅ **Enhanced** |
| `isValidBCP47Tag`          | ❌                | ✅                   | ✅ **Enhanced** |

**Status:** We have enhanced BCP 47 support beyond country-data-list.

---

## Summary

### ✅ Fully Supported

- **Countries** - All features + enhanced utilities
- **Currencies** - All features + enhanced utilities
- **BCP 47 / Locale** - Enhanced beyond country-data-list

### ⚠️ Partially Supported

- **Currency Symbol Utilities** - Missing `getSafeNameFromCurrency` and `currencySymbolMap` export

### ❌ Not Supported

- **Languages** - No standalone language data structure
- **Timezones** - No timezone data or utilities
- **Regions/Continents** - No regional/continental data

---

## Recommendations

### Quick Wins (Easy to Add)

1. **Export `currencySymbolMap`** - Just export the existing map
2. **Add `getSafeNameFromCurrency`** - Return code if name not found
3. **Add `getSymbolFromCurrency` alias** - For compatibility

### Medium Effort

4. **Language Data Structure** - Create language lookup utilities (if needed)

### Large Effort (Separate Package?)

5. **Timezones** - Would require IANA database integration
6. **Regions/Continents** - Would require additional data sources
