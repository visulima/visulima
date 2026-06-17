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
