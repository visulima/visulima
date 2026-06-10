# Design — Continuous / sidecar tasks (`continuous` + `with`)

Let a long-running task be a **graph dependency** instead of a blocking step, so one command (`vis dev app`) brings up `api:serve` + a codegen watcher + the app, wires their lifetimes together, and tears them all down on exit. Matches Nx `continuous: true` and Turborepo `with` (sidecar tasks).

## Why

We already have the pieces but not the wiring:

- **Persistent tasks** exist (`TargetConfiguration` has no explicit `persistent`, but `pty`/long-running spawns do) and the orchestrator runs `always`/finally tasks.
- **`vis services`** (`vis/src/commands/run/service-*.ts`) auto-starts service _dependencies_ and tears them down — conceptually ~70% of `with`, but it's a vis-layer side-channel, not part of the task graph the scheduler reasons about.

What's missing is a first-class graph notion: "task B depends on continuous task A, but must **not wait for A to exit** — A starts, becomes _ready_, B runs against it, and A is killed when B (and all its co-dependents) finish." Today a `dependsOn` edge to a never-exiting task **deadlocks** the scheduler (it waits for completion).

## Approach

Add two orthogonal concepts:

### `continuous: true` (on `TargetConfiguration`)

Marks a task as long-running and **never "completes"** in the dependency sense. The scheduler treats a dependent as unblocked once the continuous task is **ready** (not exited).

- **Readiness signal**: reuse the existing `warningPattern`/output-scan machinery → add `readyPattern?: string | string[]` (regex on stdout, e.g. `"Local:\\s+http"`), with a port-open probe fallback (vis service-preflight already has one) and a timeout.
- **Lifecycle**: a continuous task is reference-counted by its dependents. When the last dependent settles, the scheduler sends it SIGTERM→SIGKILL via the existing process-tree teardown (`concurrent.ts` killpg / Job Objects). On run abort, all continuous tasks die with the run (same contract as today's persistent tasks).
- **Never cached** (output is a live process), `cache` forced false — mirror the existing persistent handling in `run/handler.ts:1562`.

### `with` (on `TargetConfiguration`)

Sugar for "start these sibling continuous tasks alongside me": `build: { with: ["api#serve"] }`. Desugars to `dependsOn` edges against `continuous` tasks scoped to _this_ task's lifetime. Turbo-compatible spelling.

## Scheduler changes (`task-scheduler.ts` + `task-orchestrator.ts`)

This is the load-bearing, risky part — it touches the readiness/completion model:

```
getReadyTasks(): a dependent is ready when every dep is
  completed  OR  (dep.continuous AND dep.ready)        ← new clause
```

- `TaskScheduler` gains a `#readyContinuous: Set<taskId>` distinct from `#completedTasks`.
- The orchestrator's execution loop learns a third terminal state for continuous tasks: `ready` (resolves dependents) without `complete` (keeps the process alive + ref-counted).
- A continuous task whose readiness probe fails/timeouts is a hard failure that cascades to dependents (same as an exit-nonzero today).

## Integration

- `types.ts` — `TargetConfiguration.continuous?`, `readyPattern?`, `with?`; `Task` carries them through `task-graph.ts` (already copies `pty`/`maxConcurrent`/etc. at lines 138-156).
- `task-graph.ts` — `with` expands to dependency edges before cycle-breaking.
- `task-orchestrator.ts` — ref-count + teardown; reuse `#runAlwaysTasks` teardown plumbing.
- `vis run` — fold the existing `services` auto-start into this model so a configured service becomes a `continuous` dependency (one mechanism, not two).

## Risks / open questions

- **Deadlock & teardown correctness** is the whole ballgame: a continuous task that never signals ready, a dependent that crashes before releasing its ref, diamond dependents sharing one continuous task. Needs exhaustive scheduler tests (we already Linux-gate real-child cancellation tests — extend that harness).
- Readiness detection is heuristic (`readyPattern`/port-probe). Document that explicitly; offer the cooperative `task-runner-client` a `ready()` call as the precise opt-in.
- Interaction with `--partition`, `concurrencyGroups`, and watch mode (see the interruptible-restart RFC — a `continuous` task is the prime `interruptible` candidate).

## Effort

Medium–high. New config is easy; the scheduler readiness/teardown model is the hard, regression-prone core. **Build after the cheap wins**, with the cancellation test harness extended first.
