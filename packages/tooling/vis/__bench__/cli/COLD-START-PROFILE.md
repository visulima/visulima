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

## Remaining cold-start (the ~298 ms single boot) — next leads

After the re-exec is removed, a light `vis` command is one Node boot (~298 ms). From the cpuprofile,
the next costs, in rough order:

1. **Module compile / bundle load** — `compileSourceTextModule` ~55–67 ms; the 11.5 MB dist bundle is
   eagerly loaded. Lead: lazy-import heavy command modules in `bin.ts` so only the dispatched command's
   code compiles. Est. high; risk medium (touches command registration).
2. **Native binding load** — `index.js` loads the 3.1 MB `vis-native.*.node`. Lead: lazy-load `#native`
   so commands that never call into Rust (version/help/dlx/exec) skip it. Est. medium; risk low–medium.
3. **jiti config load + cerebro framework init** — defer/skip config discovery for commands that don't
   read config. Est. medium; risk medium.
4. **Project-graph build** — `run` builds the graph even for a trivial target; defer until a target
   actually needs it. Est. high for `run`; risk medium.

Re-run the harness (`run-script-runner.sh` / `run-bin-runner.sh`, and `hyperfine -N "node dist/bin.js --version"`)
before/after each of these to confirm the delta.
