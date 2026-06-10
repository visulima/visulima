# Design — Sync generators

Keep **derived workspace state** consistent with the project graph, and (optionally) run that reconciliation _before_ a task so it never builds against stale generated files. Matches Nx `nx sync` / `nx sync:check` (shipped Nx 20).

## Why

A monorepo has files that are _functions of the graph_ but maintained by hand, so they drift:

- TypeScript project-reference `references` in each `tsconfig.json` should mirror the package dependency edges. Drift → `tsc --build` is wrong or slow.
- `package.json` `dependencies` vs the imports actually present (the inverse of the boundaries RFC — boundaries _detects_ drift, sync _fixes_ it).
- Generated barrels, workspace globs, CODEOWNERS derived from `project.json` owners.

Today nothing closes this loop; `vis` can _detect_ some of it (constraints) but not _reconcile_ it, and there's no pre-task hook to guarantee freshness.

## Approach

A small generator contract + two run modes, modelled on Nx's task- and global-sync split.

### Contract

```ts
interface SyncGenerator {
    name: string;
    // returns the set of file edits needed to reconcile state with the graph
    sync(ctx: { projectGraph; workspaceRoot; fs }): Promise<FileChange[]>;
}
```

`FileChange` = `{ path, contents }` (or delete). A generator is **pure-ish**: it computes desired state; the runner applies or diffs it. Ship a built-in `tsconfigReferences` generator (the highest-value one) and let plugins register more via the existing `vis` plugin system (`define-plugin.ts` already has hook points).

### Modes

- `vis sync` — apply all registered generators (writes files).
- `vis sync --check` — compute the diff, **exit non-zero** if anything is out of date (CI gate). Prints the would-be edits.
- **Task sync** (`syncBeforeTasks` on a target, like Nx's per-target sync) — run the relevant generators _before_ the task, so e.g. `build` always sees correct `tsconfig` references. Wired as a special pre-step in the orchestrator, analogous to `dependsOn` but graph-reconciling rather than task-running.

## Integration

- New `src/sync/` in task-runner: the `SyncGenerator` contract + the built-in `tsconfigReferences` generator (pure graph→edits, fully unit-testable without IO).
- `vis/src/commands/sync/` — `apply`/`check` CLI, reuses `discoverWorkspace` + `buildProjectGraph`.
- Orchestrator: an optional pre-run sync phase gated by `syncBeforeTasks`; must run before hashing (it changes inputs!) — important ordering note.
- Plugin registration via `VisHooks` (mirror how `task:fingerprint` is wired).

## Risks / open questions

- **Ordering vs hashing**: task-sync must mutate files _before_ the hasher reads them, or you cache against pre-sync state. This is the same hazard as the self-modified-input detection we already have — reuse that awareness.
- Generators that write must be deterministic and idempotent (running twice = no diff), or `--check` flaps.
- Scope discipline: ship only `tsconfigReferences` built-in; everything else is a plugin. Resist turning this into Nx's full generator framework — that's a different, much larger thing (code scaffolding ≠ sync).

## Effort

Medium, mostly isolated. The `tsconfigReferences` generator is a tidy, testable first deliverable; the orchestrator pre-task ordering is the one place that touches the hot path (handle carefully). Lower priority than signed cache / query / boundaries.
