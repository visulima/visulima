# Design — Atomizer (split test/e2e suites into per-file tasks)

Automatically split a coarse `test` / `e2e` target into many fine-grained per-file tasks, so they cache independently, distribute across agents, and surface flakiness per file. Matches Nx Cloud's atomizer (`e2e-ci`, `test-ci` inferred targets for Cypress/Playwright/Jest/Vitest).

## Why

A single `e2e` task is a scheduling atom: it caches all-or-nothing (one changed spec busts the whole suite), it can't be spread across agents (it's one process — the long pole of any distributed run), and a flake anywhere fails everything with no per-file signal. Splitting `e2e` into `e2e:spec/login.ts`, `e2e:spec/checkout.ts`, … makes each a cacheable, distributable, independently-retryable unit. Atomizer is the feature that makes `design-distributed-execution.md` actually fast — without it the biggest suites stay serial.

## Approach

An **inference step** that expands one declared target into N synthetic per-file tasks at graph-build time, plus a result-merge step. Opt-in per target.

### Discovery

For an atomized target, enumerate its test files (glob from config, e.g. `e2e/**/*.spec.ts`) — reuse the workspace file walk. Each file becomes a synthetic task `project:target:file` whose command is the runner's per-file invocation (`playwright test e2e/login.spec.ts`, `vitest run path`). This is conceptually identical to how `vis` already synthesizes Project-Crystal-style inferred targets (`inferTargets`/detectors in `config/workspace.ts`) — same machinery, file-granular.

### Caching & inputs

Each per-file task's inputs = its spec file + the shared inputs of the parent target (helpers, config, source under test). So editing one spec re-runs only that spec; editing shared source re-runs all. Trace mode makes this _automatic_ (each per-file run traces exactly what it touched) — a strong fit for our auto-fingerprint, and arguably better than Nx's declared-input atomizer.

### Result merge

The N per-file results roll up into one logical `e2e` status for reporting (`life-cycle.ts` / run summary). A parent "umbrella" task depends on all per-file tasks and aggregates pass/fail + flaky counts.

```
e2e  (umbrella, depends on all shards)
 ├─ e2e:login.spec.ts      (cache: own)   ─┐
 ├─ e2e:checkout.spec.ts   (cache: own)    ├─ distributable across agents
 └─ e2e:profile.spec.ts    (cache: own)   ─┘
```

## Integration

- `config/workspace.ts` (vis) — atomize during target synthesis, behind `atomize: { files: "...", runner: "playwright" | "vitest" | "jest" | "cypress" }` on the target.
- `task-graph.ts` — synthetic per-file tasks + umbrella aggregation edge.
- `flaky` reporting (`vis run --flaky` already exists) becomes per-file — natural upgrade.
- Feeds `design-distributed-execution.md`: per-file tasks are the unit the coordinator load-balances.

## Risks / open questions

- **Per-file startup cost**: splitting can _slow_ a suite locally (N cold Playwright boots) — atomizer pays off under distribution + caching, not single-machine. Gate it (`atomize` only kicks in with `--partition`/coordinator, or expose `--no-atomize`). Pairs with the batch-executor idea inversely (batch = fewer processes; atomize = more — they target different tools).
- Runner-specific invocation + result parsing (Playwright vs Vitest vs Jest reporters) — each needs an adapter; ship one (Vitest, since it's the house runner) and make the rest pluggable.
- Shared expensive setup (a DB, a built app) must be a `continuous`/service dependency (see `design-continuous-sidecar-tasks.md`) shared across shards, not re-done per file.
- Graph explosion: 500 spec files = 500 tasks; the scheduler must stay O(n) (it is) and the TUI/summary must aggregate, not list 500 rows.

## Effort

High, and **dependent on continuous-tasks (shared setup) + distributed-execution (the payoff)**. Lowest-priority of the nine on its own; only valuable once distribution exists. RFC-grade.
