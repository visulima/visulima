# Design — Programmatic graph query

A stable, machine-readable way to interrogate the project + task graph from CI and tooling — the queryable backbone Turborepo shipped as `turbo query` (GraphQL, graduated to stable in 2.9, now their `affected`/automation primitive). We have human-facing explainers (`vis task-why`, `vis action-graph`) but no programmatic surface a script can depend on.

## Why

CI and codegen repeatedly need answers like "which packages does `@app/web` transitively depend on?", "what's affected by this SHA?", "which tasks read `tsconfig.base.json`?", "give me the task graph as JSON." Today each is a bespoke flag or a screen-scrape of `action-graph`. A single typed query surface:

- replaces `turbo-ignore`-style CI bail-out scripts (Turbo itself deprecated `turbo-ignore` in favour of `turbo query affected`),
- lets the `vis-mcp` server expose the graph to agents without a new endpoint per question,
- gives external tools a contract instead of parsing pretty-printed output.

## Approach

**Do not ship a GraphQL engine.** Turbo's GraphQL is elegant but heavy; our value is a _typed, composable JSON query_, not a query language. Two tiers:

### Tier 1 — library API (the real deliverable)

A pure function over the already-built graphs (`ProjectGraph` + `TaskGraph` from `task-graph.ts`):

```ts
import { queryGraph } from "@visulima/task-runner";

queryGraph(projectGraph, taskGraph, {
    select: "tasks", // "projects" | "tasks" | "edges"
    where: { affectedBy: "HEAD^1", reads: "tsconfig.base.json", tag: "type:lib" },
    fields: ["id", "dependsOn", "inputs", "hash"],
    format: "json", // "json" | "ndjson" | "dot"
});
```

It composes the predicates we already have in isolation: `affected.ts` (`expandAffected`, `getChangedFiles`), the hasher's resolved inputs, and the graph walkers (`buildForwardDependencyMap`/`buildReverseDependencyMap`, already exported). No new graph code — just a filter/projection layer.

### Tier 2 — CLI + MCP

- `vis query 'tasks where affectedBy=HEAD^1 select id,hash'` — a tiny query string parsed into the Tier-1 options object (kept deliberately small; not Turing-complete).
- `vis query affected` / `vis query ls` shorthands (Turbo parity).
- An `mcp__vis__query_graph` tool in `vis-mcp` that forwards to Tier 1 — agents get graph answers for free.

## Integration

- New `src/graph-query.ts` in task-runner, exported from `index.ts`. Read-only — consumes graphs, never mutates.
- `vis/src/commands/query/` — thin CLI wrapper, reuses `discoverWorkspace` + `buildProjectGraph` (already the `action-graph`/`task-why` entrypoints).
- Reuse `graph-visualizer.ts` for the `dot` output format.

## Risks / open questions

- Query-string grammar scope creep — keep it to `select / where / fields`, resist becoming a DSL. The library object is the contract; the string is sugar.
- Stability promise: this becomes a public API others script against, so version the option shape carefully.
- Overlap with `task-why`/`action-graph` — those stay as human explainers; `query` is the machine surface. Consider reimplementing `task-why` on top of `queryGraph` to dogfood it.

## Effort

Low–medium, and **very low risk** (read-only, no scheduler/cache hot-path touch). Good second pick after signed cache.
