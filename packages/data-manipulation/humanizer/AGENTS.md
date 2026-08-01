# Agent Instructions

This file provides guidance to AI coding agents when working with code in this directory.

## Overview

`@visulima/humanizer` formats and parses human-readable durations and byte sizes. Public entry (`src/index.ts`) exposes `formatBytes` / `parseBytes` (`src/bytes.ts`), `duration` (`src/duration.ts`), and `parseDuration` (`src/parse-duration.ts`).

## Architecture

- **Sub-exports**: `./language/*` maps to `src/language/<code>.ts` — one duration-language file per locale (60+ languages: `en`, `de`, `fr`, `ja`, `zh_CN`, `zh_TW`, `sr_Latn`, `uz_CYR`, etc.). To add a locale, add a `src/language/<code>.ts` file following the existing schema; no central registry needs updating.
- `src/language/util/create-duration-language.ts` and `validate-duration-language.ts` are the helpers used when constructing/checking new language packs — prefer them when authoring locales.
- Byte parsing distinguishes SI vs IEC units. `parseBytes` resolves a suffix against the `units` table first and against the other tables in `BYTE_SIZES` afterwards, so IEC input parses under every `units` setting. A matched IEC suffix scales by 1024 regardless of `base`; SI suffixes follow `base`. Don't reintroduce a spelling normalization (`KiB` → `KB`) ahead of the lookup — that is what used to make `units: "iec"` return `NaN` for IEC input.
- `parseDuration`'s piece grammar accepts the `", "` delimiter `duration()` emits by default. The comma is only tolerated _between_ matched pieces, after `decimalRewrite`/`groupStrip` have normalized in-number separators, so it can never be mistaken for a decimal or grouping mark.
- `duration()`'s `conjunction` is caller-supplied and lives in no language pack, so `parseDuration` can only accept it when the caller passes the same string back via `options.conjunction` (`humanizer()` forwards it). Don't replace that with a built-in word list — guessing "and"/"et"/"und" would silently mis-parse real content. The option widens the between-pieces gap by exactly that one word plus an optional leading `serialComma` comma; everything else stays rejected.
- `@types/ms` and `ms` are devDependencies used as parity benchmarks for `parseDuration`, not runtime deps.
- `project.json` declares an implicit Nx dependency on `filesystem/path` — Nx graph behaviour, not a runtime import.
