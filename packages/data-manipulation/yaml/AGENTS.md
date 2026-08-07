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
- `src/schema/schemas.ts` — scalar resolution per schema (`core`, `failsafe`, `json`, `yaml-1.1`). The resolver is chosen once per parse from `schema`/`version`, so the per-scalar path stays a single indirect call and the default keeps its fast path.
- `src/schema/resolve-scalar.ts` — YAML 1.2 **core schema** scalar resolution (`null`, `bool`, `int` in dec/hex/oct, `float`, `.inf`/`.nan`) plus explicit-tag (`!!int`, `!!str`, …) application.
- `src/errors.ts` — `YAMLError`, `YAMLParseError`, `YAMLStringifyError`, `YAMLWarning` carrying a `{ line, column, position }` mark and a source snippet.
- `src/types.ts` — `ParseOptions` / `StringifyOptions`.
- `src/document.ts` — the document layer. `parseDocument` / `parseAllDocuments` report diagnostics instead of throwing, and `setIn` edits by **splicing the original source** rather than re-serializing, so comments, blank lines and key order survive. Edits need source spans, which `loader.ts` records into `State.mappingRanges` **only when that field is set** — the plain `parse` path never pays for it.
- `src/parser/ranges.ts` — the span types, in their own module so `document.ts` can use them without dragging the `State` class into the published `.d.ts` (it is not isolated-declarations clean).
- `src/index.ts` — public barrel (`parse`, `parseAll`, `stringify`, plus the `js-yaml` aliases `load`, `loadAll`, `dump`).

## Conventions

- **Zero runtime dependencies.** Everything is hand-rolled — do not add a parser/lexer dependency.
- Keep `parse`/`load` and `stringify`/`dump` behaviourally aligned with the upstream packages they shadow; when in doubt, match `yaml@2` semantics for the native API and `js-yaml@4` for the alias API.
- Tests live in `__tests__/`. Spec-conformance and regression cases adapted from `yaml` and `js-yaml` sit alongside Visulima-specific tests.
- Benchmarks live in `__bench__/` (private workspace package) and compare against `yaml` and `js-yaml` via `vitest bench`.

## Gotchas

- YAML is indentation-sensitive: the parser threads a required-indentation column through block parsing. Changing how blank lines / comments are consumed can silently break nested collections — always run the full `__tests__` suite after tokenizer edits.
- The **core**-schema number regexes are intentionally strict (YAML 1.2, not 1.1) — `yes`/`no`/`on`/`off` are **not** booleans there. Do not "helpfully" widen them; the 1.1 behaviour lives in the opt-in `yaml-1.1` schema instead (`src/schema/schemas.ts`).
- Schema resolvers run per plain scalar on untrusted input, so they avoid regexes with a trailing catch-all group — the timestamp parser is a hand-written scanner for exactly that reason.

## Conformance (official yaml-test-suite)

`__tests__/conformance.test.ts` runs the official [yaml-test-suite](https://github.com/yaml/yaml-test-suite) (vendored as the `yaml-test-suite` npm dev dependency) — 350 files / 402 cases. The default (strict) mode passes the **entire suite — 402/402 (100%)**; the opt-out `strict: false` mode passes **396/402 (98.5%)**, deliberately re-accepting six spec-violating fail-tests to match `js-yaml`'s leniency. `conformance.test.ts` runs `describe.each` over both modes and each is a **regression gate**: it fails if that mode's pass count drops (`EXPECTED_PASS` / `EXPECTED_PASS_LOOSE`), if a currently-passing file starts failing, or if a `KNOWN_FAILING*` entry becomes stale.

`strict: false` re-accepts the six fail-tests both `yaml` and `js-yaml` are lenient about: `4JVG` (two anchors on one node), `9KBC`/`CXX2` (block collection on the `---` line), `H7J7` (under-indented node property), `S98Z` (block-scalar leading-empty-line indentation), and `Y79Y` (a tab-only line inside a block scalar). Strict rejects all of these, and additionally handles the tag+anchor-in-either-order-on-a-key case (`9KAX`) and nested complex keys (`4FJ6`) that js-yaml itself throws on.

## Strict mode (`strict`, default `true`)

The parser always rejects the unambiguous spec violations (tabs as indentation, malformed directives, deficient indentation, comments not separated by white space), matching the `yaml` reference. Strict mode — **on by default** — additionally rejects the extra corner cases that **both** `yaml` and `js-yaml` are lenient about:

- a node property (anchor/tag) carried onto a new line but indented no deeper than its parent key (`key: &a\n!!map\n  a: b`) — checked in `composeNode`'s property loop;
- a **block** mapping or sequence whose first key/entry sits on the `---` line (`--- a: b`), while a flow collection or scalar there stays valid (`--- {a: b}`, `--- a`) — tracked via `State.documentMarkerLine` and enforced at the point `readBlockMapping` / `readBlockSequence` actually detect an entry (not at entry, since those readers also run speculatively for scalars);
- two anchors (or two tags) on a single node (`top: &a\n  &b val`) — a repeated property token on a new line is only valid when it turned out to be the first property of a nested mapping/sequence key (`repeatedPropertyOnNewLine`, checked against `state.kind` after content is read);
- a block scalar whose leading empty lines are indented more than its first content line (`> \n  \n   \n # x`), and a tab used in block-scalar indentation.

Both property cases route through one helper, `speculateBlockMapping`: it tries a block mapping either from the _first_ property (rewinding to the `propertyStart` snapshot, for `&anchor key: value`) or from the current position (for `!!map\n&a !!str key: value`). On failure it rolls back the cursor, the anchor map and the alias budget together (`beginSpeculation` / `rollbackSpeculation`) — anchors are restored by swapping in a copy of the map rather than by journalling each write, so `state.anchorMap.set` on the hot path stays branch-free. The helper only swallows `YAMLParseError`; anything else (a bug, a `RangeError`) propagates rather than being disguised as a failed guess.

`strict: false` relaxes exactly these checks (closer to `js-yaml`) and nothing else — it never changes the value of an accepted document, only whether these malformed inputs throw. See `__tests__/strict.test.ts`.

## Document layer

Error recovery is **per document, not within one**: `loadDocuments` catches a document's `YAMLParseError`, records it, resyncs to the next `---`/`...` marker and carries on. Inside a single document the first error still ends it, because the parser has no resync points — so `parseDocument` reports at most one error while `parseAllDocuments` reports one per document.

`setIn` only edits block mappings. A path through a flow collection or a sequence throws, because there is no unambiguous place to splice. When splicing, spans are trimmed back over trailing whitespace (`trimTrailingSpace`) — a node's recorded end runs past the spaces before a trailing comment and past the file's final newline, and splicing at the raw end would eat both.

## Node model (`src/nodes/`)

`Scalar`, `YAMLMap`, `YAMLSeq`, `Pair`, `Alias`, the `isX` guards, `createNode`, `toJS` and `visit`, mirroring `yaml`'s.

**`parse` never builds this.** The single-pass native-value path is where the speed comes from, so the tree is a separate opt-in structure — building it from `parse` would erase the package's reason to exist. Anything that needs the tree (styles, anchors on nodes, generic traversal) goes through the node API instead.

Two constraints that shaped it:

- Node kind is a plain `kind: NodeKindName` field, not a symbol brand and not `instanceof`. Guards therefore keep working across module instances, and the type survives `isolatedDeclarations`, which the `.d.ts` build enforces — a computed symbol key does not.
- `visit` passes a `replace` callback down so a visitor returning a node writes into the parent's slot. Without it the replacement updated only a local variable and the tree was left untouched.

## Hardening invariants (do not regress)

These each fixed a reproduced defect; `__tests__/hardening.test.ts` guards them.

- **Every mapping write goes through `assignMappingKey`**, including merge keys (`<<`). `__proto__` is defined as an own data property rather than assigned, so a document can never reach the prototype chain; routing merges around this is what previously let `<<` bypass the guard entirely.
- **Options spread before the `??` defaults**, never after — otherwise a key that is present but `undefined` silently disables the alias limit, duplicate-key error, strict mode and the pollution guard.
- **Scans must terminate on the character they mean**, not on `position < length`. Accepting the `\0` sentinel as a terminator advances the cursor to `length`, where `charCodeAt` returns `NaN`, which every `ch !== 0` loop treats as content — an unterminated `!<` tag hung the process forever.
- **`composeNode` recursion is bounded by `options.maxDepth`** so deep nesting throws a `YAMLParseError` rather than a `RangeError` outside the error hierarchy.
- **The block writers and `writeNode` must agree on flow-vs-block** for a node — both ask `rendersAsFlow`. They previously disagreed by one level, splicing a block collection inline and silently corrupting output at `flowLevel > 0`.
- **No unanchored `/x+$/`-style regex on serializer input.** `/\n+$/` retried at every offset (quadratic); trailing newlines are stripped with a backward scan.

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
- **A node property inline before a block mapping on the same line** (`&anchor key: value`, `!!str a: b`) is parsed as a mapping, matching both refs, via the `snapshotState` / `speculateBlockMapping` rewind described above: after reading node properties the loader speculatively tries a block mapping and, if that fails, rewinds to re-read the value as a tagged/anchored scalar — so tagged scalars like `!!str 123` / `!foo 123` keep their pre-tag semantics. Do not remove the rewind without re-verifying the differential corpus.
