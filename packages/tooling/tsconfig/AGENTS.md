# Agent Instructions

This file provides guidance to AI coding agents when working with code in this directory.

## Overview

`@visulima/tsconfig` finds, reads, and writes `tsconfig.json` files. It is **not** a shared-TS-config preset package — despite the name, it is a parsing/IO library (think `get-tsconfig` + `find-up`). Public surface (see `src/index.ts`): `findTsConfig[Sync]`, `readTsConfig`, `writeTsConfig[Sync]`, plus the `TsConfigJson` / `TsConfigJsonResolved` / `TsConfigResult` types and the `implicitBaseUrlSymbol` sentinel.

## Architecture

- Handles `extends` resolution (including package-name extends via `resolve-pkg-maps`), JSONC parsing with `jsonc-parser`, trailing commas, and dangling-comma tolerance.
- `src/version-defaults/` encodes TypeScript-version-specific compiler-option defaults — when bumping the TS catalog version, check whether new defaults need to be added here.
- The `implicitBaseUrlSymbol` is exported so consumers can distinguish a user-set `baseUrl` from one that TypeScript implies from the config's location. Don't strip it during normalisation.
- Tested against the live TypeScript compiler for parity — keep `lint:types` and `test` both green after changes.
