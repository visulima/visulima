# vis cold-start profile — 2026-06-18

Decomposition of vis's ~600 ms cold-start (see `BASELINE.md` for the dispatch baselines),
and the first optimization landed from it. Machine: Apple M-series (arm64), Node v24.15.0,
hyperfine 1.20.0, `-N` (no shell), warmup 3 / runs 25.

## Headline finding: the self-re-exec for heap tuning (~290 ms)

`bin.ts` / `binx.ts` call `applyHeapTuning()` (from `@visulima/cerebro/heap-tuning`) at the very
top of startup. It **re-execs the Node process** with `--max-old-space-size` (75% of RAM) +
`--max-semi-space-size` unless _both_ flags are already present in `process.execArgv`. That
re-exec is a full second Node boot — measured at **~290 ms**, nearly half the entire cold-start.
It ran on **every** invocation, including `--version`, `--help`, and the pure child-dispatchers
`dlx`/`exec` that never touch a large heap.

Confirmation: with the heap flags pre-set (via `NODE_OPTIONS`), the re-exec self-skips and
`vis --version` dropped from **639.7 ms → 351.1 ms**.

## Optimization landed

- **`bin.ts`** — guard `applyHeapTuning()` with a **deny-list** of light commands
  (`""`, `--version`/`-v`, `--help`/`-h`, `completion`, `dlx`, `exec`, and any `--help` invocation).
  Heavy in-process commands (`run`, `cache`, `audit`, `sbom`, `graph`, `affected`, …) still tune,
  and any unlisted/new command defaults to tuned — safe by construction.
- **`binx.ts`** (`visx`/`vx`) — drop `applyHeapTuning()` entirely; it only resolves and spawns a
  package binary (a child process), so a bumped heap is never needed.

### Before → after (real measurements)

| Invocation                             | Before               | After        | Δ              |
| -------------------------------------- | -------------------- | ------------ | -------------- |
| `vis --version`                        | 609.8 ms             | **297.8 ms** | −312 ms (−51%) |
| `vis exec <localbin>`                  | 855.6 ms             | **594.4 ms** | −261 ms (−31%) |
| `visx --version`                       | ~416 ms (est. tuned) | **126.1 ms** | ~−290 ms       |
| `vis run noop` (control — still tunes) | 620.8 ms             | 636.5 ms     | unchanged ✓    |

The control confirms the heavy in-process path is untouched: `run` still re-execs for the heap bump.

## Remaining cold-start (the ~298 ms single boot) — measured, not speculative

After the re-exec is removed, a light `vis --version` is one Node boot (~298 ms; Node floor alone is
~117 ms, so ~181 ms is vis-specific). A 3-run `--cpu-prof` of `vis --version`, aggregated by module:

| Module                                               | Self-time |
| ---------------------------------------------------- | --------- |
| `(native)` V8 (compile/GC)                           | 27%       |
| `node:internal/modules/esm/utils` (ESM resolve/load) | 26%       |
| `dist/.../bin.js` (vis startup)                      | 15%       |
| `@visulima/tui` `Table` component                    | 6%        |
| `node:fs`, bootstrap, help/version command chunks    | ~12%      |

Two leads I **disproved** (don't chase these):

- ❌ **Lazy-load the native binding** — measured the `index.js` import at floor+**~3 ms** (116.7 → 119.6 ms).
  `dlopen` of the 3.1 MB `.node` is cheap; the disk size is irrelevant. Not worth the invasiveness.
- ❌ **Lazy-import command handlers** — already done: every command's `index.ts` uses
  `loader: () => import("./handler")`, so registration only pulls the lightweight metadata modules,
  not the heavy dep trees (pm-runner / security / jiti). Handlers load only when dispatched.

What's actually left, in ROI order (all smaller than the ~290 ms heap win already banked):

1. **ESM module-graph load (~26%)** — `bin.ts` eagerly imports 61 command _metadata_ modules. The
   per-module cost is small but aggregates in the ESM resolver. Real fix = lazy command-_registration_
   (don't import all 61 index modules until needed), which needs cerebro API support. Est. medium; risk
   medium; partly a cerebro change.
2. **`Table` rendered for `--version` (~6%)** — a `@visulima/tui` Table is pulled into the version/help
   path (transitively, via cerebro's version/help command rendering — not a vis import). Est. low; lives
   mostly in cerebro.
3. **Project-graph build for trivial `run`** — `run` still builds the graph even for a one-target run;
   defer until a target needs it. Est. high _for `run` specifically_; risk medium. This is the best
   remaining vis-side lever, but it's `run`-path work, not general cold-start.

**Bottom line:** the dominant cold-start cost (the ~290 ms heap re-exec) is fixed. The rest is
diminishing returns split between an ESM-graph refactor (partly cerebro) and `run`-specific graph
deferral — none as clean or as large as the win already landed.

Re-run the harness (`run-script-runner.sh` / `run-bin-runner.sh`, and `hyperfine -N "node dist/bin.js --version"`)
before/after each of these to confirm the delta.
