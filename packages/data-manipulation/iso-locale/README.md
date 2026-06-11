<!-- START_PACKAGE_OG_IMAGE_PLACEHOLDER -->

<a href="https://www.anolilab.com/open-source" align="center">

  <img src="__assets__/package-og.svg" alt="iso-locale" />

</a>

<h3 align="center">ISO data for countries, currencies, regions, timezones, and BCP 47 locale support.</h3>

<!-- END_PACKAGE_OG_IMAGE_PLACEHOLDER -->

<br />

<div align="center">

[![typescript-image][typescript-badge]][typescript-url]
[![mit licence][license-badge]][license]
[![npm downloads][npm-downloads-badge]][npm-downloads]
[![Chat][chat-badge]][chat]
[![PRs Welcome][prs-welcome-badge]][prs-welcome]

</div>

---

<div align="center">
    <p>
        <sup>
            Daniel Bannert's open source work is supported by the community on <a href="https://github.com/sponsors/prisis">GitHub Sponsors</a>
        </sup>
    </p>
</div>

---

## Install

```sh
npm install @visulima/iso-locale
```

```sh
yarn add @visulima/iso-locale
```

```sh
pnpm add @visulima/iso-locale
```

## Usage

### Countries

```typescript
import { getByAlpha2, getCountry, getCountryByName, getCountryName, getEmoji, getCallingCode, getLanguages } from "@visulima/iso-locale";

// Get country by code
const country = getByAlpha2("US");
console.log(country.name); // "United States"

// Get country by ANY code format (alpha-2, alpha-3, or numeric)
console.log(getCountry("US")?.name); // "United States"
console.log(getCountry("USA")?.name); // "United States"

// Get country by name
const country2 = getCountryByName("United States");

// Get flag emoji
console.log(getEmoji("US")); // "🇺🇸"

// Get calling code
console.log(getCallingCode("US")); // "+1"

// Get languages
console.log(getLanguages("US")); // ["eng"]

// Localized country name (uses the runtime Intl.DisplayNames API)
console.log(getCountryName("DE", "fr")); // "Allemagne"
console.log(getCountryName("US")); // "United States"
```

### Strongly-typed codes

The country and currency code unions are derived directly from the bundled
datasets, so consumers get autocomplete and compile-time validation for free:

```typescript
import type { Alpha2Code, Alpha3Code, CurrencyCode } from "@visulima/iso-locale";

const region: Alpha2Code = "US"; // ✅
const wrong: Alpha2Code = "ZZ"; // ❌ compile error
const money: CurrencyCode = "EUR"; // ✅
```

### Currencies

```typescript
import { getByCode, getSymbol, getByCountry, getCountriesByCurrency } from "@visulima/iso-locale";

// Get currency by code
const currency = getByCode("USD");
console.log(currency.name); // "United States dollar"
console.log(currency.symbol); // "$"

// Get currency symbol
console.log(getSymbol("USD")); // "$"

// Get currencies for a country
const currencies = getByCountry("US");
console.log(currencies[0].code); // "USD"

// Get countries using a currency
const countries = getCountriesByCurrency("EUR");
console.log(countries); // ["FR", "DE", "ES", ...]
```

### Regions

```typescript
import { getRegionsForCountry, getCountriesInContinent, getCountriesInSubregion } from "@visulima/iso-locale";

// Get region for a country
const region = getRegionsForCountry("US");
console.log(region.continent); // "Americas"
console.log(region.subregion); // "Northern America"

// Get countries in a continent
const africanCountries = getCountriesInContinent("Africa");

// Get countries in a subregion
const westernEurope = getCountriesInSubregion("Western Europe");
```

### Timezones

```typescript
import { getTimezonesByCountry, getPrimaryTimezone, getCountriesForTimezone } from "@visulima/iso-locale";

// Get timezones for a country
const timezones = getTimezonesByCountry("US");
console.log(timezones);
// ["America/New_York", "America/Los_Angeles", ...]

// Get primary timezone
console.log(getPrimaryTimezone("GB")); // "Europe/London"

// Get countries using a timezone
const countries = getCountriesForTimezone("Europe/London");
```

### Locale & BCP 47

```typescript
import { getCurrency, getBCP47Tags, parseBCP47Tag, generateBCP47Tag } from "@visulima/iso-locale";

// Get currency from locale
console.log(getCurrency("en-US")); // "USD"
console.log(getCurrency("pt-BR")); // "BRL"

// Get BCP 47 tags for a country
console.log(getBCP47Tags("CA")); // ["en-CA", "fr-CA"]

// Parse BCP 47 tag
const parsed = parseBCP47Tag("zh-Hant-TW");
console.log(parsed);
// { language: "zh", script: "Hant", country: "TW" }

// Generate BCP 47 tag (script subtags are canonicalized to title case)
console.log(generateBCP47Tag("en", "US")); // "en-US"
console.log(generateBCP47Tag("zh", "TW", "hant")); // "zh-Hant-TW"
```

### Languages

```typescript
import { getCountriesByLanguage, getLanguageName } from "@visulima/iso-locale";

// Reverse lookup: which countries use a language (accepts ISO 639-1 or 639-3)
console.log(getCountriesByLanguage("de")); // ["AT", "BE", "CH", "DE", "LI", ...]

// Localized language name (uses the runtime Intl.DisplayNames API)
console.log(getLanguageName("de", "fr")); // "allemand"
```

## Subpath entrypoints

Every domain is also available as a focused entrypoint, so you can import only
the dataset you need and let bundlers tree-shake the rest:

| Import | Contents |
| ------ | -------- |
| `@visulima/iso-locale` | Aggregate barrel re-exporting everything below |
| `@visulima/iso-locale/countries` | ISO 3166-1 country lookups + `Alpha2Code`/`Alpha3Code` |
| `@visulima/iso-locale/currencies` | ISO 4217 currency lookups + `CurrencyCode` |
| `@visulima/iso-locale/locale` | BCP 47 helpers, `getCurrency`, `getLanguageName` |
| `@visulima/iso-locale/regions` | UN M.49 region helpers |
| `@visulima/iso-locale/timezones` | IANA timezone helpers |
| `@visulima/iso-locale/types` | Shared TypeScript interfaces |

```typescript
// Only pulls in the currency dataset, not countries/regions/timezones
import { getByCode, getSymbol } from "@visulima/iso-locale/currencies";
```

## Related

## Supported Node.js Versions

Libraries in this ecosystem make the best effort to track [Node.js’ release schedule](https://github.com/nodejs/release#release-schedule).
Here’s [a post on why we think this is important](https://medium.com/the-node-js-collection/maintainers-should-consider-following-node-js-release-schedule-ab08ed4de71a).

## Contributing

If you would like to help take a look at the [list of issues](https://github.com/visulima/visulima/issues) and check our [Contributing](https://github.com/visulima/visulima/blob/main/.github/CONTRIBUTING.md) guidelines.

> **Note:** please note that this project is released with a Contributor Code of Conduct. By participating in this project you agree to abide by its terms.

## Credits

- [Daniel Bannert](https://github.com/prisis)
- [All Contributors](https://github.com/visulima/visulima/graphs/contributors)

## Made with ❤️ at Anolilab

This is an open source project and will always remain free to use. If you think it's cool, please star it 🌟. [Anolilab](https://www.anolilab.com/open-source) is a Development and AI Studio. Contact us at [hello@anolilab.com](mailto:hello@anolilab.com) if you need any help with these technologies or just want to say hi!

## License

The visulima iso-locale is open-sourced software licensed under the [MIT][license]

<!-- badges -->

[license-badge]: https://img.shields.io/npm/l/@visulima/iso-locale?style=for-the-badge
[license]: https://github.com/visulima/visulima/blob/main/LICENSE
[npm-downloads-badge]: https://img.shields.io/npm/dm/@visulima/iso-locale?style=for-the-badge
[npm-downloads]: https://www.npmjs.com/package/@visulima/iso-locale
[prs-welcome-badge]: https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=for-the-badge
[prs-welcome]: https://github.com/visulima/visulima/blob/main/.github/CONTRIBUTING.md
[chat-badge]: https://img.shields.io/discord/932323359193186354.svg?style=for-the-badge
[chat]: https://discord.gg/TtFJY8xkFK
[typescript-badge]: https://img.shields.io/badge/Typescript-294E80.svg?style=for-the-badge&logo=typescript
[typescript-url]: https://www.typescriptlang.org/
