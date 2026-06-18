# vis CLI baseline — 2026-06-17

First baseline from this harness, captured before the cross-runtime multi-tool work
(`rfc/design-runtime-multitool.md`). Re-run with the scripts in this directory and
update the tables; the raw `hyperfine --export-json` files land in `results/` (gitignored).

- **Machine:** Apple M-series (arm64), macOS · **Node:** v24.15.0 · **vis:** 1.0.0-alpha.40
- **pnpm:** 11.1.3 · **npm:** 11.12.1 · **bun:** absent
- **hyperfine:** 1.20.0 · warmup/runs per scenario noted below

> ⚠️ Numbers are machine-relative. The point is **internal before/after tracking**, not matching
> nub's absolute table (different hardware). nub's published targets are in `README.md`.

## 1. Workspace task dispatch — `run-script-runner.sh` (pure-shell `noop`, 30 runs)

`vis run` is a workspace orchestrator (requires a lockfile-marked workspace root, builds a
project graph). Its peers are `pnpm -r run` / `turbo` / `nx`, **not** single-script `npm run`.
Run with `--no-preflight --skip-toolchain` to isolate dispatch from network-touching probes.

| Command                    | Mean                | vs fastest |
| -------------------------- | ------------------- | ---------- |
| npm -ws run                | 177.1 ms ± 2.2      | 1.00×      |
| pnpm -r run                | 290.7 ms ± 9.7      | 1.64×      |
| **vis run (orchestrated)** | **620.8 ms ± 21.4** | **3.51×**  |

## 2. Local bin dispatch — `run-bin-runner.sh` (pure-shell `.bin`, 30 runs)

| Command      | Mean                | vs fastest |
| ------------ | ------------------- | ---------- |
| npm exec     | 231.6 ms ± 3.6      | 1.00×      |
| pnpm exec    | 281.1 ms ± 3.2      | 1.21×      |
| **vis exec** | **855.6 ms ± 10.2** | **3.69×**  |

## 3. Install (warm, `simple` fixture) — `run-install.sh --warm-only` (12 runs, `-i`)

Warm CAS store + lockfile, `node_modules` wiped, offline reinstall. `npm_config_ignore_scripts=true`;
hyperfine `-i` because pnpm v10 exits 1 on `ERR_PNPM_IGNORED_BUILDS` _after_ resolve+link completes.

| Command                          | Mean                | vs fastest |
| -------------------------------- | ------------------- | ---------- |
| pnpm install (raw)               | 3.473 s ± 0.337     | 1.00×      |
| **vis install (delegates→pnpm)** | **4.771 s ± 0.293** | **1.37×**  |

## 4. vis internal logic — `dispatch-internals.bench.ts` (vitest bench, in-process)

| Function                             | Mean      | Throughput |
| ------------------------------------ | --------- | ---------- |
| detectPm · pnpm                      | 0.0237 ms | 42,275 hz  |
| detectPm · npm                       | 0.0346 ms | 28,923 hz  |
| detectPm · bun                       | 0.0404 ms | 24,761 hz  |
| resolveInstaller · auto (fs probe)   | 0.1348 ms | 7,420 hz   |
| resolveInstaller · explicit backend  | 0.0789 ms | 12,680 hz  |
| detectLockfileDrift · aube           | 0.0018 ms | 562,916 hz |
| satisfies · engines batch (6 checks) | 0.0024 ms | 416,958 hz |

## Findings → optimization targets

1. **The ~620–855 ms dispatch cost is almost entirely fixed per-invocation overhead, not vis logic.**
   vis's own logic (detection/resolution/semver) is sub-millisecond (§4). The cost is: Node boot +
   cerebro framework boot + jiti config load + 3.1 MB native-binding load + project-graph build.
   This is the cold-start tax every `vis` command pays. nub pays ~9–11 ms (single Rust binary, no
   framework/jiti/graph). **Lead:** lazy-load the native binding and defer graph build until a target
   actually needs it; profile cerebro boot + jiti.

2. **`vis exec` (855 ms) is slower than `vis run` (620 ms) for a trivial local bin — it shouldn't be.**
   Strongest single signal. A native local-first `.bin` resolver (RFC Phase 4) that walks
   `node_modules/.bin` and execs directly should collapse this toward — or under — pnpm's ~280 ms.

3. **`vis install` is not a thin shim (+1.3 s over raw pnpm), unlike nub's +4.9 ms.**
   vis runs preflight/security work on top of delegation. If vis wants to compete as a fast PM wrapper,
   it needs a documented fast path that skips the security pipeline, or that pipeline needs profiling.

## Not yet benchmarked (need features first)

- **PM-shim, warm-gvs** — aube-specific (global virtual store); vis delegates, N/A.
- **Install cold leg, monorepo + t3 fixtures** — harness supports them (`run-install.sh` w/o `--warm-only`,
  `--fixture monorepo|t3`); not run in this first pass.

## Post-optimization results (2026-06-18)

Re-run after the lean-dispatcher + heap-skip + oxc-loader work (same machine/methodology).

| Scenario                            | Baseline (06-17) | Now (06-18)  | Δ        | nearest peer                |
| ----------------------------------- | ---------------- | ------------ | -------- | --------------------------- |
| `vis run` (workspace task dispatch) | 620.8 ms         | **417.7 ms** | **−33%** | npm-ws 181, pnpm-r 294      |
| `vis exec` (local bin dispatch)     | 855.6 ms         | **534.6 ms** | **−38%** | npm exec 230, pnpm exec 280 |
| `vis x hello.ts` (file run)         | 431 ms           | **139.3 ms** | **−68%** | Node floor ~117 ms          |

What moved each number:

1. **`vis run` −33%** — the lean `bin.ts` dispatcher. The old entry statically imported all 60 commands
   _before_ the heap re-exec, so the parent process loaded the full command graph and the re-exec'd
   child loaded it again. Now the graph loads only in the child (via `cli-main`), so the pre-re-exec
   parent is thin — every heap-tuning command (run, cache, audit, …) benefits, not just `vis x`.
2. **`vis exec` −38%** — added to the heap-tuning skip-list, so it no longer pays the ~290 ms Node
   re-exec (a pure child dispatcher never needs the bumped heap).
3. **`vis x` −68%** — lean entry (skips the 60-command/plugin/config boot) + in-process execution via
   the native oxc loader (no second Node spawn). Now Node-floor-bound (~117 ms + ~22 ms loader).

`vis x` is competitive with tsx; `vis run`/`vis exec` remain above their pnpm/npm peers because of
Node's boot floor + cerebro framework init (only a Rust launcher would close that — out of scope).
