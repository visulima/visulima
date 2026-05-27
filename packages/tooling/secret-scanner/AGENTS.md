# Agent Instructions

This file provides guidance to AI coding agents when working with code in this directory.

## Overview

`@visulima/secret-scanner` is a Rust port of gitleaks-style secret detection, shipped as a NAPI module with a TypeScript orchestration layer. Bundles ~1,058 rules (gitleaks default + MongoDB Kingfisher + Visulima opt-ins) compiled into `data/ruleset.json` at build time. Public surface (see `src/index.ts`): `scan`, `scanFiles`, `scanString`, `inspectRuleset`, `listRules`, `listRequiredValidators`, `fingerprint`, plus heuristic helpers.

## Architecture

- Native Rust lives in `native/` (separate `Cargo.toml`). JS entry stays in `src/`. The TypeScript layer (`prepare-scan` -> native binding -> `pipeline.postProcess`) is intentionally thin — heavy lifting is in Rust.
- `pnpm build` runs `pnpm run build:rules` first (executes `scripts/build-rules.mjs`, which converts upstream gitleaks + Kingfisher TOML refs into `data/ruleset.json`) and then `packem build`. After any change under `scripts/presets/` or to the `.ref` files, rebuild rules before testing.
- Rule sources tracked via `scripts/gitleaks.ref` and `scripts/kingfisher.ref`. Don't bump those without running `scripts/analyze-overlap.mjs` and `test:parity`.
- Validators (live HTTP checks) and transports live under `src/validator/` and `src/transports/` respectively. Stop-word / entropy / heuristic filters are in `src/heuristics.ts` — keep deterministic behaviour stable so baselines remain valid.
- Optional peer deps (`@aws-sdk/client-sts`, `@azure/storage-blob`, `@grpc/grpc-js`, `google-auth-library`, `mongodb`, `mysql2`, `pg`) are validator transports — import them lazily so the package stays usable without them.
- Source-of-truth `Finding.source` values are `"gitleaks" | "kingfisher" | "visulima" | <user>` — preserve these when routing findings.

## Related

- Consumed by `@visulima/vis` (`packages/tooling/vis`) for `vis scan` / pre-commit hook integration.
