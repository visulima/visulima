# Design — Rust launcher for vis (nub-style native front-end)

A thin Rust binary that fronts the Node CLI: answers static commands instantly in
Rust, applies V8 heap flags natively, and spawns Node for everything else. This is
how `nubjs/nub` reaches its speed — a Rust binary, not a Node entry script.

## What it can and cannot do (measured — be honest)

A PoC (`launcher/`) is built and measured (Apple M-series, this sandbox):

| Path                             | Before (Node entry) | With launcher       | Note                                                |
| -------------------------------- | ------------------- | ------------------- | --------------------------------------------------- |
| `vis --version`                  | 247 ms              | **2.4 ms**          | answered in Rust, no Node spawn (~100×)             |
| `vis exec` / `dlx` (dispatch)    | 171 ms              | **8.1 ms**          | PM detected + spawned in Rust, no Node CLI (~21×)   |
| delegated command (`run --help`) | 260 ms              | 266 ms              | +~5 ms Rust spawn overhead (~2%)                    |
| `vis x` / `run`                  | —                   | **Node-boot-bound** | must spawn Node; launcher can't beat the boot floor |

`exec`/`dlx` dispatch measured with an instant fake `pnpm` (isolates dispatch from
the PM's own work). On a real machine the launcher strips ~163 ms of Node boot +
`cli-exec` module load off every `vis exec`/`vis dlx` — the PM work itself is
unchanged. This is the first **native command** slice: the launcher resolves the
PM (lockfile walk, `launcher/src/pm.rs`) and spawns it directly, because
`securityEnforcementPlugin` gates only install/PM verbs, not these pure
child-dispatchers. `--runtime bun` forces `bun x`.

**The honest limit:** any command that runs JS/a tool (`x`, `run`, `exec`, `dlx`,
install) must spawn Node, and Node's boot is the floor. nub is fast there only
because its _machine's_ Node-boot is ~26 ms; this sandbox's is ~129 ms (≈100 ms of
which is process-spawn latency, ~31 ms CPU). On a normal machine the launcher
closes most of the remaining gap for `x` (by spawning Node directly with a preload
instead of booting the vis JS dispatcher first). The unconditional wins are:
**static commands become instant**, and **heap tuning needs no JS re-exec**.

## Architecture

### The binary (`launcher/`, PoC done)

- Crate `vis-launcher`, `[[bin]] name = "vis"` (a sibling `visx` bin later).
- `--version`/`-v` → print the baked version (`build.rs` reads `package.json`), exit. No Node.
- (planned) `--help`, `completion`, bare `vis` → static Rust output.
- `x <file> [args]` (planned) → `node --import <dist>/x-preload.mjs --enable-source-maps <file> [args]`.
  The preload registers the oxc `registerHooks` loader (from `src/runtime/ts-loader.ts`) + `.env`
  autoload, then Node runs the file as its own entry — no vis JS dispatch. On the 22.14.x floor
  (no `registerHooks`), delegate to `node dist/bin.js x` instead.
- everything else → `node [--max-old-space-size=N --max-semi-space-size=M] <dist>/bin.js <args>`
  with `VIS_HEAP_TUNED=1`. The JS side (`bin.ts`) already honours that env and skips
  `applyHeapTuning()` — so the heap bump is applied once, by Rust, with **no re-exec**.
- Heap sizes (done, `heap.rs`): computed from total RAM via Unix `sysconf` (`_SC_PHYS_PAGES *
_SC_PAGE_SIZE`), old=75%·RAM, semi via the same tier table as `heap-tuning.ts`. Verified on a 36 GiB
  host → `--max-old-space-size=27648 --max-semi-space-size=112`, matching `sysctl hw.memsize`. When RAM
  is undetectable (Windows for now), the launcher omits the flags and `VIS_HEAP_TUNED`, so the JS side
  tunes itself (correct, one extra boot). Native Windows RAM (`GlobalMemoryStatusEx`) is a follow-on.

### Packaging (the real integration work — mirrors `task-runner`)

- Build the binary for the 8 targets (darwin x64/arm64, linux x64/arm64 gnu+musl, win x64/arm64),
  publish as per-platform packages `@visulima/vis-launcher-<target>` (optionalDependencies of vis).
- The vis `bin` (`vis`/`v`) becomes a tiny JS shim that: resolves the platform binary, sets
  `VIS_DIST_DIR`, and `execFileSync`s it; **falls back to `node dist/bin.js`** when no binary is
  present (unsupported platform / install bug) — so `npm i @visulima/vis` always works.
- Extend `.github/workflows/build-native.yml` with a launcher build matrix (same machinery as the
  `vis-native` addon).

### Resolution (PoC)

- Node: `$VIS_NODE` or `node` on PATH. (Prod: honour the toolchain-pinned Node.)
- dist: `$VIS_DIST_DIR` (set by the shim), dev fallback `<exe>/../../../dist`.

## Sequencing

1. ✅ PoC binary: version-in-Rust + Node passthrough + `VIS_HEAP_TUNED`.
2. ✅ Native `exec`/`dlx`: PM detection (`pm.rs`) + direct spawn, no Node CLI. `--runtime bun`.
3. ✅ Heap sizing in Rust (`heap.rs`, Unix `sysconf`): old=75%·RAM, semi=tiered — mirrors `heap-tuning.ts`. Windows falls back to JS tuning until `GlobalMemoryStatusEx` is wired.
4. `x`-preload path (nub-style direct file spawn) + the 22.14 delegation tier.
5. Static `--help`/`completion` in Rust.
6. Packaging: per-platform packages + JS bin-shim + fallback; CI matrix.
7. Flip the vis `bin` to the shim; keep `dist/bin.js` as the fallback.

## Risks

- Cross-platform binary builds + packaging are the bulk of the effort (not the launcher logic).
- The bin-shim must fall back cleanly so a missing/incompatible binary never bricks `vis`.
- Windows `.exe` + path/quoting; macOS universal binary; musl vs gnu on linux.
- Keep the JS CLI fully functional standalone (it's the fallback) — the launcher is an accelerator,
  not a hard dependency.
