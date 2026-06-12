# Agent Instructions

This file provides guidance to AI coding agents when working with code in this directory.

## Overview

`@visulima/content-safety` detects banned words in user-supplied text across 19 languages. The public surface (`checkBannedWords`, `censorText`, `createChecker`, `BANNED_WORDS`, plus the `BannedWordMatch`, `BannedWordsResult`, `CheckOptions`, `CensorOptions`, `BannedWordEntry`, `BannedWordDictionary`, `Checker`, and `CreateCheckerOptions` types) is intentionally small — see `src/index.ts`.

## Architecture

- Word lists live in `src/words/<lang>.ts` (one file per language code: `ar`, `az`, `de`, `en`, `es`, `fa`, `fr`, `ga`, `hi`, `it`, `ja`, `ko`, `nl`, `pl`, `pt`, `ru`, `sv`, `tr`, `zh`). To add a language, drop a new file here and wire it into `src/banned-words.ts`.
- `src/checker.ts` holds the matching logic. Lookups use Map/Set tables (not regex alternations) built lazily on first `check`/`censor` and cached for the checker's lifetime; CJK entries are bucketed by first character for a single-pass scan. Keep the lazy build and the bucketing — tests rely on ~1-2ms throughput.
- Pure TypeScript, zero runtime dependencies. Must remain compatible with Node, browsers, and edge runtimes — do not import from `node:*` modules.
- Word lists are sensitive content. `secretlint` runs in the commit hook; if it flags a slur as a "secret", confirm with the user before adding bypass comments.
