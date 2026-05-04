# vis — Priority Roadmap

Distilled from `competitive-analysis.md` (Sections 1–8). 10 items ordered by combined leverage × effort × demand-signal.

Demand signal is graded from issue mining: **★★★** = 3+ competitor repos ask for it; **★★** = 2 repos; **★** = 1 strong signal or novel.

---

## Top items — ranked

### 1. `vis cache why <task>` + `vis cache hash <task>` ✅ shipped
**Leverage:** Flagship UX. **Effort:** S (days). **Demand:** ★★★

Shipped as `vis cache why <task>` and `vis cache hash <task>` (the bare `why` and `task-why` names were already taken with different semantics). `cache why` reads `.task-runner/last-summary.json`, finds the task, and diffs `hashDetails` (`command`, `nodes`, `runtime`, `implicitDeps`) against the previous run in `.task-runner/runs/` to pinpoint what rotated the hash. `cache hash` prints the stored hash + per-bucket breakdown. Both support `--json` and `--run <id>`.

**Sources:** Theme K + M. nx#18754, turborepo#937, lage#82/#688/#695, moon#2174, wireit#1315.

**Why first:** Days of work, biggest "wow" moment in adoption, and the universal pain point users hit on every other tool. No competitor ships this cleanly.

---

### 2. REAPI gRPC backend + explicit `cacheMode: read | write | readwrite` ✅ shipped
**Leverage:** Strategic moat. **Effort:** L (weeks). **Demand:** ★★★

Shipped across `@visulima/task-runner` and `vis`:
- **Backend abstraction** (`task-runner/src/backends/{types,factory,http,reapi}.ts`): pluggable `RemoteCacheBackend` interface with `retrieveAction` / `storeAction` / `containsAction` / `fetchBlob` / `close`. Factory routes by `backend: "http" | "reapi"`.
- **HTTP backend**: existing Turborepo wire format preserved; `AbortSignal.timeout` for hung-request safety.
- **REAPI backend** over `@grpc/grpc-js`: `Capabilities` negotiation, `GetActionResult` / `BatchReadBlobs` / `Read` / `FindMissingBlobs` / `BatchUpdateBlobs` / `Write` / `UpdateActionResult`. In-flight blob upload dedup. `allowInsecureBearer` guard refuses to send a bearer token over `grpc://` cleartext.
- **v2 CAS layout** (`task-runner/src/cas/{paths,digest,store,action-cache}.ts`): content-addressed `<cacheDir>/v2/{ac,cas,task-hash-index}/<aa>/...`; reader honours both v2 and legacy. Writer dual-emits legacy for portability during the alpha rollout — `vis cache migrate` deferred since alpha caches are throwaway.
- **`cacheMode`**: `mode: "read" | "readwrite" | "write"` on `taskRunnerOptions.remoteCache` replaces the prior `read`/`write` boolean pair. `--cache-mode` / `--cache-backend` flags on `vis run`.
- **`vis cache doctor`**: probes URL reachability for HTTP, calls `Capabilities` for REAPI, reports digests + max batch size + latency. `--format=json` for CI gating.
- **Docs**: `task-runner/docs/concepts/remote-caching.mdx` covers both backends, `bazel-remote` Docker quickstart, action-digest derivation, capability matrix, env var compat (`TURBO_API` / `TURBO_TEAM` / `TURBO_TOKEN`), and the read/write lifecycle.

Per Decision 1, no server binary ships in this repo — `bazel-remote` (Docker, S3, NAS) is documented as the self-host path.

**Sources:** Section 7 Theme A + 8.3 #3. moon (REAPI shipped), Bazel/Buck2/Pants ecosystem, turborepo#683.

**Why critical:** Unlocks bazel-remote, BuildBuddy, BuildBarn, EngFlow as drop-in backends. Without it, vis is yet-another-HTTP-cache.

---

### 3. Watch UX bundle: Vitest keybinds + Windows-clean SIGINT + runtime-doctor ✅ shipped
**Leverage:** First-impression. **Effort:** M. **Demand:** ★★★

Shipped across five commits: Vitest-style `r/Enter/a/p/q/Ctrl+C/h/?` keybinds for `vis run --watch` (`watch-keybinds.ts`); SIGTERM→SIGKILL escalation watchdog with per-target `killGracePeriodMs` so the timeout becomes a hard upper bound (`signal-escalation.ts`); Windows graceful path via `CREATE_NEW_PROCESS_GROUP` + `GenerateConsoleCtrlEvent(CTRL_BREAK_EVENT)` in the task-runner native bindings, falling back to the JobObject-on-drop hard kill; runtime diagnostics in `vis doctor` covering inotify capacity (Linux), TTY availability, and orphaned `vis`/`task-runner` processes; auto-recover via `vis doctor --fix`, which reuses the same matcher as the diagnostic and SIGTERMs every flagged PID (escalates to SIGKILL on `force`, treats `ESRCH` as success).

The "daemon-doctor" framing in the original spec was an over-claim — task-runner has no long-running daemon today, so the closest analogue is the orphan-watcher leak, and the runtime checks plus `--fix` close that gap. A genuine cache/file-watcher daemon would be a separate Phase 3 item under #2 (REAPI server binary).

**Sources:** Section 7 Theme B + 8.2. turborepo#12651/#12652/#4608, nx#28513/#35036, wireit#788/#790.

---

### 4. Cache retention & GC (`vis cache prune`) ✅ shipped
**Leverage:** Production pain killer. **Effort:** S–M. **Demand:** ★★★

Shipped: `vis cache prune` already supported `--max-age-days` and `--max-size`; this round added `--keep-last <N>` (sort entries newest-first by mtime, drop everything past N before age/size eviction runs). Universal foot-gun across nx#35329, lage#921, lage#120, wireit#71 — no JS-land competitor ships clean retention. Direct production-pain win.

**Sources:** Section 8.1 Theme N.

---

### 5. MCP server + generator/template introspection ✅ shipped
**Leverage:** AI-tooling year. **Effort:** M. **Demand:** ★★★

Shipped as `@visulima/vis-mcp`, an MCP stdio server with eight read-only tools and a paired Claude Skill that documents optimal usage:
- **Workspace introspection**: `list_projects` (with vis-query filter), `describe_project`, `list_targets` (per-target rows with type, command, description).
- **Template introspection**: `list_templates`, `describe_template` (variable schema for `vis generate`) — closes the moon#2437 "agents fly blind" gap.
- **Run forensics**: `get_run_logs` (reads `.task-runner/last-summary.json` or a specific `runId`, optionally filters to one task), `cache_why` (hash-rotation diff), `cache_hash` (recorded hash + per-input details).
- **Resolution path**: `createRequire` from `VIS_MCP_WORKSPACE_ROOT` finds the workspace-local `@visulima/vis`; `VIS_MCP_VIS_BIN` overrides for linked checkouts.
- **Wire safety**: argv-form spawn (no shell), `isValidTaskId` / `isValidRunId` guards reject leading-`-` flag injection and path traversal, all logs go to stderr to keep the JSON-RPC stdout pristine.

**Design decision — read-only by intent.** The roadmap originally named `run_task`. We deliberately diverged to the Nx-style "agent prepares, human executes" model: the MCP surface stays read-only so an LLM client cannot mutate the workspace through the protocol. Mutating commands (`vis run`, `vis generate`) are something the agent recommends and the human invokes. README.md and `__tests__/server.test.ts` codify the eight-tool contract.

**Sources:** Section 7 Theme F + 8.1 Theme Z. Nx MCP, moon#2437.

---

### 5b. Worktree-aware shared cache ✅ shipped
**Leverage:** AI-tooling parity. **Effort:** S–M. **Demand:** ★★★

Shipped: default cache resolves to `<mainWorktreeRoot>/.task-runner-cache` whenever the workspace is a linked git worktree, so N parallel agents in N sibling checkouts share one store. Detection lives in the task-runner napi binding (`packages/tooling/task-runner/native/src/worktree.rs`): `.git` as a regular file (gitlink) → shell out to `git rev-parse --git-common-dir` and resolve to its parent. Memoized per canonicalized workspace root for the process lifetime; symlinked `.git` files agree with primary-checkout detection (both follow symlinks via `fs::metadata`). Single-checkout repos and primary worktrees behave unchanged.

The `vis cache list/prune/size` commands accept `--scope=shared|worktree|all`. `shared` is the default and reads `<mainWorktreeRoot>/.task-runner-cache`; `worktree` operates on the linked checkout's local cache; `all` runs against both with dedup when they resolve to the same path. `vis cache clean` deliberately omits `--scope` — the existing out-of-workspace prompt already requires `--force` from a linked checkout.

Hermetic-experiment users opt out via `sharedWorktreeCache: false` in `vis-config.ts`. Explicit overrides (`--cache-dir`, `taskRunnerOptions.cacheDirectory`, `VIS_CACHE_DIRECTORY` env — added for Nx parity) win over both worktree-share and the default. Tests cover the resolver matrix, cross-worktree read/write, 6-way concurrency stress, --scope CLI dispatch, and the symlinked-`.git` regression.

**Sources:** Nx 22.7 (PR #34942, `packages/nx/src/native/worktree.rs`, `packages/nx/src/utils/cache-directory.ts`).

---

### 6. `$AFFECTED_FILES` token + conditional tasks + finally tasks ✅ shipped
**Leverage:** Expressiveness. **Effort:** M. **Demand:** ★★

Shipped across three pieces:
- **Affected-files forwarding** via per-target `options.affectedFiles: "args" | "env" | "both"` (`src/task/types.ts:35`, `src/commands/run/handler.ts:53,93,372`). Sets `VIS_AFFECTED_FILES` env (newline-separated) and/or appends paths as args. Pragmatically chosen over the `${affected.files}` token-in-command form from the spec — same outcome, no string-interpolation surface.
- **Conditional tasks** via `WhenCondition` in `@visulima/task-runner` (`packages/tooling/task-runner/src/when-condition.ts:18`, `evaluateWhen`, `explainWhen`). Top-level `when:` on targets (`types.ts:90,231`) covers os/env/branch/ci.
- **Finally / always-run tasks** via top-level `always: true`. Pulled out of the main graph in `default-task-runner.ts:187` and run sequentially after the main task graph in `task-orchestrator.ts:24,231`.

**Sources:** Section 7 Theme C/D + 8.1 Theme Q. moon#1865/#1666/#1815/#2260, wireit#168/#325, nx#14010.

---

### 7. Output styles: quiet-on-success / verbose-on-failure ✅ shipped
**Leverage:** Universal QoL. **Effort:** S. **Demand:** ★★★

Shipped: `vis run --output-style=quiet` swallows stdout/stderr from successful and cached tasks while keeping failures fully visible (skipped tasks still print their reason). Per-target override via `options.outputStyle: 'normal' | 'quiet'` in `vis-task.ts`/`vis-config.ts` — a single noisy linter can opt into quiet mode without changing the global flag, and a critical task can stay verbose under a global `quiet` setting. Unknown `--output-style` values fall back to `normal` so a typo never silently mutes output.

**Sources:** Section 8.1 Theme T. moon#2475/#2451/#1930/#2424/#2146, lage#634, wireit#1303/#56.

---

### 8. Self-healing CI on top of `vis ai` ✅ shipped
**Leverage:** Strategic differentiator. **Effort:** M–L. **Demand:** ★ (novel)

Shipped as `vis ai heal` (proposal loop) + `vis ai heal accept` (auto-commit). The v1 loop reads the latest failed task, asks the configured AI provider for a structured patch, applies it, validates it by re-running the task on the CI runner, and posts a markdown summary to the PR (GitHub Actions) or MR (GitLab CI). When a maintainer comments `/vis heal accept`, a follow-up workflow re-derives the proposal, validates it, and commits via the platform's REST API. Implementation:
- **CI provider detection** (`src/ai/ci-context.ts`): dispatches on `GITHUB_ACTIONS=true` and `GITLAB_CI=true`; falls back to `GITHUB_EVENT_PATH` JSON for the PR head SHA when `GITHUB_REF` isn't a `refs/pull/<n>/...` ref. GitLab side reads `CI_MERGE_REQUEST_IID`, `CI_API_V4_URL`, and `GITLAB_TOKEN` (auto-injected `CI_JOB_TOKEN` is intentionally rejected — it cannot post MR notes).
- **Comment posting** (`src/ai/pr-comment.ts`): GitHub side prefers bundled `gh pr comment` and falls back to the REST `/issues/{n}/comments` endpoint when gh is missing or fails; GitLab side goes straight to REST `/projects/{enc}/merge_requests/{iid}/notes` with the `PRIVATE-TOKEN` header. Argv-form spawn — no shell metachars in the path. Comment body capped at 60 KB so a multi-file patch can't trip GitHub's 65 KB ceiling; markdown fence auto-escalates so patches containing triple backticks render correctly.
- **Heal orchestrator** (`src/commands/ai/heal.ts`): split into reusable phases (`findHealCandidate` → `proposeAndApply` → `validateAppliedFix` → `postHealComment`) so `accept` can replay the propose path deterministically. Public flags unchanged: `--dry-run`, `--validation-timeout`, `--no-cache`.
- **Auto-commit** (`src/commands/ai/heal-accept.ts` + `src/ai/git-commit.ts`): triggered by `/vis heal accept` in a PR/MR comment. Validates the actor against `ai.heal.allowedActors` (vis-config), refuses fork PRs (token has no write access), resolves the head ref, replays the propose flow, then commits via Octokit's Git Trees API (GitHub) or Gitbeaker's `Commits.create` (GitLab). GitHub commits are auto-signed as `github-actions[bot]` because they're created with `GITHUB_TOKEN`; GitLab v1 ships unsigned. Both SDKs are **optional peer-deps** — the lazy loader (`src/ai/sdk-loader.ts`) prompts the user to install on first run in an interactive shell, or fails loud with the install command in CI. After a successful commit, a confirmation comment with the new SHA is posted to the PR/MR.
- **Tests**: `ai-ci-context.test.ts`, `ai-pr-comment.test.ts`, `ai-heal.test.ts` cover env detection, comment dispatch, and the rendering layer; `ai-sdk-loader.test.ts` covers prompt/install/decline/import-error paths; `ai-git-commit.test.ts` covers the GitHub Git Trees ordering, GitLab `Commits.create`, and missing-token / missing-API-base errors; `ai-heal-accept.test.ts` covers trigger parsing (GitHub event payload + GitLab env-var bridge), actor allow-list, fork rejection, and missing-trigger-phrase no-op.

**Sources:** Section 4 Tier-1 #4. Nx is the only competitor with this; massive moat in JS-land.

---

### 9. Package-level + extends config layering ✅ shipped
**Leverage:** Architecture-shaping. **Effort:** M. **Demand:** ★★

Shipped: root `vis-config.ts` + per-package `vis.task.ts` overlay with explicit merge semantics, plus an `extends` chain on the root config.
- **Extends resolver** (`src/config/config.ts:205-252,343,373,391`): relative paths resolved against the parent file; bare specifiers (`@acme/preset`, `vis-preset-foo`) resolved via npm from the parent file; absolute paths rejected. Recursive load with cycle protection, post-order fold; `extends` is consumed during resolution and never propagated downstream.
- **Per-package overlay** (`src/config/config.ts:22,105,494-542`): `vis.task.ts` discovered per project, compiled via jiti, cached by content hash so editing one project's overlay doesn't invalidate others. `defineVisTaskConfig` helper provides type safety.
- **Merge semantics** (`src/config/workspace.ts:434-514`): per-project targets from `project.json` merge with the overlay via `mergeProjectTargets`; overlay wins per-target. `loadVisTaskConfigs` (`workspace.ts:609-649`) pre-loads overlays in parallel; legacy callers keep the no-overlay path.

**Sources:** Section 8.1 Theme S.

---

### 10. Shared services / sidecar registry across invocations
**Leverage:** Cross-invocation devloop. **Effort:** M. **Demand:** ★★★

Long-lived DB/mock/devserver lifecycle that survives across multiple `vis run` calls within a shell session. Today, vis (like Turbo's `with:` and Nx continuous tasks) scopes service lifetime to a single run — every `vis run :test` cold-starts Postgres. Concrete shape: a `services` registry — `vis service start db; vis run :test` and the test task auto-attaches via the existing `server`/`utility` task types; `vis service stop db` (or shell exit) tears it down. Pairs with Theme B watch UX, since long-running services are the user-facing pain there too.

**Sources:** Section 8.1 Theme R. wireit#580 (8 thumbs), moon#1365, moon#2003, rushstack#1151.

**Why critical:** No JS-land competitor ships shared services cleanly. Direct fix for the "I keep restarting Postgres between every test run" papercut, and a flank Turbo/Nx can't easily close without rearchitecting their daemons.

---

### 11. Cache restoration fidelity (timestamps, perms, ordering) ✅ shipped
**Leverage:** Correctness foundation. **Effort:** S–M. **Demand:** ★★

Shipped across `@visulima/task-runner` and `vis`:
- **Archive round-trip preserves mtime + mode bits** (`task-runner/src/archive.ts`): tar streams capture and restore file timestamps and permission bits, so cache hits no longer reset mtime to "now" or drop the executable bit.
- **Deterministic readdir ordering** (`task-runner/src/cache.ts`): directory entries are sorted with a locale-aware comparator before hashing and archive emission, so two runs that produce the same files always produce the same digest regardless of FS order.
- **Per-target `cacheRestore` config** (`task-runner/src/types.ts`): `cacheRestore: { preserveMtime, preservePerms }` defaults on; opt-out per target for hermetic-experiment cases.
- **`vis cache verify <task>`** (`vis/src/commands/cache/handler.ts`, `index.ts`): diffs the cached archive against the live workspace, surfacing content/mtime/perm drift. `--scope=all` searches across worktree + shared caches; per-file diff runs in parallel with bounded concurrency. Missing entries exit 1 (documented).

**Sources:** Section 8.1 Theme O. wireit#1316, lage#766, lage#839, lage#690.

---

## Tier B — file but defer

These have real demand but lower leverage given current vis scope:

| # | Item | Source | Why defer |
|---|---|---|---|
| 11 | Inferred tasks / Project Crystal ✅ | Theme 4 Tier-1 #5 | v1 ships vite/packem/vitest detectors behind `inferTargets: true`; explicit scripts/project.json/vis.task.ts win per-key. More detectors land opportunistically. |
| 12 | Test atomization | Theme 4 Tier-1 #6 | Pairs with distributed agents — pointless without #14 |
| 13 | Public plugin API | todo.md, Theme E | Required for community ecosystem; ship after surface stabilizes |
| 14 | Distributed agents (Cobuilds-style) | Theme 4 Tier-1 #2 | Lighter pattern via shared cache + Redis lock |
| 15 | Webhooks / pipeline events | todo.md, Theme H | ~100 LOC over `LifeCycleInterface`; cheap when needed |
| 16 | Strict env mode | Section 7.3 #14 | One config flag; opportunistic |
| 17 | Jujutsu (jj) VCS support | Section 7.3 #1 | Abstract VCS layer first; trivial backend afterward |
| 18 | Boundaries as `eslint-plugin-vis` | Section 4 Tier-2 | Surface existing layer constraints to ESLint |
| 19 | GitLab CI / Buildkite presets | Section 7.2 G | Easy parity once the GH Actions story is solid |
| 20 | Run replay / time-travel (`vis replay`) | Section 4 Tier-2 | Build on existing `run-summary.ts` |
| 21 | Lockfile / install-awareness preflight ✅ | Theme W, moon#2055, rushstack#5624 | Lives at `src/preflight/lockfile.ts`. Compares lockfile mtime to PM-specific install marker (`node_modules/.modules.yaml` etc.); warns in TTY, hard-fails in CI. Default-on, opt-out via `--no-preflight` or `preflight.lockfile: false`. |
| 22 | Skip-on-warning incrementality ✅ | Theme P, rushstack#1402 | Per-target `warningPattern` + `cacheOnWarning`; result carries `hadWarnings` |
| 23 | Task descriptions in `--help` / TUI ✅ | Theme Y, wireit#1015, moon#1914 | Surfaced via `vis list --targets` (existing per-target `description` field) |

## Tier C — explicitly out of scope

Not on the roadmap; either too costly or wrong product surface:

- Real-time distributed agents (Nx Agents) — Cobuilds-style is enough
- Polyglot first-class (Gradle/.NET/Python) — defer until clear demand
- Hermetic sandbox / network isolation — multi-quarter, narrow audience
- VS Code / JetBrains extensions — MCP server (item 5) covers this surface
- Web UI / cloud dashboard — out of scope without hosting commitment
- Persistent workers (Bazel) — narrow audience, no JS-land demand signal
- Component-level versioning (Bit) — different product
- Microfrontend dev proxy — niche unless target audience is there
- Versioning/changesets engine — `multi-semantic-release` covers it
- Knip-class unused-code detection — separate product surface
- Persistent-toolchain process (rushstack#1151) — meaningful only with persistent workers

---

## Suggested execution order

Quarters are illustrative; adjust to actual capacity.

**Q1: Foundation + first-impression (items 1, 3, 4, 7)**
Diagnostics + watch UX + cache retention + output styles. All small-to-medium, all directly competitive on a feature axis vs Turbo/Nx/moon. Ship together as "vis 1.0 polish."

**Q2: Strategic moats (items 2 ✅, 5 ✅, 5b ✅)**
REAPI gRPC ✅ + MCP with introspection ✅ + worktree-aware shared cache ✅. All three landed: REAPI unlocks bazel-remote/BuildBuddy as drop-in backends, MCP ships as a read-only agent surface (mutating commands stay human-invoked), and worktree-share unlocks parallel-agent UX. Standalone cache binary explicitly dropped — `bazel-remote` is the documented self-host.

**Q3: Devloop + correctness (items 6 ✅, 9 ✅, 10, 11 ✅)**
Conditional/affected/finally tasks ✅ + config layering ✅ + cache restoration fidelity ✅ + shared services registry (cross-invocation lifecycle). Cache correctness locked down before `docker scaffold` scales; the "I keep restarting Postgres" papercut is the open item.

**Q4: AI moat (item 8 ✅)**
`vis ai heal` shipped end-to-end: read failure → propose → apply → validate by re-running → comment to PR/MR (GitHub Actions + GitLab CI), and `vis ai heal accept` lands the patch as a signed commit when an allow-listed maintainer comments `/vis heal accept`.

After the ranked items: pull from Tier B opportunistically, in order of community demand.

---

## Effort legend

- **S** — days, single contributor
- **M** — 1–4 weeks, single contributor
- **L** — 1–2 months, may need 2 contributors

## Assumptions worth challenging

- Items 1, 4, 7 assume the existing `run-summary.ts` and `task-runner` cache APIs can be extended cleanly. Verify before scoping.
- Item 2 assumes `@grpc/grpc-js` is acceptable as a runtime dep (~3 MB).
- ~~Item 5 assumes MCP SDK stability through 2026~~ — resolved: shipped against `@modelcontextprotocol/sdk` with a stable eight-tool contract; future tools are additive.
- ~~Item 8 assumes `vis ai` already has the primitives needed for CI invocation~~ — resolved: shipped on top of `aggregateFailureContext` / `runFixAnalysis` / `applyFixProposal` with no new primitives. Auto-commit-on-accept landed via `vis ai heal accept` with optional `@octokit/rest` + `@gitbeaker/rest` peer deps (lazy-loaded; the loader prompts to install on first need or fails loud in CI).
- Item 10 assumes the existing `server`/`utility` task types can attach to a registry without re-modeling task lifetimes.
- ~~Item 11 assumes the cache backend stores enough metadata to reproduce mtime/perms~~ — resolved: archive layer carries mtime + mode bits, no cache-format bump needed.
- Tier C "explicitly out of scope" should be revisited once the top items land — community feedback may move things up.
