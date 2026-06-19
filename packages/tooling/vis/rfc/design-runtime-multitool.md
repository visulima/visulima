# Design — vis as a cross-runtime multi-tool (Node · Bun)

Spec for repositioning `vis` from a monorepo task orchestrator into a **runtime-agnostic multi-tool** that runs files, runs scripts, installs dependencies, runs package binaries, and manages runtime versions across **Node and Bun** behind one unified interface. The existing orchestration stack (task graph, REAPI cache, affected, security, release) is **demoted to an advanced feature group**, not removed.

Comparable category: `nubjs/nub` (Bun-ergonomics-for-Node) — but cross-runtime instead of Node-only.

## Decisions locked (2026-06-17)

1. **Scope:** Node + Bun only for now. **Deno is deferred** (see "Deferred — Deno" below); no Python/Ruby/Go/edge.
2. **Mission:** Pivot to multi-tool; orchestration becomes one feature among many.
3. **Strategy:** Hybrid — ship via delegation first, replace hot paths with native (Rust/NAPI) incrementally.

> **Why defer Deno?** It carries the two thorniest semantic wrinkles — deny-by-default permissions and no `node_modules` (`npm:`/`jsr:` specifiers) — plus a separate `deno.json` workspace/task model. Node + Bun share the `package.json` + `node_modules` model, so the first cut is clean. The adapter abstraction below is designed so Deno slots in later as a third adapter without reshaping the seam.

## Why this is achievable now (current state)

The cross-runtime _install / exec_ foundation is **already substantially built**:

| Capability                      | Today in vis                                                                                                                                                                                       | Gap for multi-tool                                                |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Install / add / remove / dedupe | `src/pm/pm-runner.ts` already models `bun` (and `deno`) as first-class PMs (lockfile detection `bun.lock(b)`; per-PM lifecycle-script, `--cached-only`, `--quiet`, peer-dep, frozen-mode handling) | Promote PM-selection → **runtime-selection**                      |
| dlx / exec                      | `runDlx` / `runExec` delegate to detected PM                                                                                                                                                       | Route to `bunx`; native local-first `.bin` resolver (P4 hot-path) |
| Version mgmt                    | `vis toolchain` delegates to proto/mise/fnm/volta/asdf (`src/commands/toolchain`, `src/runtime/toolchain.ts`)                                                                                      | Add **native** `vis runtime install` (zero external dep)          |
| Config                          | `vis.config.ts` via `jiti` (`src/config/config.ts`), `devEngines.{runtime,packageManager}` already a concept                                                                                       | Add a first-class `runtime:` selector + `--runtime` flag          |
| File execution                  | **none**                                                                                                                                                                                           | **New** — `vis x` / `vis <file>`                                  |

So the pivot is mostly **(a) promotion of an existing PM abstraction to a runtime abstraction, (b) two genuinely new capabilities — file runner + native version manager, and (c) repositioning.** It is not a from-scratch rewrite.

## Measured baseline (2026-06-17)

First numbers from the `__bench__/cli/` harness (Apple M-series, Node v24.15.0, pnpm 11.1.3, npm 11.12.1; full tables + methodology in `__bench__/cli/BASELINE.md`). These are machine-relative — the value is internal before/after tracking and direction, not matching nub's absolute table.

| Scenario                                    | vis      | best peer       | gap        | nub target   |
| ------------------------------------------- | -------- | --------------- | ---------- | ------------ |
| Workspace task dispatch (`run`, pure-shell) | 620.8 ms | npm-ws 177 ms   | 3.5×       | ~9 ms        |
| Local bin dispatch (`exec`, pure-shell)     | 855.6 ms | npm exec 232 ms | 3.7×       | ~11 ms       |
| Install warm (`simple`, delegates→pnpm)     | 4.771 s  | pnpm 3.473 s    | +1.3 s     | +4.9 ms shim |
| vis own logic (detectPm/resolve/semver)     | <0.13 ms | —               | negligible | —            |

**The finding that reshapes priorities: vis's own logic is sub-millisecond, so the entire ~620–855 ms dispatch cost is fixed per-invocation overhead** — Node boot + cerebro framework boot + jiti config load + 3.1 MB native-binding load + project-graph build. nub pays ~9–11 ms because it's a single Rust binary with none of that. Three concrete leads, now folded into the phases below:

1. **Cold-start floor (~600 ms) is the cross-cutting tax on every command.** Lead (new — see Phase 4): lazy-load the native binding, defer project-graph build until a target needs it, and profile cerebro + jiti boot. This is independent of the runtime pivot and pays off for _every_ vis invocation.
2. **`vis exec` (855 ms) is slower than `vis run` (620 ms) for a trivial local bin — it shouldn't be.** Strongest single signal; directly justifies Phase 4's native local-first `.bin` resolver.
3. **`vis install` is not a thin shim (+1.3 s over raw pnpm), unlike nub's +4.9 ms** — it runs preflight/security work on top of delegation. A documented `--fast`/bare path that skips that pipeline (or profiling it) is the lever if vis wants PM-wrapper-class install latency.

## Keystone abstraction — the Runtime layer

A new `src/runtime/adapters/` introduces a `RuntimeAdapter` per runtime. All multi-tool verbs resolve an adapter via `resolveRuntime(cwd, opts)` and delegate — exactly mirroring the existing `resolveInstaller()` pattern, generalized from "which PM" to "which runtime (+ its PM)".

```ts
// src/runtime/adapters/types.ts
export type RuntimeId = "node" | "bun"; // "deno" added later — see Deferred

export interface RuntimeAdapter {
    id: RuntimeId;
    /** Spawn spec — vis never hardcodes argv; adapters build it. */
    runFile(file: string, args: string[], opts: RunFileOpts): SpawnSpec;
    runScript(name: string, args: string[], opts: RunScriptOpts): SpawnSpec;
    install(opts: InstallOpts): SpawnSpec; // delegates into pm-runner today
    exec(bin: string, args: string[]): SpawnSpec; // dlx / local-bin
    scriptSource(cwd: string): "package.json"; // run discovery (deno.json later)
    versions: VersionManager; // install/ls/pin/use/which
    // permissions?: PermissionModel;                // reserved for the Deno adapter
}
```

### Runtime detection (`resolveRuntime`)

Precedence, highest first (stops at first hit):

1. Explicit `--runtime <node|bun>` flag.
2. `VIS_RUNTIME` env var.
3. `runtime:` field in `vis.config.ts` (new) / `vis.task.ts` per-project overlay.
4. Lockfile / config signals — reuse `pm-runner`'s table: `bun.lock(b)` → **bun**; `package.json` engines / `packageManager` / `pnpm-lock.yaml` / `package-lock.json` / `yarn.lock` → **node**. (`deno.json(c)` / `deno.lock` reserved for the deferred Deno adapter — for now, detecting it emits a "Deno not yet supported" notice rather than a silent Node fallback.)
5. Shebang / interpreter hint when running a file directly.
6. Default → **node** (zero regression for existing users).

Detection is per-project in a workspace (a monorepo may mix a Bun package and a Node package), resolved at the same point `resolveInstaller` runs today.

## Cross-cutting wrinkles (must be designed, not discovered)

- **Bun ↔ Node share the model.** Both use `package.json` + `node_modules`, so install/restore, workspace graph, and script discovery are uniform. This is exactly why Node + Bun is the clean first cut.
- **Catalog / lockfile-preflight.** pnpm has catalogs; Bun has workspace catalogs too — gate per-runtime where the flag/semantics differ (already partly gated in `pm-runner`).
- **Bun version-pin signal** is `.bun-version` (or `engines`/`packageManager`) — wire it into `vis runtime pin`.
- **task-runner native binding** spawns processes and is runtime-neutral — no change needed for it to drive Bun commands.
- **Backwards compatibility is non-negotiable.** When signals are Node or ambiguous, runtime = node and every existing command behaves identically. The pivot is additive at the code level even though it is a reposition at the product level.

## Deferred — Deno (not in this cut)

Deno is a planned third adapter, explicitly out of scope for the phases below. It is deferred because it breaks three assumptions Node + Bun share:

1. **Deny-by-default permissions** — `deno run` needs `--allow-*`; requires a `PermissionModel` on the adapter + a `permissions:` config block.
2. **No `node_modules`** — `npm:`/`jsr:` specifiers, optional `nodeModulesDir`; install/restore semantics diverge.
3. **Separate workspace/task model** — `deno.json` `tasks` + `workspace` field instead of `package.json`.

The `RuntimeAdapter` interface above reserves the seams (`permissions?`, `scriptSource()`) so adding Deno later is a new file under `src/runtime/adapters/`, not a reshape. Until then, detecting a Deno project emits an explicit "not yet supported" notice.

## Phased plan

### Phase 0 — RFC + Runtime foundation (no behavior change)

- This document; land in `rfc/`.
- `src/runtime/adapters/{types,node,bun}.ts` + `resolveRuntime()` in `src/runtime/`.
- Add `--runtime` global flag, `VIS_RUNTIME`, and `runtime:` in `src/config/types.ts` + validation in `src/config/config.ts`.
- Unit tests for detection precedence (mixed-runtime workspace fixtures).
- **Risk:** low. Pure addition; nothing wired to commands yet.

### Phase 1 — Route existing verbs through adapters (delegation)

- `install` / `add` / `remove` / `dedupe` / `dlx` / `exec` resolve a `RuntimeAdapter` and call into the **existing** `pm-runner` bun path. Mostly a seam, not new logic.
- `vis run` reads `package.json` scripts; executor routes to `bun run` (runtime = bun) or the existing Node path.
- **Risk:** medium — `run` is load-bearing; guard behind detection so Node path is byte-identical.

### Phase 2 — File runner `vis x <file>` (and bare `vis <file>`) — NEW

- Bun → `bun run <file>`; Node → existing `jiti` loader (already a dependency) or `node --experimental-strip-types` on capable versions.
- Auto-load `.env*` with expansion (reuse task-layer `env://` + `--strict-env` logic); data-file imports (YAML/TOML/JSONC/JSON5) via existing `@visulima` parsers for the Node path; shebang detection.
- **Explicit non-goal:** vis is NOT a runtime. No `module.registerHooks` polyfill layer, no Temporal/WebSocket/`node:sqlite` shims. Document the boundary: "use the runtime itself (or nub) for runtime semantics; `vis x` is a uniform launcher."
- **Risk:** low-medium. Thin wrapper over machinery that exists (jiti + `bun run`); the only real design is the `.env`/data-file load order for the Node path.

### Phase 3 — Native runtime version manager `vis runtime` — NEW (folds in old `vis node` plan)

```
vis runtime install <node|bun>@<version|lts>   # download + SHA-256 verify + atomic extract
vis runtime ls [--remote]
vis runtime use <id>@<version>                   # PATH shim ~/.vis/shims
vis runtime pin <id>@<version>                   # writes .node-version / .bun-version
vis runtime which <id>
vis runtime uninstall <id>@<version>
```

- Resolution reuses `src/runtime/toolchain.ts` precedence (`.node-version` → `.nvmrc` → `engines.node` → `devEngines`).
- **Coexist:** if proto/mise/fnm already manages a runtime, defer to it (detect-first, like aube-on-PATH). Native provisioning is the zero-dependency default, not a forced replacement — `vis toolchain` (delegating) stays.
- **Risk:** medium — network + checksum correctness. Constant-time verify mirrors the signed-cache-artifact pattern vis already uses.

### Phase 4 — Native hot paths + cold-start (Rust/NAPI in `native/`)

Driven by the measured baseline above — `vis exec` 855 ms / `vis run` 620 ms vs pnpm ~280 ms and nub ~11 ms.

- **Cold-start floor (biggest win, ~600 ms, every command):** lazy-load the 3.1 MB native binding (only when a command needs it), defer project-graph build until a target actually requires the graph, and profile cerebro + jiti boot. Independent of the runtime pivot; benefits all of vis. Track with `dispatch-internals.bench.ts` (logic) + the hyperfine `run`/`exec` scripts (end-to-end).
- **Local-first bin resolution for `dlx`/`exec`** (walk `node_modules/.bin`, exec directly; registry fallback) — `nubx`-class latency. Target: collapse `vis exec` from 855 ms toward/under pnpm's ~280 ms. This is why `vis exec` > `vis run` today, which is backwards.
- **Native download+verify** for Phase 3 (replaces shelling to curl/tar).
- **Install fast path** (from finding #3): a bare/`--fast` `vis install` that skips the preflight/security pipeline to close the +1.3 s gap over raw pnpm, or profile that pipeline.
- **Risk:** medium; isolated to `native/src` + the 8 `npm/` platform packages already in place. Re-run `__bench__/cli` before/after each change to confirm the gap closes.

### Phase 5 — Repositioning

- Cerebro command grouping: promote multi-tool verbs (`x`, `run`, `install`, `add`, `dlx`, `runtime`, `watch`) to the top help group; move orchestration (`cache`, `affected`, `graph`, `release`, `audit`, `secrets`, `attest`) under an "Advanced / Workspace" group.
- Rewrite `README.md` lede + `docs/guides/why-vis.mdx` (add Bun + nub columns; Deno column when that adapter lands).
- New guide `docs/guides/runtimes.mdx` (detection, permissions, version mgmt).

## Sequencing & risk summary

| Phase | Deliverable                                                                | New code vs reuse  | Risk           |
| ----- | -------------------------------------------------------------------------- | ------------------ | -------------- |
| 0     | Runtime abstraction + detection                                            | mostly new (small) | low            |
| 1     | Verbs route through adapters                                               | mostly reuse       | medium (`run`) |
| 2     | `vis x` file runner                                                        | new wrapper        | low-med        |
| 3     | `vis runtime` version mgr                                                  | new + reuse        | medium         |
| 4     | Native hot paths + cold-start (lazy binding, defer graph, local-first bin) | new (Rust)         | medium         |
| 5     | Repositioning / docs                                                       | docs + help        | low            |

Phases 0→2 are independently shippable and deliver the headline ("one tool, Node or Bun, run files + scripts + install"). Phases 3–4 are depth; Phase 5 is the public reposition.

## Open questions

1. `vis x` vs bare `vis <file>` — do we want the bare form (ambiguity with subcommands; cerebro arg parsing)? Lean: ship `vis x` first, add bare form behind a heuristic later.
2. Mixed-runtime monorepo: does `vis run build` fan out per-project-runtime automatically? Lean: yes — detection is per-project, the orchestrator already spawns per-project.
3. Do we vendor a runtime for true cold-start, or always require one present? Lean: never vendor; `vis runtime install` provisions on demand.
4. Deno re-entry: when Deno lands as a third adapter, does `vis x` default Deno permissions to warn-and-prompt or require explicit `--allow`? (Out of scope now; recorded so it isn't lost.)
