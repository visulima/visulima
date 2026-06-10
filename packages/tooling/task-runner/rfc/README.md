# task-runner RFCs

Design docs for proposed **engine** features. Each is a spec to review **before** implementation — nothing here has landed unless noted.

`task-runner` is the engine; `vis` is the tool that calls it. Features that live in the CLI/tool layer have their RFCs under [`packages/tooling/vis/rfc/`](../../vis/rfc/), not here.

## Shipped designs (already implemented)

- [`design-fspy-seccomp-unotify.md`](./design-fspy-seccomp-unotify.md) — Linux syscall-trace fingerprinting via `seccomp_unotify`.
- [`design-fspy-windows-detours.md`](./design-fspy-windows-detours.md) — Windows file-access tracing via Detours/IAT.
- [`design-task-runner-client-ipc.md`](./design-task-runner-client-ipc.md) — cooperative cache hints (`@visulima/task-runner-client`).

## Proposed (engine)

From the competitive gap analysis vs Turborepo / Nx / vite-task, **after** filtering out what `task-runner`/`vis` already ship. Ordered by recommended sequence.

| RFC                                                                          | Closes gap vs                                        | Effort       | Risk                           | Depends on                   |
| ---------------------------------------------------------------------------- | ---------------------------------------------------- | ------------ | ------------------------------ | ---------------------------- |
| [`design-signed-cache-provenance.md`](./design-signed-cache-provenance.md)   | Turbo signatures · **Nx CVE-2025-36852 (CREEP)**     | Small–med    | Low (opt-in)                   | —                            |
| [`design-import-boundaries.md`](./design-import-boundaries.md)               | Turbo `boundaries` · `@nx/enforce-module-boundaries` | Med          | Low (isolated)                 | —                            |
| [`design-continuous-sidecar-tasks.md`](./design-continuous-sidecar-tasks.md) | Turbo `with` · Nx `continuous: true`                 | Med–high     | **High (scheduler core)**      | —                            |
| [`design-batch-executor.md`](./design-batch-executor.md)                     | Nx `--batch` (tsc)                                   | Med–high     | High (scheduler + cache demux) | —                            |
| [`design-distributed-execution.md`](./design-distributed-execution.md)       | **Nx Agents/DTE (paid)**                             | High (weeks) | High (distributed system)      | **signed-cache (mandatory)** |

## Moved to `vis` (tool layer)

These are CLI/tool concerns; their RFCs live under [`vis/rfc/`](../../vis/rfc/):

- `design-interruptible-watch-restart.md` — restart a persistent task on input change; `vis` owns `watch`.
- `design-atomizer.md` — split test/e2e suites into per-file tasks; `vis` owns target synthesis (`config/workspace.ts`).

## Dropped (already shipped — not gaps)

- **Programmatic graph query** (`turbo query`) — `vis action-graph --json --query` already emits the task graph as JSON with project filtering; `vis task-why`/`vis why` explain task inclusion; `vis affected` covers affected.
- **Sync generators** (`nx sync`) — `vis sync` already reconciles codeowners, `package.json` fields, and **tsconfig references** (`--check` for CI).

## Where we already lead (no RFC needed)

- **Trace/auto-fingerprint** with missing-file probes + directory listings — parity with vite-task (its only real differentiator), ahead of Turbo/Nx (they need hand-declared inputs).
- **Two remote backends** — Turbo-compatible HTTP **and** Bazel REAPI gRPC. Nobody else has REAPI.
- **Cooperative in-process cache hints**, **self-modified-input detection**, **`when:`/`always:` tasks**, **branch-scoped local cache**, **JIT hashing**, **smart lockfile hashing**, **worktree cache sharing**, and `vis`-layer **`docker prune`**, **services**, **project constraints**.
- **A real MCP server** (`vis-mcp`) — Turbo ships Skill-only; parity with Nx.

## Recommended first build

**signed cache** — cheapest high-value win, opt-in so zero blast radius, a marketing-grade security differentiator (free + self-hostable + signed — exactly what Nx just deprecated four cache plugins over), and a hard prerequisite for **distributed execution**, the headline differentiator.
