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
- Resolver + fallback (`launcher/bin-shim.mjs`, built + locally verified): detects the platform
  target (`process.platform`/`arch`, glibc-vs-musl via `process.report`), resolves
  `@visulima/vis-launcher-<target>` through its `package.json`, and `execFileSync`s the binary with
  `VIS_DIST_DIR` set; **falls back to `node dist/bin.js`** when no binary is present (unsupported
  platform, or the optional dep was skipped — e.g. pnpm's ignored-builds policy). Both branches
  tested locally: fallback runs the JS CLI; native runs the Rust binary's baked `--version` with no
  Node. So `npm i @visulima/vis` always works — the binary is a pure accelerator.

    **Double-boot caveat + recommendation.** If the JS shim is itself the `bin`, even `vis --version`
    pays one Node boot (to run the shim) before the native binary runs — eroding the launcher's whole
    point. Two ways to ship:
    - _JS shim as bin_ (turbo/biome style): robust, no postinstall, but one Node boot per invocation.
    - _Native binary as bin_ (bun style): a postinstall links the platform binary over the `bin` path,
      so static/native commands pay **zero** Node boot; the JS shim is what the postinstall writes when
      no binary is available. Preserves every measured win.

    **Recommend the native-binary-as-bin path** (the launcher exists for speed), with `bin-shim.mjs`
    as the literal fallback file. Risk: pnpm's ignored-builds policy can skip the postinstall → the
    fallback shim covers that case (correct, slower). _Not flipped yet — needs the published binaries._

- Extend `.github/workflows/build-native.yml` with a launcher build matrix (same machinery as the
  `vis-native` addon). **This + publish must run in CI; it cannot be exercised in the dev sandbox, so
  the production `bin` is NOT flipped here.**

### Why `--help`/`completion` stay on Node (not static Rust)

Only `--version` is staticised in Rust — it's a single string baked from `package.json` (one source
of truth via `build.rs`). `--help`/`completion` output is generated by cerebro from the registered
command set; hardcoding it in Rust would guarantee drift, so the launcher delegates them to Node.
They're not perf-critical (nobody benchmarks `--help`).

### Resolution (PoC)

- Node: `$VIS_NODE` or `node` on PATH. (Prod: honour the toolchain-pinned Node.)
- dist: `$VIS_DIST_DIR` (set by the shim), dev fallback `<exe>/../../../dist`.

## Sequencing

1. ✅ PoC binary: version-in-Rust + Node passthrough + `VIS_HEAP_TUNED`.
2. ✅ Native `exec`/`dlx`: PM detection (`pm.rs`) + direct spawn, no Node CLI. `--runtime bun`.
3. ✅ Heap sizing in Rust (`heap.rs`, Unix `sysconf`): old=75%·RAM, semi=tiered — mirrors `heap-tuning.ts`. Windows falls back to JS tuning until `GlobalMemoryStatusEx` is wired.
4. ✅ `x`-preload path (`preload.ts`, gated on Node >= 22.15) + the 22.14 delegation tier. At the
   Node-boot floor — built as the augmentation entry point, not for speed.
5. ✅ Resolver + fallback shim (`bin-shim.mjs`) — platform detection + native-or-JS dispatch, both
   branches locally verified. (`--help`/`completion` stay on Node — see above.)
6. CI build matrix (8 targets) + per-platform publish — **CI-only, not done here.**
7. Flip the vis `bin` (native-binary-as-bin via postinstall-link; `bin-shim.mjs` as fallback) — gated
   on (6).

## Risks

- Cross-platform binary builds + packaging are the bulk of the effort (not the launcher logic).
- The bin-shim must fall back cleanly so a missing/incompatible binary never bricks `vis`.
- Windows `.exe` + path/quoting; macOS universal binary; musl vs gnu on linux.
- Keep the JS CLI fully functional standalone (it's the fallback) — the launcher is an accelerator,
  not a hard dependency.
