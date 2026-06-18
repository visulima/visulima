# Design — Rust launcher for vis (nub-style native front-end)

A thin Rust binary that fronts the Node CLI: answers static commands instantly in
Rust, applies V8 heap flags natively, and spawns Node for everything else. This is
how `nubjs/nub` reaches its speed — a Rust binary, not a Node entry script.

## What it can and cannot do (measured — be honest)

A PoC (`launcher/`) is built and measured (Apple M-series, this sandbox):

| Path                             | Before (Node entry) | With launcher       | Note                                                |
| -------------------------------- | ------------------- | ------------------- | --------------------------------------------------- |
| `vis --version`                  | 247 ms              | **2.4 ms**          | answered in Rust, no Node spawn (~100×)             |
| delegated command (`run --help`) | 260 ms              | 266 ms              | +~5 ms Rust spawn overhead (~2%)                    |
| `vis x` / `run` / `exec`         | —                   | **Node-boot-bound** | must spawn Node; launcher can't beat the boot floor |

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
- Heap sizes (planned): compute from total RAM in Rust (sysctl/sysconf), matching cerebro's
  75%-of-RAM heuristic. The PoC sets `VIS_HEAP_TUNED` without sizes (Node default) — sizing is the
  one functional gap before this can replace the JS heap tuning.

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

1. ✅ PoC binary: version-in-Rust + Node passthrough + `VIS_HEAP_TUNED` (this commit).
2. Heap sizing in Rust (RAM detection) — closes the functional gap so the launcher fully owns heap tuning.
3. `x`-preload path (nub-style direct file spawn) + the 22.14 delegation tier.
4. Static `--help`/`completion` in Rust.
5. Packaging: per-platform packages + JS bin-shim + fallback; CI matrix.
6. Flip the vis `bin` to the shim; keep `dist/bin.js` as the fallback.

## Risks

- Cross-platform binary builds + packaging are the bulk of the effort (not the launcher logic).
- The bin-shim must fall back cleanly so a missing/incompatible binary never bricks `vis`.
- Windows `.exe` + path/quoting; macOS universal binary; musl vs gnu on linux.
- Keep the JS CLI fully functional standalone (it's the fallback) — the launcher is an accelerator,
  not a hard dependency.
