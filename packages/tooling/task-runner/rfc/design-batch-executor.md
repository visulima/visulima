# Design — Batch executor execution

Run many same-tool tasks (e.g. `tsc` across N packages) in **one process** instead of N, amortising tool startup + sharing cross-project state (TS project references / incremental program). Matches Nx `--batch` / `NX_BATCH_MODE` (1.16–7.7× faster for tsc-heavy graphs).

## Why

Our scheduler spawns one child per task (`concurrent.ts`). For a graph of 50 TS libraries, that's 50 cold `tsc` boots, each re-parsing `lib.d.ts` and the dependency closure — pure waste. `tsc` (and a few other tools) can build a whole project-reference graph in a single incremental program, which is where Nx's batch mode gets its multiples. The cost is a different execution contract: the runner hands a **set** of tasks to one executor invocation and gets back a per-task result map.

## Approach

A new, **opt-in, executor-aware** path alongside the default one-process-per-task path. Most tasks stay on the normal path; only targets whose executor advertises batch support take it.

### Batch contract

```ts
interface BatchExecutor {
    // can these tasks be co-executed in one process?
    canBatch(tasks: Task[]): boolean;
    // run them together; return a result per task id
    runBatch(tasks: Task[], ctx): Promise<Map<taskId, { code; terminalOutput }>>;
}
```

Ship a built-in `tsc` batch executor that:

- collects all ready `tsc` tasks in the current scheduler tick whose `executor` is the batch-tsc executor,
- emits a synthetic solution `tsconfig` with `references` to each (or uses existing refs — see the sync-generators RFC, which makes this reliable),
- runs `tsc --build` once,
- demultiplexes diagnostics back to per-task `terminalOutput` + exit codes by output path.

### Scheduler integration (the hard part)

The scheduler currently releases tasks individually (`getNextBatch`). Batch mode needs it to:

1. Identify a **batchable cohort** among the ready set (same batch executor, dependency-compatible — all deps already done).
2. Hand the cohort to `runBatch` as a unit.
3. Caching still happens **per task**: each task in the cohort is hashed and cache-checked individually _before_ batching (cache hits drop out of the cohort); after `runBatch`, each task's outputs are cached under its own hash. So batching is an _execution_ optimization only — cache keys and restore are unchanged, preserving correctness.

```
ready set ─▶ partition by executor
            ├─ normal tasks ─▶ per-task spawn (today)
            └─ batch tasks  ─▶ cache-filter ─▶ runBatch(cohort) ─▶ per-task cache.put
```

## Integration

- `types.ts` — `TargetConfiguration.executor` already exists; define a batch-executor registry + `BatchExecutor` interface.
- `task-scheduler.ts` / `task-orchestrator.ts` — cohort selection + the batch execution branch. Per-task hashing/caching reused verbatim (no cache-key change).
- Native: not required initially (tsc batch is JS-orchestrated), but the demux of diagnostics could use the native file walk.

## Risks / open questions

- **Correctness of the cache boundary**: a batched cohort that partially fails must attribute failure to the right task and _not_ cache the failed ones while still caching the succeeded ones. Per-task output demux must be exact.
- Concurrency accounting: a batch occupies one process but represents N tasks — how does it count against `--parallel` / `concurrencyGroups`? Define it as 1 slot but N graph-completions.
- Only a few tools batch usefully (tsc, maybe gradle, esbuild bundles). Don't over-generalise; ship tsc, leave the interface for plugins.
- Interacts with trace-mode fingerprinting: a batch process reads everything for all tasks, so per-task **trace** attribution is impossible — batch mode is **declared-inputs only**. Document and enforce (a `hashMode: "trace"` target can't batch).

## Effort

Medium–high. The `tsc` executor is bounded; the scheduler cohort logic + per-task result demux is the regression-prone core, and the trace-incompatibility is a real constraint. RFC-grade — **do not rush into the released scheduler.** Lower priority unless users are demonstrably tsc-bound.
