# ISO Data Package Research

## Overview

Research on existing npm packages for ISO 3166 (country codes) and ISO 4217 (currency codes) to inform the design of `@visulima/iso-locale`.

## Key Packages Analyzed

### 1. i18n-iso-countries (v7.14.0)

**Purpose:** ISO 3166-1 country codes with internationalization support

**Key Features:**

- ISO 3166-1 support: Alpha-2, Alpha-3, and Numeric codes
- Localization: ~70-80 languages via JSON locale files
- Code conversion utilities (alpha2 ↔ alpha3 ↔ numeric)
- Name lookup (code → name, name → code)
- Validation utilities
- Browser-friendly (register only needed locales)

**API Methods:**

- `getName(code, lang, options?)` - Get country name by code
- `getNames(lang, options?)` - Get all country names for a language
- `getAlpha2Code(name, lang)` - Get Alpha-2 from name
- `getAlpha3Code(name, lang)` - Get Alpha-3 from name
- `alpha2ToAlpha3(alpha2)` - Convert codes
- `alpha3ToAlpha2(alpha3)` - Convert codes
- `numericToAlpha2(numeric)` - Convert codes
- `alpha2ToNumeric(alpha2)` - Convert codes
- `isValid(code)` - Validate code
- `getSupportedLanguages()` - List available locales

**Data Structure:**

- Alpha-2 codes (e.g., "US")
- Alpha-3 codes (e.g., "USA")
- Numeric codes (e.g., "840")
- Localized names (official, aliases, all variants)

---

### 2. currency-codes (v2.2.0)

**Purpose:** ISO 4217 currency code data and lookup utilities

**Key Features:**

- Full ISO 4217 current codes
- Lookup by alphabetic code, numeric code, or country name
- Official source updates (from ISO 4217 XML)
- Includes minor units (decimal digits)

**API Methods:**

- `code(code)` - Lookup by alphabetic code (e.g., "EUR")
- `number(number)` - Lookup by numeric code (e.g., 978)
- `country(countryName)` - Get currencies for a country
- `codes()` - List all alphabetic codes
- `numbers()` - List all numeric codes
- `countries()` - List all country names

**Data Structure:**

```typescript
{
  code: string;        // 3-letter code (e.g., "EUR")
  number: string;      // 3-digit numeric (e.g., "978")
  digits: number;       // Decimal places (e.g., 2)
  currency: string;    // Full name (e.g., "Euro")
  countries: string[]; // Countries using this currency
}
```

**Metadata:**

- `publishDate` - Last ISO 4217 update date

---

### 3. iso-3166 (wooorm)

**Purpose:** Complete ISO 3166 standard implementation

**Key Features:**

- Full ISO 3166: countries (α2, α3, numeric)
- Reserved & user-assigned codes
- Subdivisions (ISO 3166-2)
- Former countries (ISO 3166-3)
- ESModules, TypeScript types

**Pros:** Very complete, rich dataset, mapping utilities
**Cons:** Last updated ~2 years ago

---

### 4. country-kit

**Purpose:** TypeScript library with country data + extras

**Key Features:**

- Alpha-2 & Alpha-3 codes
- Flags, calling codes
- Search & validation utilities
- TypeScript support

**Pros:** Many UI extras, type safety
**Cons:** Larger bundle size, no subdivisions

---

### 5. locale-currency

**Purpose:** Map locale/country codes to ISO 4217 currency codes

**Key Features:**

- Map locale codes to currency codes (ISO 4217)
- Supports multiple formats:
    - BCP 47 tags (e.g., `en-US`, `pt-BR`)
    - i18n-style with underscores (e.g., `en_US`)
    - ISO 3166-1 alpha-2 country codes (e.g., `US`, `GB`)
- Reverse mapping: currency code → list of locales/countries
- Lightweight with simple API

**API Methods:**

- `getCurrency(locale: string): string | null` - Get currency from locale/country code
- `getLocales(currencyCode: string): string[]` - Get all countries using a currency

**Usage:**

```typescript
getCurrency("US"); // 'USD'
getCurrency("en-US"); // 'USD'
getCurrency("zh-Hant-TW"); // 'TWD'
getLocales("EUR"); // ['FR', 'DE', 'ES', ...]
```

**Pros:** Simple, focused API, handles locale formats
**Cons:** Only currency mapping, no country/currency details

---

### 6. country-data-list (country-list)

**Purpose:** Comprehensive library with country, currency, language, and timezone data

**Key Features:**

- **Countries:** Names, ISO codes (alpha-2, alpha-3), currencies, languages, calling codes, IOC codes, emoji flags
- **Currencies:** ISO 4217 codes, names, numbers, decimals, symbols
- **Languages:** ISO 639 codes (alpha-2, alpha-3), bibliographic codes
- **Timezones:** IANA timezone database, UTC offsets, country-timezone mappings
- **Regions & Continents:** Geographical regional data
- **Tree-shakeable:** ES modules with selective imports
- **Zero dependencies:** Lightweight and self-contained
- **TypeScript support:** Full type definitions

**API Structure:**

```typescript
import { countries, currencies, lookup, timezones } from "country-data-list";

// Countries
countries.all; // All countries array
countries["US"]; // Specific country by alpha-2
countries["US"].currencies; // Currencies for country
countries["US"].languages; // Languages for country

// Currencies
currencies["USD"]; // Currency by code
currencies["USD"].symbol; // Currency symbol ($)
currencies["USD"].decimals; // Decimal places

// Timezones
timezones.all; // All timezones
timezones.getTimezonesByCountry("US"); // Timezones for country
timezones.getCountriesForTimezone("Europe/London"); // Countries for timezone
timezones.getUtcOffset("Europe/London"); // UTC offset

// Lookup
lookup.countries("united"); // String search
lookup.countries({ name: "United States" }); // Object search
```

**Currency Symbol Utilities:**

```typescript
import { getNameFromCurrency, getSymbolFromCurrency } from "country-data-list";

getSymbolFromCurrency("USD"); // '$'
getNameFromCurrency("USD"); // 'US Dollar'
```

**Data Structure:**

- **Country:** name, alpha2, alpha3, status, currencies[], languages[], countryCallingCodes[], ioc, emoji
- **Currency:** code, name, number, decimals, symbol
- **Language:** name, alpha2, alpha3, bibliographic

**Pros:** Very comprehensive, tree-shakeable, TypeScript, zero deps, includes timezones
**Cons:** Larger bundle if importing everything (but tree-shakeable)

---

## Comparison Summary

| Feature              | i18n-iso-countries | currency-codes | iso-3166  | country-kit | locale-currency | country-data-list |
| -------------------- | ------------------ | -------------- | --------- | ----------- | --------------- | ----------------- |
| Country Alpha-2      | ✅                 | ❌             | ✅        | ✅          | ✅ (via locale) | ✅                |
| Country Alpha-3      | ✅                 | ❌             | ✅        | ✅          | ❌              | ✅                |
| Country Numeric      | ✅                 | ❌             | ✅        | ❌          | ❌              | ❌                |
| Country Localization | ✅ (70-80 langs)   | ❌             | ❌        | ❌          | ❌              | ❌                |
| Currency Codes       | ❌                 | ✅             | ❌        | ❌          | ✅ (mapping)    | ✅                |
| Currency Numeric     | ❌                 | ✅             | ❌        | ❌          | ❌              | ✅                |
| Currency Minor Units | ❌                 | ✅             | ❌        | ❌          | ❌              | ✅                |
| Currency Symbols     | ❌                 | ❌             | ❌        | ❌          | ❌              | ✅                |
| Locale → Currency    | ❌                 | ❌             | ❌        | ❌          | ✅              | ✅                |
| Currency → Countries | ❌                 | ✅             | ❌        | ❌          | ✅              | ✅                |
| Languages            | ❌                 | ❌             | ❌        | ❌          | ❌              | ✅                |
| Timezones            | ❌                 | ❌             | ❌        | ❌          | ❌              | ✅                |
| Subdivisions         | ❌                 | ❌             | ✅        | ❌          | ❌              | ❌                |
| TypeScript           | Partial            | Moderate       | ✅        | ✅          | ✅              | ✅                |
| Tree-shakeable       | ✅                 | ✅             | ✅        | ✅          | ✅              | ✅                |
| Zero Dependencies    | ✅                 | ✅             | ✅        | ✅          | ✅              | ✅                |
| Browser Support      | ✅                 | ✅             | ✅        | ✅          | ✅              | ✅                |
| Maintenance          | Active             | Active         | ~2yrs old | Active      | Active          | Active            |

---

## Recommended Features for @visulima/iso-locale

Based on the research, here are recommended features:

### Countries (ISO 3166-1)

- [x] Alpha-2 codes (2-letter)
- [x] Alpha-3 codes (3-letter)
- [x] Numeric codes (3-digit)
- [x] Code conversion utilities (alpha2 ↔ alpha3 ↔ numeric)
- [x] Validation utilities
- [x] Indexed maps (byAlpha2, byAlpha3, byNumeric) for fast lookups
- [ ] Localized country names (optional, can be added later)
- [ ] Name → code lookup (optional)

### Currencies (ISO 4217)

- [x] Alphabetic codes (3-letter)
- [x] Numeric codes (3-digit)
- [x] Currency names
- [x] Minor units (decimal digits)
- [x] Country associations (which countries use which currency)
- [x] Lookup by code, number, or country
- [x] Currency symbols (recommended - country-data-list has this)
- [x] Locale → Currency mapping (recommended - locale-currency pattern)
- [x] Indexed maps (byCode, byNumber) for fast lookups
- [x] Validation against Wikipedia ISO 4217 active currency list
- [x] Only active currencies included (deprecated codes removed)

### API Design Considerations

1. **TypeScript-first:** Full type safety with proper types
2. **Tree-shakeable:** ES modules, export individual functions (like country-data-list)
3. **Zero dependencies:** Keep bundle size small
4. **Validation:** Built-in validation utilities
5. **Conversion:** Easy code format conversion
6. **Lookup:** Multiple lookup methods (by code, name, locale, etc.)
7. **Currency Symbols:** Include currency symbols (like country-data-list)
8. **Locale Support:** Map locale/country codes to currencies (like locale-currency)

---

## Data Sources

- **ISO 3166-1:** Official ISO standard for country codes
- **ISO 4217:** Official ISO standard for currency codes
- **Primary Source:** `country-data-list` npm package (comprehensive, well-maintained)
- **Validation:** Wikipedia ISO 4217 active currency list (as of package creation)
- **Data Quality:** All active currencies validated against Wikipedia, includes deprecated codes (MRO, SLL, STD, VEF, etc.) for backward compatibility

---

## Implementation Status

### ✅ Completed

1. ✅ Defined TypeScript interfaces for country and currency data
2. ✅ Sourced ISO 3166-1 country data from `country-data-list`
3. ✅ Sourced ISO 4217 currency data from `country-data-list`
4. ✅ Implemented core lookup and conversion functions
5. ✅ Added validation utilities
6. ✅ Wrote comprehensive tests (27 tests passing)
7. ✅ Validated currency data against Wikipedia ISO 4217 active currency list
8. ✅ Added all missing active currencies (MRU, SLE, STN, SVC, UYW, VED, VES, XAD, XSU, XUA, ZWG)
9. ✅ Fixed decimal places for all currencies to match ISO 4217 standard
10. ✅ Fixed currency number formats (3-digit with leading zeros)
11. ✅ Implemented locale → currency mapping
12. ✅ Added currency symbol support

### 📋 Current API

**Countries:**

- `all` / `countriesAll` - All countries array
- `getByAlpha2(code)` - Get country by alpha-2 code
- `getByAlpha3(code)` - Get country by alpha-3 code
- `getByNumeric(code)` - Get country by numeric code
- `alpha2ToAlpha3(alpha2)` - Convert alpha-2 to alpha-3
- `alpha3ToAlpha2(alpha3)` - Convert alpha-3 to alpha-2
- `alpha2ToNumeric(alpha2)` - Convert alpha-2 to numeric
- `alpha3ToNumeric(alpha3)` - Convert alpha-3 to numeric
- `numericToAlpha2(numeric)` - Convert numeric to alpha-2
- `numericToAlpha3(numeric)` - Convert numeric to alpha-3
- `isValid(code)` - Validate country code
- `byAlpha2`, `byAlpha3`, `byNumeric` - Indexed maps

**Currencies:**

- `all` / `currenciesAll` - All currencies array
- `getByCode(code)` - Get currency by alphabetic code
- `getByNumber(number)` - Get currency by numeric code
- `getByCountry(countryCode)` - Get currencies for a country
- `getCountriesByCurrency(currencyCode)` - Get countries using a currency
- `getSymbol(currencyCode)` - Get currency symbol
- `getName(currencyCode)` - Get currency name
- `isValid(code)` - Validate currency code
- `byCode`, `byNumber` - Indexed maps

**Locale:**

- `getCurrency(locale)` - Get currency from locale/country code
- `getLocales(currencyCode)` - Get all locales using a currency

### 🔮 Future Enhancements (Optional)

1. Localized country names (i18n support)
2. Name → code lookup (search by country/currency name)
3. Historical currency tracking (with dates)
4. Currency conversion rates (would require external data source)
5. Timezone data (like country-data-list)
6. Language data (like country-data-list)
