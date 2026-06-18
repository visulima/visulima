# Runtime multi-tool — autonomous decision log

Branch: `feat/runtime-multitool`. Goal: nub feature-parity with the best achievable speed.
Each entry records a choice made without asking and why.

## Speed of `vis x` — the real bottleneck (measured)

`vis x hello.ts` = **431 ms**, decomposed: vis launcher boot (full `bin.ts`) **~295 ms** +
spawned Node to run the file **~139 ms** (of which Node boot ~117 ms; the actual TS transform
is only **~20 ms**). So:

- **A native oxc transform alone saves ~15 ms** — optimizing the one cheap part.
- The real costs are (1) vis's heavy launcher and (2) spawning a _second_ Node.

**Decision: lean entry + in-process execution BEFORE oxc.** Implemented as a thin `bin.ts`
dispatcher that, for `vis x`, lazy-loads a lean runner and runs the file in-process via `jiti`
(no second Node, no 60-command/plugins boot). oxc is layered on after as the final transform
polish (and the only path that adds JSX-on-Node). Rationale: spend effort where the milliseconds
are — ~280 ms in launcher+double-boot vs ~15 ms in transform.

## Why not copy nub's runtime verbatim

nub is MIT (reuse is permitted with attribution), but its `runtime/*.mjs` + `crates/nub-native`
are tightly coupled to nub's own Rust spawn model and would not function dropped into vis. vis
implements the **same architecture** (oxc transform via N-API + a `module.registerHooks` loader,
delegate to `bun run` for Bun) as original vis code, using the public oxc crates directly, with
nub credited for the design. A verbatim copy-and-rename would be non-functional, a licensing/
maintenance liability, and lower quality than purpose-built code.

## `run` is validate-only for runtime

`vis run` orchestrates tool binaries (tsc/vite/eslint) that are runtime-agnostic; injecting the
runtime into the task env would rotate every task's cache hash for zero behavioral gain. So `run`
validates `--runtime` (errors on deno, warns on detected deno) but does not alter execution.
Runtime-specific _execution_ lives in `vis x` and the PM verbs.

## Heap-tuning skip-set

`applyHeapTuning()` re-execs Node (~290 ms). Skipped for light commands (version/help/completion/
dlx/exec/x) via a deny-list in `bin.ts`; heavy in-process commands keep the bump. `binx`/`vx`
drops it entirely. Deny-list (not allow-list) so new/unknown commands stay safe (tuned).

## Native oxc transform — DEFERRED (measured, not worth it now)

After the lean+in-process change, `vis x hello.ts` = **131 ms**, which is the **~117 ms Node boot
floor + ~14 ms** (jiti load + transpile + run). A native oxc loader would replace jiti's transform,
saving at most ~10 ms — and **jiti 2.7 already transpiles the full TS surface + JSX and keeps its own
on-disk transpile cache**, so oxc adds _no new capability_. Against that ~10 ms sits a heavy cost:
the oxc crate tree in `vis-native` (multi-minute builds), a `registerHooks` loader with version
tiers, source-map + cache plumbing, and ongoing maintenance.

**Decision (revised below).** Initially deferred: for `vis x` alone, oxc saved only ~10 ms. But the
goal then shifted to **dropping jiti entirely** — at which point the calculus flips (see next entry).

## Native oxc transform — DONE (the goal became "drop jiti")

When the task became "get rid of jiti," oxc stopped being a ~10 ms `vis x` micro-opt and became the
way to **remove a dependency used in 3 places** (config, generators, `vis x`). Chose the **Rust path**
(oxc in `vis-native`) over the `oxc-transform` npm package: vis already ships `vis-native` (8 platform
packages via CI), so the npm route would ship a _second_ redundant native-binary set — the Rust path
adds no new dependency. Implemented `transform_ts` in `vis-native` + a `module.registerHooks`
load+resolve loader (`src/runtime/ts-loader.ts`) with extension/index probing and the `.js`→`.ts`
swap to match jiti's resolver; `?v=` query cache-bust; temp-file fallback for the 22.14.x sliver
(no `registerHooks`). jiti removed from dependencies. `vis x` ≈ 141 ms (was 131 ms on jiti — a ~10 ms
trade to drop the dep and own the transpiler).

Test note: vitest's module runner doesn't honor Node's `registerHooks`, so the generator fixture was
made self-contained (type-only import); the real-Node behaviour (extensionless + dir-index
resolution) is verified via `vis x`.

## `vis x` .env autoload

`vis x` auto-loads the `.env` cascade from cwd (node path), reusing vis's own `loadEnvFile`. Matches
nub's file-runner and Bun's behaviour. Real env vars win over `.env` (dotenv convention). Bun's path
needs nothing — `bun run` autoloads `.env` itself.

## `vis runtime` native version manager — DEFERRED (cannot verify in sandbox)

nub's `nub node` (native Node version download + SHA-256 verify + extract + shim) is the one real
nub feature vis still lacks natively (vis delegates to proto/mise/fnm via `vis toolchain`). It is a
large, **network- and platform-dependent** feature: shipping unverified download/verify/extract code
would be irresponsible in an environment where it cannot be exercised. **Decision: leave the
delegating `vis toolchain` as the working path and capture the native `vis runtime install/use/pin/
ls/which` design in `rfc/design-runtime-multitool.md` (Phase 3) for implementation where network
provisioning can be tested.** Not claimed as done.

## Rust launcher — native command tier (hybrid CLI)

The Node-boot floor (~117 ms here, ~26 ms on a fast machine) is the wall the JS CLI can't beat.
nub clears it by being a Rust binary that only spawns Node for user code. vis now has the same
front-end (`launcher/`): static/resolve-then-spawn commands handled in Rust, heavy orchestration
delegated to `node dist/bin.js`. Landed + measured: `--version` 2.4 ms (no Node), `exec`/`dlx`
native PM-detect+spawn (8.1 ms dispatch vs 171 ms via the JS CLI — `securityEnforcementPlugin`
gates only install/PM verbs, not these pure child-dispatchers), and native V8 heap flags
(`heap.rs`, Unix `sysconf` → 75%·RAM old-space + tiered semi-space, mirroring `heap-tuning.ts`) so
the JS side never re-execs (~290 ms saved). Windows RAM falls back to JS tuning until
`GlobalMemoryStatusEx` is wired. No arg-parser crate: the launcher does token-recognition and
forwards the rest verbatim — cerebro stays the single source of truth for parsing (a second parser
would drift). See `design-rust-launcher.md` + `design-hybrid-evolution.md`.

## Product decisions (asked, 2026-06-18)

- **PATH shim: explicit opt-in, project-local.** A `node` hijack is powerful but invasive; build it
  only as `vis shim install`/`uninstall`, prepending `.vis/shims` inside a vis project — never
  automatic, never global (yet), loud status + trivial uninstall. Rationale: the useful 90% without
  the machine-wide blast radius of intercepting every unrelated tool's `node`.
- **install/run: Rust resolve + JS security gate.** The launcher does the fast resolution natively
  but shells back to the JS security stack (advisories, OSV bloom, secret scan) for the gate — we do
  NOT reimplement vis's security product in Rust (that's the drift hazard line). A hybrid-within-the-
  hybrid: native speed where it's safe, JS where the product lives.
- **Build all four safe-track slices:** x-preload, polyfill layer, unflag layer, packaging + bin flip.
  Executed in dependency order (x-preload → polyfill → unflag → packaging), each committed + verified.

## `x`-preload path — built, but it's at the Node floor (honest measurement)

The launcher can run `vis x file.ts` via `node --import preload.js <file>` (the preload
registers the oxc loader + autoloads `.env`, then Node runs the file as its own entry —
proven: `registerHooks` intercepts the main entry, `process.argv` is already `[node, file, …]`).
Measured here: **128 ms vs the lean JS path's 129 ms — statistically equal.** Both are
Node-boot-bound; the decision log already established `vis x` sits at the floor. The preload's
only edge is skipping `bin.js`'s small module graph (compile-cache/heap-tuning/injectVersion),
invisible under this sandbox's ~100 ms spawn latency, maybe ~10 ms on a fast machine.

So the preload's real value is **infrastructure for the polyfill layer**, not speed. Two
consequences: (1) a Node-version cache (`node_version.rs`, mtime-keyed on the resolved absolute
node path — the bare `"node"` string can't be `stat`'d) gates the preload to >= 22.15 and serves
the unflag matrix, and without it the per-call `node --version` probe made `x` _slower_ (239 ms);
(2) the polyfill layer is wired into **both** the preload AND the in-process `runUnderNode` path,
so feature-detected polyfills (`Temporal`, `URLPattern`, opt-in via `VIS_POLYFILL`, resolved from
the user's project) work with or without the launcher. `vis x` is NOT routed through the launcher
for speed — it's routed so the augmentation layer has one consistent entry.

## Feature-parity status vs nub

Done: file runner (`vis x`), script runner (`vis run`), package runner (`vis dlx`/`exec`/`visx`),
package manager (`vis install/add/...`), meta-manager (`vis pm`), watch (`vis run --watch`),
runtime selection across all PM verbs + `vis x`. Speed: `vis x` 431→~141 ms, cold-start −290 ms.
Dependency: **jiti removed** — TS loading now runs on vis's own native oxc addon.
Deferred: native runtime version manager (above); Deno adapter; runtime polyfills (out of scope —
vis is a launcher, not a runtime).
