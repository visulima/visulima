# Agent Instructions

This file provides guidance to AI coding agents when working with code in this directory.

## Overview

`@visulima/free-email-domains` ships a regularly refreshed list of free email service provider domains (Gmail, Yahoo, Outlook, GMX, etc.) plus a tiny runtime (`isFreeEmail`, `areFreeEmails`) that does case-insensitive, wildcard-aware lookups (subdomains match parent entries) backed by an O(1) `Set`. Nx tag: `category:internationalization`.

## Architecture

- The domain list itself is a **generated** asset, not hand-written. `src/index.ts` reads `dist/domains.json` at runtime via `readFileSync` — do not edit any `domains.json`; regenerate it.
- Regeneration pipeline (`scripts/sync-domains.js`, driven by `FreeEmailSyncManager`):
    - Seeds from the bundled `email-providers` dataset (`common.json` + `all.json`) as a deterministic base source, so the list is usable even when every network source fails.
    - Merges every entry in `scripts/config/repositories.json` (GitHub raw files + JSON APIs of free-provider lists).
    - Excludes anything listed in `scripts/config/blacklist.json` (corporate / reserved domains that occasionally leak into upstream free lists — extend this file when triaging false positives instead of editing the output).
    - Renders the per-source stats table with `@visulima/tabular` and rewrites the `START_PLACEHOLDER_CONTRIBUTING` block in `README.md`.
- The script is wired into `build` / `build:prod` (`packem build … && pnpm run generate:domains`), so a normal package build also refreshes the JSON and README table. Run `pnpm --filter @visulima/free-email-domains run generate:domains` to refresh without a full build.
- Subpath export `./domains` re-exports the raw `dist/domains.json` for consumers who want the array directly.
- `@visulima/tabular` and `email-providers` are `devDependencies` (script-only); keep them out of `dependencies` — the published runtime is zero-dependency.

## Related

- `@visulima/disposable-email-domains` is the sibling package for disposable / temporary email domains.
- `@visulima/email-verifier` consumes this list to flag free-provider addresses.
