# task-runner RFCs

Design docs for **engine** features. Each is a spec to review before implementation, unless marked shipped.

`task-runner` is the engine; `vis` is the tool that calls it. Features that live in the CLI/tool layer have their RFCs under [`packages/tooling/vis/rfc/`](../../vis/rfc/), not here.

## Shipped designs (already implemented)

- [`design-fspy-seccomp-unotify.md`](./design-fspy-seccomp-unotify.md) — Linux syscall-trace fingerprinting via `seccomp_unotify`.
- [`design-fspy-windows-detours.md`](./design-fspy-windows-detours.md) — Windows file-access tracing via Detours/IAT.
- [`design-task-runner-client-ipc.md`](./design-task-runner-client-ipc.md) — cooperative cache hints (`@visulima/task-runner-client`).
- [`design-import-boundaries.md`](./design-import-boundaries.md) — import-level boundary checking (`checkImportBoundaries`). **Shipped** (v1, TS-based scan; native `extract_imports` is a future optimization).

## Proposed (engine)

What's left of the competitive gap analysis vs Turborepo / Nx / vite-task **after** filtering out everything `task-runner`/`vis` already ship.

| RFC                                                                          | Closes gap vs                        | Effort       | Risk                           |
| ---------------------------------------------------------------------------- | ------------------------------------ | ------------ | ------------------------------ |
| [`design-continuous-sidecar-tasks.md`](./design-continuous-sidecar-tasks.md) | Turbo `with` · Nx `continuous: true` | Med–high     | **High (scheduler core)**      |
| [`design-batch-executor.md`](./design-batch-executor.md)                     | Nx `--batch` (tsc)                   | Med–high     | High (scheduler + cache demux) |
| [`design-distributed-execution.md`](./design-distributed-execution.md)       | **Nx Agents/DTE (paid)**             | High (weeks) | High (distributed system)      |

Distributed execution's integrity prerequisite is **already met** — see below — so the remaining work is the coordinator/agent protocol, not the cache trust layer.

## Moved to `vis` (tool layer)

Their RFCs live under [`vis/rfc/`](../../vis/rfc/):

- `design-interruptible-watch-restart.md` — restart a persistent task on input change; `vis` owns `watch`.
- `design-atomizer.md` — split test/e2e suites into per-file tasks; `vis` owns target synthesis.

## Dropped — already shipped (not gaps)

Re-validation against the codebase found these already exist:

- **Signed cache + provenance** (`turbo` signatures / Nx CVE-2025-36852) — `backends/types.ts` already ships **`RemoteCacheSigning`** (HMAC-SHA256, `X-Artifact-Signature`, fail-closed `verifyOnDownload`) **and `RemoteCacheAttestation`** (keyless Sigstore provenance via `X-Artifact-Attestation` with an `expectedIdentity` GitHub-Actions preset). REAPI rides on CAS content-addressing; `vis` adds branch-scoped cache. The original gap analysis was wrong here.
- **Programmatic graph query** (`turbo query`) — `vis action-graph --json --query`, `vis task-why`/`why`, `vis affected`.
- **Sync generators** (`nx sync`) — `vis sync` already reconciles codeowners, `package.json` fields, and tsconfig references (with `--check`).

## Where we already lead (no RFC needed)

- **Trace/auto-fingerprint** with missing-file probes + directory listings — parity with vite-task (its only real differentiator), ahead of Turbo/Nx (they need hand-declared inputs).
- **Cache integrity + authenticity** — HMAC signing **and** keyless Sigstore attestation, ahead of Turbo (signature only) and the deprecated Nx bucket plugins (CVE-2025-36852).
- **Two remote backends** — Turbo-compatible HTTP **and** Bazel REAPI gRPC. Nobody else has REAPI.
- **Cooperative in-process cache hints**, **self-modified-input detection**, **`when:`/`always:` tasks**, **branch-scoped local cache**, **JIT hashing**, **smart lockfile hashing**, **worktree cache sharing**, and `vis`-layer **`docker prune`**, **services**, **project + import constraints**.
- **A real MCP server** (`vis-mcp`) — Turbo ships Skill-only; parity with Nx.

## Recommended next build

**Continuous/sidecar tasks** — highest daily-DX value of the three remaining, and we're already ~70% there via `vis services`. Distributed execution is the headline differentiator (free, self-hostable, attacking Nx's paid DTE), and its cache-trust prerequisite already ships — but it's a multi-week distributed system that warrants its own design review first.
