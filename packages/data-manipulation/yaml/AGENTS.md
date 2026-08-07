# Agent Instructions

This file provides guidance to AI coding agents when working with code in this directory.

## Overview

`@visulima/yaml` is a fast, zero-runtime-dependency YAML 1.2 parser and serializer written from scratch in TypeScript. It exposes two compatible API surfaces:

- The `yaml`-style API: `parse` / `stringify`.
- The `js-yaml`-style API: `load` / `dump` (thin aliases with option-name mapping).

## Architecture

The pipeline lives entirely in `src/`:

- `src/parser/loader.ts` — the recursive-descent parser/composer. A single mutable cursor (`State`) walks the source string, threads indentation columns through the block parsers, resolves anchors/aliases, applies merge keys (`<<`), and produces native JS values directly (no intermediate CST on the default path). Exports `loadOne` / `loadAll`.
- `src/parser/dumper.ts` — value → YAML serializer with automatic scalar-style selection (plain / single / double / literal), block and flow output, and configurable indentation, key sorting and quoting. Exports `dump`.
- `src/schema/resolve-scalar.ts` — YAML 1.2 **core schema** scalar resolution (`null`, `bool`, `int` in dec/hex/oct, `float`, `.inf`/`.nan`) plus explicit-tag (`!!int`, `!!str`, …) application.
- `src/errors.ts` — `YAMLError`, `YAMLParseError`, `YAMLStringifyError`, `YAMLWarning` carrying a `{ line, column, position }` mark and a source snippet.
- `src/types.ts` — `ParseOptions` / `StringifyOptions`.
- `src/index.ts` — public barrel (`parse`, `parseAll`, `stringify`, plus the `js-yaml` aliases `load`, `loadAll`, `dump`).

## Conventions

- **Zero runtime dependencies.** Everything is hand-rolled — do not add a parser/lexer dependency.
- Keep `parse`/`load` and `stringify`/`dump` behaviourally aligned with the upstream packages they shadow; when in doubt, match `yaml@2` semantics for the native API and `js-yaml@4` for the alias API.
- Tests live in `__tests__/`. Spec-conformance and regression cases adapted from `yaml` and `js-yaml` sit alongside Visulima-specific tests.
- Benchmarks live in `__bench__/` (private workspace package) and compare against `yaml` and `js-yaml` via `vitest bench`.

## Gotchas

- YAML is indentation-sensitive: the parser threads a required-indentation column through block parsing. Changing how blank lines / comments are consumed can silently break nested collections — always run the full `__tests__` suite after tokenizer edits.
- The core-schema number regexes are intentionally strict (YAML 1.2, not 1.1) — `yes`/`no`/`on`/`off` are **not** booleans. Do not "helpfully" widen them.

## Parity with `yaml` and `js-yaml`

A differential corpus (135 inputs run through all three parsers) shows:

- **~119/135 produce output identical to _both_ `yaml` and `js-yaml`.**
- **~13** are cases where `yaml` and `js-yaml` **disagree with each other** — genuine schema forks, not bugs — and we match one of them. We deliberately follow strict YAML 1.2 core (matching `yaml`) for:
  - `0b…` binary ints, `1_000` underscores, `010` leading-zero octal, sexagesimals → **strings** (js-yaml resolves them as 1.1 numbers).
  - timestamps (`2001-12-15T…`, `2002-12-14`) → **strings** (js-yaml → `Date`).
  - unknown/custom tags (`!foo bar`) → keep the value (js-yaml throws).
  - We follow **js-yaml** for merge keys (`<<`), which are enabled by default (`yaml` v2 requires `merge: true`).

### Known divergences from BOTH (intentional / accepted, do not "fix" without care)

- **Tabs used as block indentation** (`a:\n\t- 1`) are accepted; both refs reject them. We are deliberately lenient here — correct tab-in-indentation rejection is easy to get wrong (tabs are legal in scalar content, after `:`, and in flow), so it is left until it can be done without false positives.
- **A node property inline before a block mapping on the same line** (`&anchor key: value`) currently throws; both refs parse it as a mapping. The naive fix (re-enabling block collections after an inline property) routes tagged scalars like `!!str 123` / `!foo 123` back through `readBlockMapping`, which resolves them **before** the tag applies and corrupts the value. Any real fix must preserve tagged-scalar semantics — verify against the differential corpus before shipping.
