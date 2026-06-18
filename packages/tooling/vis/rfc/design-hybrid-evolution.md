# Design — vis hybrid evolution (native fast-commands + runtime augmentation)

The "next evolution": make vis a nub-class hybrid — a Rust front-end that handles
fast/static commands natively and delegates heavy orchestration to the Node CLI —
plus a **runtime augmentation layer** (flag-injection, polyfills, optional PATH
shim) so vis can normalize and accelerate the runtime under user code.

This RFC is the umbrella roadmap. The launcher mechanics live in
`design-rust-launcher.md`; this document covers (1) which commands can go native
and which can't, (2) the augmentation layer, and (3) the forks that need a product
decision before they're built.

## Where we are (proven this round)

The hybrid model is no longer hypothetical — measured slices, all on `feat/runtime-multitool`:

| Slice                         | Result                        | Mechanism                                                                     |
| ----------------------------- | ----------------------------- | ----------------------------------------------------------------------------- |
| `--version` native            | 247 ms → **2.4 ms**           | baked version string in Rust, no Node                                         |
| `exec` / `dlx` native         | 171 ms → **8.1 ms** \*        | PM detected (`pm.rs` lockfile walk) + spawned directly, no Node CLI           |
| Heap flags native (`heap.rs`) | no JS re-exec (~290 ms saved) | `sysconf` RAM → `--max-old-space-size`/`--max-semi-space-size` on first spawn |

\* dispatch overhead only (instant fake PM); real win on a normal machine is
~163 ms of Node boot + module load stripped off every `vis exec`/`vis dlx`.

The pattern is now established: **resolve in Rust, spawn the real worker directly,
skip the Node CLI boot entirely** for commands that don't need vis's JS logic.

## Part 1 — Native fast-command tier: what can and can't go native

The deciding question for each command: **does it need vis's JS logic (config,
security gate, task-runner, reporters), or is it a thin resolve-then-spawn?**

### Safe to nativize (pure resolve-then-spawn — no JS logic gates them)

- ✅ `exec` / `dlx` — done. `securityEnforcementPlugin` gates install/PM verbs, not these.
- `run <script>` (package.json scripts, **not** the task-runner graph) — a candidate:
  read `package.json#scripts[name]`, spawn the PM's `run`. BUT vis's `run` today
  routes through `@visulima/task-runner` (caching, monorepo graph, affected). Those
  are real features, not overhead. **Recommendation:** only nativize the _trivial_
  case (single package, no cache config, no `--filter`) and delegate everything
  else to JS — and only if measurement shows the trivial case is common enough to
  matter. Otherwise the launcher's heap+boot avoidance already covers `run`.
- `--help` / `completion` / bare `vis` — static text; emit from Rust (item 5 in the launcher RFC).

### NOT safe to naively nativize (JS logic is load-bearing)

- `install` / `add` / `remove` / `dedupe` / `update` — gated by
  `securityEnforcementPlugin` (advisory checks, OSV bloom filter, lockfile policy,
  secret scanning). nub does install in Rust because nub _reimplements the
  resolver + policy in Rust_. vis's security stack lives in JS
  (`@visulima/secret-scanner`, `src/security/advisories.ts`, `osv-bloom.ts`).
  Nativizing install would mean either **(a)** duplicating the entire gate in Rust
  (huge, and a permanent drift hazard — the gate is vis's product), or **(b)** Rust
  does the fast resolve and shells back to JS for the security gate (a
  hybrid-within-the-hybrid). **Recommendation:** keep install/PM verbs in JS; the
  launcher already gives them the heap+boot win. Revisit only if the JS gate
  becomes the measured bottleneck (it isn't — Node boot is).
- `audit` / `sbom` / `scan` / `graph` / `cache` — heavy in-process JS; stay JS (they're why heap tuning exists).

### The principle

The launcher accelerates two ways, and they compose: **(1)** native handling for
resolve-then-spawn commands (no Node CLI at all), and **(2)** for everything else,
a single Node boot with heap flags already applied (no re-exec). We do **not**
reimplement vis's product (security, caching, reporting) in Rust. That line is what
keeps the hybrid honest and maintainable.

## Part 2 — Runtime augmentation layer

Three layers, increasing in invasiveness. The launcher already does flag-injection
(heap flags), so (a) is a natural extension; (c) is a product decision.

### (a) Unflag / flag-injection layer — SAFE, recommended

A Node-version-keyed **feature matrix** drives extra flags injected on the Node
spawn: experimental flags that the floor (22.14) still needs but newer Node has
stabilized, perf flags, source-maps. The launcher detects the Node version (cheap:
`node -v` once, cached, or read from the pinned toolchain) and applies the matching
flags. This is exactly what the heap-flag injection already does, generalized.

- Data source: Node's public release/changelog data (which flag stabilized in which
  version). Curated into a small static table shipped with vis — **not** scraped at runtime.
- Scope: vis's own Node spawns + `vis x` user scripts. Opt-out via env.
- Risk: low. Flags are additive and version-gated; a wrong flag fails loudly at spawn.

### (b) Polyfill layer (for `vis x` user scripts) — SAFE, opt-in

Inject JS polyfills into the **preload** for user scripts that need APIs the floor
Node lacks (e.g. `Temporal`, `URLPattern`). Use public, audited polyfill packages
(`@js-temporal/polyfill`, `urlpattern-polyfill`), **feature-detected** — only
installed onto `globalThis` when the native API is absent, so newer runtimes are
untouched. Scope is strictly `vis x` user code; vis's own runtime is never polyfilled.

- Mechanism: rides on the `x`-preload path (launcher RFC item 4). The preload
  registers the oxc loader, autoloads `.env`, then conditionally installs polyfills.
- Risk: low–medium. Polyfills can subtly differ from native; hence feature-detect +
  opt-in (`--polyfill` / config), never silent for all scripts.

### (c) Shim layer — two mechanisms, NOT a global `node` hijack

An earlier framing of this was "a PATH shim that hijacks every `node` on the
machine." Studying how `nubjs/nub` actually does it (the only shipped prior art)
corrected that: nub does **not** persistently hijack `node`. It splits the problem
into two mechanisms with very different scopes, and vis should follow the same split.

**(c.1) Persistent PM shims — opt-in, the `vis shim install` model.** nub's
persistent shims cover only the **package-manager binaries** (`npm npx pnpm pnpx
yarn yarnpkg`) — **never `node`**. The design, worth reusing:

- A shim dir (`~/.nub/shims`, hardlinks to the one binary) activated by a
  shell-profile PATH block; install/remove are explicit verbs. Shims live on the
  _install_ surface, never the cache (clearing a cache must not break PATH).
- **argv0 dispatch**: invoked as `pnpm`, the binary reads its own argv0 and applies
  a **strict agreement check** — refuse if the invoked PM ≠ the repo's pinned PM —
  with two escape hatches that keep it usable: **transparent verbs**
  (`init create dlx exec` always pass) and a **nesting check** via
  `npm_config_user_agent`/`npm_execpath` (typed-at-a-shell = hard refuse; invoked by
  a running PM's lifecycle script = silent fall-through). The nesting signal is an
  `npm_*` var the ecosystem owns — brand-safe, not a private sentinel.
- **Recursion guard**: the PATH fall-through that finds the real PM skips the shim
  dir, so the shim never re-invokes itself.

**(c.2) Ephemeral per-run `node` routing — NOT persistent, NOT global.** nub routes
`node` through itself only for the duration of a `nub run`/exec, via a temp dir
`nub-node-shim-<pid>` (a `node` symlink → the binary) prepended to the _child
subtree's_ PATH and torn down on exit (with a reaper for killed runs; published
atomically for concurrent workspace spawns; `which_node` skips the shim dir to avoid
recursing). This is what actually delivers the augmentation layer to scripts a run
launches — scoped to that process tree, never touching unrelated `node` calls.

**Recommendation for vis (matches the chosen "project-local, opt-in"):**

- Persistent shims → **PM binaries only**, opt-in via `vis shim install` /
  `vis shim uninstall`, activated by a project-local `.vis/shims` PATH entry (never
  automatic, never global). Reuse nub's argv0 + strict-agreement + transparent-verbs
    - `npm_config_user_agent` nesting + shim-dir-skip recursion guard.
- `node` routing → **ephemeral, scoped to `vis run`/`vis x`** (a per-pid temp dir on
  the child's PATH), the safe way to feed scripts the unflag/polyfill layers. **No
  persistent or global `node` shim.**

This is strictly safer than the original "global node hijack" framing and is the
shape a security review will accept: durable interception is PM-only and opt-in;
runtime interception is disposable and run-scoped.

## Part 3 — Sequencing

Independent of the big decisions, these are safe to proceed on:

1. ✅ Native `exec`/`dlx`, native heap flags.
2. ✅ `x`-preload path (`preload.ts` + launcher gate on Node >= 22.15). At the Node-boot floor
   (≈ the lean JS path, not faster) — built as the polyfill/unflag entry point, not for speed.
3. ✅ Unflag layer (2a) — `flags.rs`, opt-in `VIS_UNFLAG`, version-gated (`sourcemaps`/`sqlite`/
   `webstorage`), injected on the `x` Node spawn. Default `vis x` unchanged.
4. ✅ Polyfill layer (2b) — `polyfills.ts`, opt-in `VIS_POLYFILL`, feature-detected, resolved from
   the user's project; wired into BOTH the preload and the in-process `vis x` path.
5. Packaging + bin flip (launcher RFC items 6–7) — **the gate to any of this reaching users.**

Decisions taken (2026-06-18):

6. PATH shim (2c) — **explicit opt-in, project-local** (`vis shim install`/`uninstall`, `.vis/shims`
   inside a vis project; never automatic/global). To build.
7. `run`/install — **Rust resolve + JS security gate**: launcher resolves fast, shells back to the JS
   security stack for the gate; no Rust reimplementation of vis's security product. To build.

## Open decisions (need the user)

1. **PATH shim scope** — global hijack / project-local only / explicit opt-in command / skip for now.
2. **install + run nativization** — keep JS (launcher boost only) / Rust resolve + JS
   security gate / full Rust reimplementation.
3. **What to build next** — x-preload, unflag layer, polyfill layer, or the
   packaging/shipping work that makes the launcher actually reach users.

## Risks

- **Packaging is the real gate.** None of the launcher/augmentation wins reach users
  until the per-platform binaries ship and the `bin` flips. That work (CI matrix,
  optional-dep resolution, clean fallback) is the bulk of the effort.
- **Drift between Rust and JS.** Every thing the launcher decides natively (PM
  detection, heap heuristic, flag matrix) is a second source of truth that can drift
  from the JS CLI. Keep native logic to resolve-then-spawn + additive flags; never
  duplicate the product (security/caching/reporting).
- **The augmentation layer changes runtime behaviour** under user code — keep it
  feature-detected, version-gated, and opt-in for anything beyond additive flags.
