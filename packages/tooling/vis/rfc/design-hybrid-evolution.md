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

### (c) PATH shim that hijacks `node` — POWERFUL, INVASIVE, needs a decision

Install a `node` shim early on `PATH` (`~/.vis/shims/node`) so **every** `node`
invocation on the machine routes through vis, applying the unflag/polyfill/version
layers everywhere — not just under `vis`. This is the most powerful augmentation
(it makes vis the runtime's front-door globally) and the most dangerous:

- It intercepts unrelated tools' `node` calls (editors, other CLIs, CI). A bug or a
  wrong flag there breaks software that has nothing to do with vis.
- It's a global, persistent mutation of the user's environment.
- Security/trust: a shim on PATH that wraps the runtime is exactly the shape of
  things security tooling flags.

**Recommendation:** if built at all, make it **explicit and opt-in only**
(`vis shim install` / `vis shim uninstall`), never automatic, project-local
(`.vis/shims` prepended only inside a vis project) before considering global, with a
loud status line and a trivial uninstall. This is a genuine product decision, not an
implementation detail — see the decisions below.

## Part 3 — Sequencing

Independent of the big decisions, these are safe to proceed on:

1. ✅ Native `exec`/`dlx`, native heap flags (done).
2. `x`-preload path (launcher RFC item 4) — unblocks the polyfill layer too.
3. Unflag layer (2a) — generalize the existing flag-injection with a version matrix.
4. Packaging + bin flip (launcher RFC items 6–7) — **the gate to any of this reaching users.**

Gated on a decision:

5. Polyfill layer (2b) — opt-in, rides on (2).
6. PATH shim (2c) — only if/when the user opts into the product direction.
7. `run`/install nativization — only if measurement justifies it (it currently doesn't).

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
