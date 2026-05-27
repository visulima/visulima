# Agent Instructions

This file provides guidance to AI coding agents when working with code in this directory.

## Overview

`@visulima/humanizer` formats and parses human-readable durations and byte sizes. Public entry (`src/index.ts`) exposes `formatBytes` / `parseBytes` (`src/bytes.ts`), `duration` (`src/duration.ts`), and `parseDuration` (`src/parse-duration.ts`).

## Architecture

- **Sub-exports**: `./language/*` maps to `src/language/<code>.ts` — one duration-language file per locale (60+ languages: `en`, `de`, `fr`, `ja`, `zh_CN`, `zh_TW`, `sr_Latn`, `uz_CYR`, etc.). To add a locale, add a `src/language/<code>.ts` file following the existing schema; no central registry needs updating.
- `src/language/util/create-duration-language.ts` and `validate-duration-language.ts` are the helpers used when constructing/checking new language packs — prefer them when authoring locales.
- Byte parsing distinguishes SI vs IEC units; the regex prefixes (`KIBI`, `MIBI`, `GIBI`, etc.) in `src/bytes.ts` are load-bearing — don't rename without updating tests.
- `@types/ms` and `ms` are devDependencies used as parity benchmarks for `parseDuration`, not runtime deps.
- `project.json` declares an implicit Nx dependency on `filesystem/path` — Nx graph behaviour, not a runtime import.
