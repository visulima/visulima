# Agent Instructions

This file provides guidance to AI coding agents when working with code in this directory.

## Overview

`@visulima/yaml` is a fast, zero-runtime-dependency YAML 1.2 parser and serializer written from scratch in TypeScript. It exposes two compatible API surfaces:

- The `yaml`-style API: `parse` / `stringify`.
- The `js-yaml`-style API: `load` / `dump` (thin aliases with option-name mapping).

## Architecture

The pipeline lives entirely in `src/`:

- `src/parser/loader.ts` — the recursive-descent parser/composer. A single mutable cursor (`State`) walks the source string, threads indentation columns through the block parsers, resolves anchors/aliases, applies merge keys (`<<`), and produces native JS values directly (no intermediate CST on the default path). Exports `loadOne` / `loadAll`.
- `src/parser/dumper.ts` — value → YAML serializer with automatic scalar-style selection (plain / single / double / literal / folded), block and flow output, and configurable indentation, key sorting, quoting and `lineWidth` folding. Long plain single-line strings are wrapped into a folded (`>-`) block scalar at `lineWidth` (default 80; `0` disables) — only when the value is single-spaced words, so folding always round-trips. Exports `dump`.
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

## Conformance (official yaml-test-suite)

`__tests__/conformance.test.ts` runs the official [yaml-test-suite](https://github.com/yaml/yaml-test-suite) (vendored as the `yaml-test-suite` npm dev dependency) — 350 files / 402 cases. The default (strict) mode passes the **entire suite — 402/402 (100%)**; the opt-out `strict: false` mode passes **396/402 (98.5%)**, deliberately re-accepting six spec-violating fail-tests to match `js-yaml`'s leniency. `conformance.test.ts` runs `describe.each` over both modes and each is a **regression gate**: it fails if that mode's pass count drops (`EXPECTED_PASS` / `EXPECTED_PASS_LOOSE`), if a currently-passing file starts failing, or if a `KNOWN_FAILING*` entry becomes stale.

`strict: false` re-accepts the six fail-tests both `yaml` and `js-yaml` are lenient about: `4JVG` (two anchors on one node), `9KBC`/`CXX2` (block collection on the `---` line), `H7J7` (under-indented node property), `S98Z` (block-scalar leading-empty-line indentation), and `Y79Y` (a tab-only line inside a block scalar). Strict rejects all of these, and additionally handles the tag+anchor-in-either-order-on-a-key case (`9KAX`) and nested complex keys (`4FJ6`) that js-yaml itself throws on.

## Strict mode (`strict`, default `true`)

The parser always rejects the unambiguous spec violations (tabs as indentation, malformed directives, deficient indentation, comments not separated by white space), matching the `yaml` reference. Strict mode — **on by default** — additionally rejects the extra corner cases that **both** `yaml` and `js-yaml` are lenient about:

- a node property (anchor/tag) carried onto a new line but indented no deeper than its parent key (`key: &a\n!!map\n  a: b`) — checked in `composeNode`'s property loop;
- a **block** mapping or sequence whose first key/entry sits on the `---` line (`--- a: b`), while a flow collection or scalar there stays valid (`--- {a: b}`, `--- a`) — tracked via `State.documentMarkerLine` and enforced at the point `readBlockMapping` / `readBlockSequence` actually detect an entry (not at entry, since those readers also run speculatively for scalars);
- two anchors (or two tags) on a single node (`top: &a\n  &b val`) — a repeated property token on a new line is only valid when it turned out to be the first property of a nested mapping/sequence key (`repeatedPropertyOnNewLine`, checked against `state.kind` after content is read);
- a block scalar whose leading empty lines are indented more than its first content line (`> \n  \n   \n # x`), and a tab used in block-scalar indentation.

Two composeNode speculations make the property cases work: reading node properties then trying a block mapping both from the _first_ property (`tryReadBlockMappingFromProperty`, for `&anchor key: value`) and from a _later_ new-line property (the inline block in `composeNode`, for `!!map\n&a !!str key: value`). Both are wrapped so a throw during speculation rolls back instead of failing the parse.

`strict: false` relaxes exactly these checks (closer to `js-yaml`) and nothing else — it never changes the value of an accepted document, only whether these malformed inputs throw. See `__tests__/strict.test.ts`.

## Parity with `yaml` and `js-yaml`

A differential corpus (135 inputs run through all three parsers) shows:

- **~119/135 produce output identical to _both_ `yaml` and `js-yaml`.**
- **~13** are cases where `yaml` and `js-yaml` **disagree with each other** — genuine schema forks, not bugs — and we match one of them. We deliberately follow strict YAML 1.2 core (matching `yaml`) for:
    - `0b…` binary ints, `1_000` underscores, `010` leading-zero octal, sexagesimals → **strings** (js-yaml resolves them as 1.1 numbers).
    - timestamps (`2001-12-15T…`, `2002-12-14`) → **strings** (js-yaml → `Date`).
    - unknown/custom tags (`!foo bar`) → keep the value (js-yaml throws).
    - We follow **js-yaml** for merge keys (`<<`), which are enabled by default (`yaml` v2 requires `merge: true`).

### Known divergences from BOTH (intentional / accepted, do not "fix" without care)

- **Tabs used as block indentation** (`a:\n\t- 1`) are now rejected, matching both refs. The parser tracks `State.firstTabInLine` (the first tab in a line's leading white space, reset on every line break) and `readBlockSequence` / `readBlockMapping` refuse to start — or throw "tab characters must not be used in indentation" — when it is set. Tabs stay legal in scalar content, after `:`, in flow, and in blank lines, because those paths never consult `firstTabInLine`.
- **A node property inline before a block mapping on the same line** (`&anchor key: value`, `!!str a: b`) is now parsed as a mapping, matching both refs. The parser ports js-yaml's snapshot/rewind mechanism (`snapshotState` / `tryReadBlockMappingFromProperty` in `loader.ts`): after reading node properties it speculatively tries a block mapping and, if that fails, rewinds to re-read the value as a tagged/anchored scalar — so tagged scalars like `!!str 123` / `!foo 123` keep their pre-tag semantics. Do not remove the rewind without re-verifying the differential corpus.
