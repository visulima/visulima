# Design — Distributed task execution (self-hostable)

Spread a run's tasks across **multiple machines** with a coordinator that assigns work by historical runtime and redistributes flaky/slow tasks — but **free and self-hostable**, not gated behind a paid cloud. This is Nx Agents/DTE's capability without Nx Cloud's lock-in, and the single biggest strategic differentiator: Turbo has _no_ distribution, vite-task has none, and Nx's is paid. Both competitor research passes independently flagged "free/self-hosted DTE + remote cache" as the soft spot to attack.

## Why

`vis run --partition N/M` already splits a graph statically across runners — but statically: runner 3 of 8 always gets the same third of the graph, blind to runtime. If that third happens to hold the 10-minute integration test, runner 3 is the long pole while the others idle. Dynamic distribution fixes this: a coordinator hands each free agent the next-most-valuable ready task, balancing by measured duration, and re-queues a task whose agent died or that flaked — turning wall-clock from "slowest static slice" into "critical path ÷ agents".

The enabling substrate already exists: **content-addressed remote cache** (`backends/`, REAPI + HTTP) is exactly the artifact transport DTE needs — an agent that finishes `lib:build` uploads outputs; the agent that runs `app:build` downloads them. We have the cache; we lack the coordinator.

## Approach

A coordinator/agent protocol over the existing remote cache for artifacts + a thin control channel for task assignment. Self-hostable: the coordinator is a process you run in CI (or a tiny service), not a SaaS.

```
                 ┌──────────────────────────────────────────┐
                 │  Coordinator (one process)                │
                 │   • holds the task graph + ready frontier │
                 │   • duration model (historical p50/p95)   │
                 │   • assigns ready tasks to free agents     │
                 │   • re-queues on agent loss / flaky retry  │
                 └───────────────┬──────────────────────────┘
        control (assign/report)  │   artifacts via remote cache (existing)
        ┌───────────────┬────────┴───────┬───────────────┐
        ▼               ▼                ▼               ▼
   Agent 1          Agent 2          Agent 3         Agent N
   (runs tasks, uploads outputs to remote cache, reports duration+result)
```

### Control channel

Minimal RPC (HTTP long-poll or a small WebSocket): agent → `claim()` returns the next assigned task (id + hash + command + needed input artifacts' hashes); agent → `report(taskId, code, durationMs, outputHash)`. The coordinator's state is the existing `TaskScheduler` (ready-frontier logic is already there) plus an assignment layer.

### Duration-aware assignment

Persist per-task p50/p95 durations (we already write run summaries — `run-summary.ts` — extend them into a duration store). Assign by **critical-path-first**: the task on the longest remaining chain to a leaf goes to the next free agent (`buildReverseDependencyMap` already gives the chains). This is the scheduling smarts Nx Cloud charges for.

### Artifact movement = existing cache

No new transport. An agent that completes a task `cache.put`s its outputs (signed — see `design-signed-cache-provenance.md`, which becomes _mandatory_ here: distributed = untrusted agents = must verify). A downstream agent `cache.get`s its deps' outputs before running. Cache miss on a dep = coordinator schedules that dep first.

## Integration

- New `src/distributed/` (coordinator + agent), built on `task-scheduler.ts` (reused as the coordinator's ready-frontier engine) + `backends/` (artifact transport).
- `vis run --coordinator` / `vis agent --connect <url>` CLI entrypoints.
- `run-summary.ts` → durable duration store for the assignment model.
- **Hard dependency on signed cache** — ship that first.

## Risks / open questions

- **This is a distributed system** — agent loss, network partition, duplicate execution, coordinator crash/resume, idempotent re-queue. Needs a real consistency model + chaos tests, not just unit tests.
- Input artifact availability: a task can only run where its deps' outputs are reachable → tight coupling to remote-cache hit rate; cold cache degrades to near-serial.
- Trust: agents are mutually untrusted; signed+provenanced artifacts are non-negotiable, and the control channel needs auth.
- Security parallel to Nx's CREEP CVE: a rogue agent must not be able to poison artifacts other agents trust — provenance + signing is the structural defense.
- Scope: a "good enough" v1 is critical-path assignment + retry over the existing cache; the duration model and flaky-redistribution can come second.

## Effort

High (multi-week). Genuine distributed-systems work. **The headline differentiator if executed well, the biggest footgun if rushed.** Sequence: signed cache → this coordinator (v1: critical-path + retry) → atomizer (which feeds it fine-grained tasks). RFC-grade; needs its own design review before any code.
