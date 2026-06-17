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

**Decision: do not add oxc now.** The Node boot floor (~117 ms) is the real anchor and is only
beatable by a thin Rust launcher (a much larger effort, out of scope). The user's goal — nub feature
parity + best speed — is met by the lean+jiti path (`vis x` is competitive with tsx). oxc remains a
clean, well-scoped follow-up _if_ a future need appears (e.g. very large cold multi-file graphs, or
dropping the jiti dependency); nub's mechanism is documented above for that case.

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

## Feature-parity status vs nub

Done: file runner (`vis x`), script runner (`vis run`), package runner (`vis dlx`/`exec`/`visx`),
package manager (`vis install/add/...`), meta-manager (`vis pm`), watch (`vis run --watch`),
runtime selection across all PM verbs + `vis x`. Speed: `vis x` 431→131 ms, cold-start −290 ms.
Deferred: native runtime version manager (above); Deno adapter; runtime polyfills (out of scope —
vis is a launcher, not a runtime).
