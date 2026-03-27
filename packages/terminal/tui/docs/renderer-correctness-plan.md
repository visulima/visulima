# Renderer correctness hardening (xterm harness → wide-char correctness → synchronized output)

Status: **implemented on `main`** (March 2026).

This page keeps the original hardening plan plus what shipped.

## Goals (completed)

1. Add a terminal-accurate correctness harness (xterm-headless replay tests).
2. Fix wide character handling end-to-end (layout measure + raster + diff emission).
3. Add DEC 2026 synchronized output wrapping to reduce visual tearing.

---

## Phase 1 — xterm replay harness ✅

Delivered:

- xterm-backed replay tests in `packages/react/__test__/renderer-xterm-roundtrip.spec.ts`
- deterministic round-trip tests for incremental diff replay
- randomized ASCII smoke coverage

Outcome:

- Renderer diffs are now validated against a real terminal model, not just string snapshots.

---

## Phase 2 — wide-char correctness ✅

Delivered:

- width-aware measurement in `packages/react/src/layout.ts` via `packages/react/src/text-width.ts`
- width-aware rasterization in `packages/react/src/renderer.ts`
    - wide glyph cursor advancement by display width
    - explicit continuation-cell marker (`0x110000` sentinel)
- width-aware diff cursor progression in `packages/core/src/lib.rs`
- targeted tests for CJK/emoji continuation behavior and replay correctness

Outcome:

- CJK and emoji rendering/diff behavior is significantly more stable and deterministic.

---

## Phase 3 — DEC 2026 synchronized output ✅

Delivered:

- frame writes wrapped in `\x1b[?2026h` / `\x1b[?2026l` in:
    - `packages/core/src/app.ts`
    - `packages/core/src/inline.ts`
- tests asserting synchronized output wrappers in frame paths

Outcome:

- reduced visible tearing/flicker on terminals that support synchronized updates.

---

## Current verification checklist

- [x] `npm run build`
- [x] `npm test`
- [x] focused renderer and replay tests
- [x] `cargo test`

---

## Remaining gaps (intentional)

- Full grapheme-cluster layout/render handling for complex ZWJ emoji sequences
- Broader fuzz/property coverage across mixed Unicode categories
- Additional terminal-emulator matrix validation beyond xterm-headless
