# Agent Instructions

This file provides guidance to AI coding agents when working with code in this directory.

## Overview

`@visulima/disposable-email-domains` ships a regularly refreshed list of disposable / temporary email domains plus a tiny runtime (`isDisposableEmail`, `areDisposableEmails`) that does case-insensitive, wildcard-aware lookups (subdomains match parent entries) backed by an O(1) `Set`. Nx tag: `category:internationalization`.

## Architecture

- The domain list itself is a **generated** asset, not hand-written. `src/index.ts` reads `dist/domains.json` at runtime via `readFileSync` — do not edit any `domains.json`; regenerate it.
- Regeneration pipeline (`scripts/sync-domains.js`, driven by `DisposableEmailSyncManager`):
    - Pulls from every entry in `scripts/config/repositories.json` (GitHub raw files + a few other sources).
    - **Adds** anything listed in `scripts/config/blacklist.json` — extra disposable domains the upstream sources miss. These survive even if the domain is whitelisted.
    - **Removes** anything listed in `scripts/config/allowlist.json` — legitimate provider domains that upstream lists keep mis-reporting as disposable (Yahoo's regional `yahoo.co.in`, Microsoft's `hotmail.fr`, …). This is the file to extend when triaging a false positive; it beats every source, including `blacklist.json`. Verify a domain is genuine before adding it — its MX records should point at the provider's infrastructure (e.g. `*.yahoodns.net`), which is how the current entries were vetted; typosquats like `yahoo.cu.uk` must stay on the list.
    - Also removes the ~345 well-known providers from `email-providers/common.json`. Note `email-providers/all.json` is **not** usable as a whitelist: it contains thousands of genuinely disposable domains.
    - Renders the per-source stats table with `@visulima/tabular` and rewrites the `START_PLACEHOLDER_CONTRIBUTING` block in `README.md`. The "disposable-domain stats" the root AGENTS.md references are produced here.
- The script is wired into `build` / `build:prod` (`packem build … && pnpm run generate:domains`), so a normal package build also refreshes the JSON and README table. Run `pnpm --filter @visulima/disposable-email-domains run generate:domains` to refresh without a full build.
- Subpath export `./domains` re-exports the raw `dist/domains.json` for consumers who want the array directly.
- `@visulima/tabular` is a `devDependency` (script-only); keep it out of `dependencies` — the published runtime is zero-dependency.

## Related

- `@visulima/email` depends on this package and re-exports the disposable check at `@visulima/email/validation/disposable-email-domains`.
