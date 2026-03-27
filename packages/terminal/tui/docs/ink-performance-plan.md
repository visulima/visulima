# Ink performance plan (without switching to Ratatat)

> Part of the [Ratatat docs](index.md). See also: [Why Ink is slower on heavy redraws](why-is-ink-slow.md)

This document turns the ideas in section 8 of `why-is-ink-slow.md` into an execution plan.

The goal is to answer: **if we were improving Ink itself, what should we build first, how would we validate it, and how would we ship it safely?**

Status: this plan has a research-grade PoC implementation in [`ink-fast`](../ink/TECHNICAL-README.md), including committed benchmark snapshots.

---

## 1) Goals and constraints

## Goals

- Improve Ink runtime performance for heavy redraw workloads.
- Preserve Ink's public API and existing app behavior.
- Keep a pure-JS path available by default.

## Non-goals

- Rewriting Ink to match Ratatat internals 1:1.
- Breaking changes to core component/hook APIs.
- Trading correctness/accessibility for benchmark-only wins.

## Constraints

- Must stay compatible with React + Yoga architecture.
- Must preserve Unicode/ANSI correctness.
- Must not regress low-frequency CLI UX.

---

## 2) Current bottleneck model

```text
Ink today (simplified)

React commit
  -> Yoga layout
  -> tree walk -> render ops
  -> JS output structure build
  -> ANSI-rich frame string
  -> log-update string/line diff
  -> terminal writes
```

Most performance pain for dense updates is in the post-Yoga JS text pipeline.

---

## 3) Success metrics

Use three benchmark classes:

1. **Dense redraw**: 80x24 and 160x48, 100% dirty each frame
2. **Mixed redraw**: 5–25% dirty
3. **Unicode-heavy**: wide glyphs + ANSI styles

Track:

- median/p95 frame time
- max sustainable FPS at fixed CPU budget
- allocations / GC pause time
- terminal write bytes per second

Target outcomes (initial):

- 20–30% lower median frame time on dense redraws
- 30% lower allocation rate on dense redraws
- no functional regressions in existing examples/tests

---

## 4) Delivery phases

## Phase 0 — Instrumentation first (low risk, high ROI)

**Why first:** without stage timing, optimization work is guesswork.

### Work

- Add internal timing hooks around:
    - tree walk/render op generation
    - output assembly
    - diff generation
    - terminal write
- Add optional debug output / callback API for stage timings.
- Add stable benchmark fixtures for dense, sparse, unicode workloads.

### Exit criteria

- Repeatable numbers across runs
- per-stage timings visible
- baseline snapshot committed

---

## Phase 1 — Low-risk JS optimizations

### 1. Persistent output surface

**Idea:** stop rebuilding full output structures every frame.

- Reuse row/cell containers and scratch buffers
- Track dirty ranges per row
- Avoid full re-init unless geometry changed

**Expected impact:** lower allocations + GC pressure.

### 2. Hot-path text cache improvements

**Idea:** cache expensive text transforms by `(text, width, style, wrapMode)`.

- cache wrapped/truncated results
- cache tokenized ANSI segments for repeated strings
- optimize invalidation strategy to avoid stale style outputs

**Expected impact:** lower CPU in text-heavy UIs.

### 3. log-update path tightening

- reduce redundant string splitting/joining
- fast-path “no output change” and small-cursor moves
- reduce escape sequence churn where possible

**Expected impact:** lower JS overhead in frequent rerender loops.

### Exit criteria

- measurable wins in dense + mixed benchmarks
- no regressions in Unicode/ANSI correctness tests

---

## Phase 2 — Algorithmic diff improvements (medium risk)

### 1. Better diff granularity than whole-line rewrites

- Move from coarse string/line diff toward segment-level diff for changed lines
- Keep unchanged line segments untouched

### 2. Dirty-region propagation

- Derive minimal affected regions from node/layout changes
- Skip full-frame output work when only local regions changed

### Exit criteria

- p95 frame time reduced for partial-dirty workloads
- write volume reduced on sparse updates

---

## Phase 3 — Optional cell backend inside Ink (higher impact)

### Idea

Keep React+Yoga front half, add alternate backend:

```text
Ink with optional cell backend

React -> Yoga -> typed cell surface -> cell diff -> ANSI
```

Implement as feature flag / opt-in config first:

- `backend: 'string' | 'cells'` (example shape)
- default remains `'string'` for compatibility

### Why this matters

This directly attacks the biggest current bottleneck: frame-sized JS string assembly/diff in hot paths.

### Exit criteria

- clear wins on dense redraws
- behavior parity with string backend on compatibility tests

---

## Phase 4 — Optional native accelerator (longer-term)

If a pure-JS cell backend still leaves performance on the table:

- add opt-in native diff/write module (N-API, optional dependency)
- keep pure-JS fallback as default
- enable only when available + explicitly requested

This gives an escape hatch for high-performance workloads without forcing native runtime requirements on all users.

---

## 5) Risk register

| Risk                                          | Impact | Mitigation                                                 |
| --------------------------------------------- | ------ | ---------------------------------------------------------- |
| Unicode/ANSI rendering regressions            | High   | Add golden tests for wide chars + styled segments          |
| Terminal-specific behavior differences        | Medium | Test matrix: macOS Terminal, iTerm2, Linux terminals, CI   |
| Optimization complexity hurts maintainability | Medium | Phase-gate changes, keep feature flags, document internals |
| Benchmark-only wins without real-world gains  | Medium | Include app-like mixed workloads, not only synthetic tests |

---

## 6) Suggested implementation slices (PR-sized)

1. Stage timing hooks + baseline benchmark harness
2. Persistent output surface reuse
3. Text/token cache improvements
4. log-update fast paths
5. Segment-level diff prototype behind flag
6. Optional cell backend behind flag
7. Native accelerator spike (optional)

Each slice should include:

- before/after benchmark snapshot
- regression tests
- rollback path (flag or isolated module)

---

## 7) Decision gate: when to stop

Stop after Phase 1 or 2 if:

- targets are met,
- maintenance cost stays low,
- and real app traces improve enough.

Only move to cell/native backend if measured gains justify complexity.
