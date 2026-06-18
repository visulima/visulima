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
| `vis exec` (local bin dispatch)     | 855.6 ms         | **451.1 ms** | **−47%** | npm exec 230, pnpm exec 280 |
| `vis x hello.ts` (file run)         | 431 ms           | **139.3 ms** | **−68%** | Node floor ~117 ms          |
| `visx --version` (lean dlx entry)   | —                | **120.7 ms** | —        | Node floor ~129 ms          |

`vis exec` took a second drop (534→451 ms) from routing exec/dlx through a lean entry (no 60-command
CLI); the remaining ~250 ms CPU is loading `pm-runner`, not framework boot. `visx` sits at the Node
floor — it's already the lean entry and can't go faster on Node.

### Why vis can't match nub's absolute numbers (and what would)

nub is a single **Rust binary** (~9–44 ms); vis is a **Node CLI**, so every command pays Node's boot
floor + module loading. Two honest facts from the CPU breakdown:

- `vis x`/`visx` are **Node-floor-bound** and nub-competitive _in compute_ (`vis x` is ~38 ms CPU; the
  rest is Node boot + this sandbox's ~100 ms process-spawn latency — `node -e ""` is 129 ms wall but
  only ~31 ms CPU here). On a normal machine the wall numbers are far lower.
- `vis run`/`vis exec` carry real, avoidable CPU (graph build; `pm-runner` load) — trimmed as far as
  the Node-CLI architecture allows.

The only way to reach nub's absolute speed is to stop paying Node's boot for dispatch: a **thin Rust
launcher** shipped as the `vis` bin (spawns node with a preload, like nub), and a **native local-first
bin resolver** (RFC Phase 4) so exec/dlx bypass `pm-runner`. Both are large architectural changes,
out of scope here; everything achievable _within_ the Node-CLI shape is done.

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

---

## Rust launcher + native tier — measured (2026-06-18, Apple M-series, Node 24.15, warm)

nub couldn't be built here for a direct head-to-head (its vendored `aube` git submodule isn't
fetchable in this sandbox), so the comparison is structural: each vis path is categorised as
**native (Rust-only — the nub-class tier)** or **Node-boot-bound**, with the Node-boot floor measured
as the reference that sets the gap.

**Node boot floor (this sandbox): `node -e ""` = ~117–131 ms** (≈100 ms is process-spawn latency,
~25 ms CPU). On a fast machine this floor is ~26 ms — that difference is the _machine_, not the tool.

### Native tier — Rust-only, no Node spawn (this IS nub-class)

| command                        | launcher (Rust) | old JS path | speedup |
| ------------------------------ | --------------- | ----------- | ------- |
| `vis --version`                | **2.3 ms**      | 246 ms      | ~108×   |
| `vis exec`/`dlx` dispatch \*   | **5.2 ms**      | 168 ms      | ~33×    |
| PM-shim agreement → real PM \* | **5.5 ms**      | n/a         | —       |
| PM-shim refuse (mismatch)      | **~2 ms**       | n/a         | —       |

\* dispatch isolated with an instant fake `pnpm` (the PM's own work is identical on both sides).

### Node-bound tier — must spawn Node (bound by the boot floor; nub is too, for user JS)

| command          | launcher preload | JS lean | node floor |
| ---------------- | ---------------- | ------- | ---------- |
| `vis x hello.ts` | **130 ms**       | 132 ms  | 117 ms     |

`vis x` sits ~13 ms above the bare floor (oxc transpile + preload); the launcher path and the JS lean
path are statistically equal — there's no JS-CLI overhead left to strip.

### How far from nub

- **Static/dispatch commands** (`--version`, `exec`, `dlx`, PM-shim): vis's launcher is **2–5.5 ms**,
  which is nub's own Rust-startup class. **No meaningful gap.**
- **Running a user file** (`vis x`): both vis and nub are bound by the _same_ Node boot floor — the
  delta is the machine's node-spawn cost, not vis-vs-nub. On nub's ~26 ms-boot machine, `vis x` would
  land at ~26 ms + ~13 ms too. **No tool gap.**
- **`install`/PM verbs**: the one _intentional_ gap. nub resolves + gates installs entirely in Rust;
  vis keeps the security gate (advisories, OSV, secret-scan, lockfile policy) in JS — that gate is
  vis's product, and reimplementing it in Rust is the drift hazard we explicitly refuse. So
  `vis install` pays Node boot + the JS gate where nub pays neither. This is a deliberate
  architecture line, not a perf deficiency.

**Bottom line:** vis's native tier is at nub's speed class; the file-runner is at the shared Node
floor; only install/PM is intentionally slower (JS security gate). The remaining unconditional win
that isn't yet shipped is reaching users — gated on launcher packaging (CI).
