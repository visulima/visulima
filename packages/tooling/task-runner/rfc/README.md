# task-runner RFCs

Design docs for proposed features. Each is a spec to review **before** implementation — nothing here has landed.

## Shipped designs (already implemented)

- [`design-fspy-seccomp-unotify.md`](./design-fspy-seccomp-unotify.md) — Linux syscall-trace fingerprinting via `seccomp_unotify`.
- [`design-fspy-windows-detours.md`](./design-fspy-windows-detours.md) — Windows file-access tracing via Detours/IAT.
- [`design-task-runner-client-ipc.md`](./design-task-runner-client-ipc.md) — cooperative cache hints (`@visulima/task-runner-client`).

## Proposed (competitive gap analysis vs Turborepo / Nx / vite-task)

Ordered by recommended sequence. Effort and dependencies noted; "RFC-grade" = needs its own design review before code.

| #   | RFC                                                                                | Closes gap vs                                        | Effort       | Risk                           | Depends on         |
| --- | ---------------------------------------------------------------------------------- | ---------------------------------------------------- | ------------ | ------------------------------ | ------------------ |
| 1   | [`design-signed-cache-provenance.md`](./design-signed-cache-provenance.md)         | Turbo signatures · **Nx CVE-2025-36852 (CREEP)**     | Small–med    | Low (opt-in)                   | —                  |
| 2   | [`design-graph-query.md`](./design-graph-query.md)                                 | Turbo `turbo query`                                  | Low–med      | Very low (read-only)           | —                  |
| 3   | [`design-import-boundaries.md`](./design-import-boundaries.md)                     | Turbo `boundaries` · `@nx/enforce-module-boundaries` | Med          | Low (isolated)                 | —                  |
| 4   | [`design-interruptible-watch-restart.md`](./design-interruptible-watch-restart.md) | Turbo `interruptible`                                | Low          | Low                            | #5                 |
| 5   | [`design-continuous-sidecar-tasks.md`](./design-continuous-sidecar-tasks.md)       | Turbo `with` · Nx `continuous: true`                 | Med–high     | **High (scheduler core)**      | —                  |
| 6   | [`design-sync-generators.md`](./design-sync-generators.md)                         | Nx `nx sync`                                         | Med          | Med (pre-hash ordering)        | —                  |
| 7   | [`design-batch-executor.md`](./design-batch-executor.md)                           | Nx `--batch` (tsc)                                   | Med–high     | High (scheduler + cache demux) | #6 helps           |
| 8   | [`design-distributed-execution.md`](./design-distributed-execution.md)             | **Nx Agents/DTE (paid)**                             | High (weeks) | High (distributed system)      | **#1 (mandatory)** |
| 9   | [`design-atomizer.md`](./design-atomizer.md)                                       | Nx Cloud atomizer                                    | High         | High                           | #5, #8             |

## Where we already lead (no RFC needed)

- **Trace/auto-fingerprint** with missing-file probes + directory listings — parity with vite-task (its only real differentiator), ahead of Turbo/Nx (they need hand-declared inputs).
- **Two remote backends** — Turbo-compatible HTTP **and** Bazel REAPI gRPC. Nobody else has REAPI.
- **Cooperative in-process cache hints**, **self-modified-input detection**, **`when:`/`always:` tasks**, **branch-scoped local cache**, **JIT hashing**, **smart lockfile hashing**, **worktree cache sharing**, **`docker prune`**.
- **A real MCP server** (`vis-mcp`) — Turbo ships Skill-only; parity with Nx.

## Recommended first build

**#1 (signed cache)** — cheapest high-value win, opt-in so zero blast radius, and a marketing-grade security differentiator (free + self-hostable + signed — exactly what Nx just deprecated four cache plugins over). It is also a hard prerequisite for **#8 (distributed execution)**, the headline differentiator.
