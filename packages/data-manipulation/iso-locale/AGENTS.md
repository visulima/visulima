# Agent Instructions

This file provides guidance to AI coding agents when working with code in this directory.

## Overview

`@visulima/iso-locale` is a zero-dependency lookup library for ISO 3166 (countries), ISO 4217 (currencies), ISO 639 (languages), IANA timezones, UN M.49 regions, and BCP 47 locale tags. It exposes both convenience lookups and the raw datasets.

## Architecture

- **Multiple sub-entries** (declared in `package.json` `exports`):
  - `.` — aggregate barrel (`src/index.ts`)
  - `./countries`, `./currencies`, `./locale`, `./regions`, `./timezones`, `./types` — focused entrypoints that map 1:1 to `src/<name>.ts`
- Source datasets live in `src/data/`: `countries.ts`, `currencies.ts`, `currency-symbol.ts`, `iso-639-mapping.ts`, `regions.ts`, `timezones.ts`. These are large hand-authored TypeScript arrays — when updating ISO data, edit the data file and let the per-module functions (`getByAlpha2`, `byCode`, `getCountriesForTimezone`, etc.) consume them unchanged.
- The index re-exports both renamed (`countriesAll`, `currenciesAll`) and original (`countries`, `currencies`) bindings on purpose — keep both for backwards compatibility.
- `isValid` is exported twice (once unprefixed, plus `isValidCountry` / `isValidCurrency`) — don't deduplicate.
- BCP 47 helpers (`parseBCP47Tag`, `generateBCP47Tag`, `getBCP47Tags`, `isValidBCP47Tag`) all live in `src/locale.ts`.
