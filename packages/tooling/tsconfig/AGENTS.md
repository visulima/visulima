# Agent Instructions

This file provides guidance to AI coding agents when working with code in this directory.

## Overview

`@visulima/tsconfig` finds, reads, and writes `tsconfig.json` files. It is **not** a shared-TS-config preset package — despite the name, it is a parsing/IO library (think `get-tsconfig` + `find-up`). Public surface (see `src/index.ts`): `findTsConfig[Sync]`, `readTsConfig`, `writeTsConfig[Sync]`, plus the `TsConfigJson` / `TsConfigJsonResolved` / `TsConfigResult` types and the `implicitBaseUrlSymbol` sentinel.

## Architecture

- Handles `extends` resolution (including package-name extends via `resolve-pkg-maps`), JSONC parsing with `jsonc-parser`, trailing commas, and dangling-comma tolerance.
- `src/version-defaults/` encodes TypeScript-version-specific compiler-option defaults (v4–v7) — when bumping the TS catalog version, check whether new defaults need to be added here and registered in `src/version-defaults/index.ts`.
- The `implicitBaseUrlSymbol` is exported so consumers can distinguish a user-set `baseUrl` from one that TypeScript implies from the config's location. Don't strip it during normalisation.

## Testing across TypeScript versions

- Tested against the live TypeScript compiler for parity — keep `lint:types` and `test` both green after changes.
- The suite must pass against **every** supported TS version (5.4 → 7.x), not just the pinned catalog version. Specs that assert behaviour tied to a specific release (a compiler option that did not exist yet, or `--showConfig`/resolution output that changed) are version-gated via `tsAtLeast`/`tsBelow` in `__tests__/helpers.ts` (`it.runIf(...)` / `describe.runIf(...)`). Add a gate rather than a hard assertion when a new divergence appears.
- CI runs the full matrix in `.github/workflows/test-tsconfig-versions.yml` (one leg per TS version, package-scoped).
- **Local multi-version runs:** `pnpm exec` re-links `node_modules/typescript` back to the lockfile version before executing, so a manual symlink swap won't stick. Inject a version with `pnpm --filter "@visulima/tsconfig" add -D typescript@<v>` (what CI does), or invoke vitest as a plain node process (`node node_modules/vitest/vitest.mjs run`) after swapping the symlink.
