# Design — Interruptible persistent-task restart on watch

In watch mode, restart a long-running task (dev server, codegen watcher) when _its own inputs_ change, instead of leaving a stale process running. Matches Turborepo `interruptible: true` (the watch counterpart to `persistent`).

## Why

`vis run --watch` (`vis/src/watch/`) today re-runs **terminal** affected tasks on file change. But a persistent/`continuous` task (a dev server) is never "re-run" — it's started once and lives for the session. So when you edit a file the server doesn't hot-reload, the watcher has no way to bounce it: the process keeps running with stale state and the only fix is Ctrl-C + restart the whole command. Turbo solved this with `interruptible: true` — a persistent task the watcher is _allowed_ to kill-and-restart.

We also already have `flow-controllers/restart-process.ts` (restart-with-backoff on **crash**); this is the same capability driven by **input change** instead of exit.

## Approach

Add `interruptible?: boolean` to `TargetConfiguration` (only meaningful with persistent/`continuous`). In watch mode, when a change touches an interruptible task's input set:

1. Compute the affected set as today (`affected.ts` over the changed files).
2. For affected **interruptible** tasks: tear down the running process (existing SIGTERM→SIGKILL process-tree teardown in `concurrent.ts`), then re-spawn it — debounced, and respecting the dependency order (restart upstream continuous deps before dependents if both changed).
3. Non-interruptible persistent tasks are left alone (today's behaviour) — opt-in only.

The input set for an interruptible task is exactly its fingerprint inputs:

- **declared mode**: its `inputs` globs (already resolved by the hasher).
- **trace mode**: the file set the last run actually read (`fingerprint.fileHashes` keys) — so the watcher reacts to precisely what the process depends on, no manual globs. This is the same "watch using task inputs" idea Turbo has as a future flag, and we get it for free from the trace fingerprint.

## Integration

- `types.ts` — `TargetConfiguration.interruptible?`.
- `vis/src/watch/` — the change handler gains an interruptible-restart branch; reuse `restart-process.ts`'s teardown + backoff (factor its kill/respawn out so both crash-restart and change-restart share it).
- Ties into `design-continuous-sidecar-tasks.md`: a `continuous` task is the canonical `interruptible` candidate; the restart must re-establish readiness before unblocking dependents again.

## Risks / open questions

- Restart storms on rapid edits — debounce + coalesce (the watcher likely already debounces; confirm).
- Ordering: if both a continuous dep and its dependent are interruptible and both inputs change, restart dep→dependent and re-probe readiness between.
- Output continuity in the TUI — a restart shouldn't wipe scrollback; mark the boundary.

## Effort

Low. Small config addition + reuse of existing teardown/backoff; the only subtlety is debounce + dependency-ordered restart. Best done **together with** the continuous-tasks work since they share the persistent-task lifecycle.
