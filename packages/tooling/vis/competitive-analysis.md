# vis — Competitive Feature Gap Analysis

Analysis date: 2026-04-28 (Vite+ §1.4 refreshed 2026-05-10)
Subject: `@visulima/vis` v1.0.0-alpha.17
Compared against: Nx 21, Turborepo 2.6, moon 2.0 "Phobos", Vite+ alpha + Vite Task (VoidZero, Mar 13 2026), Lage, Rush, Lerna 9, Bazel/Buck2/Pants/Please/Please, Bit, plus point-tools (Knip, syncpack, sherif, manypkg, Wireit, Preconstruct).

---

## Section 1 — Competitor feature inventory

### 1.1 Nx (nx.dev) — 21.x with Nx Cloud / Polygraph

- **Nx Agents** — real-time, resource-aware distributed task execution. Continuously feeds tasks to agents based on live CPU/RAM telemetry instead of pre-batching. Auto-scales agent count to PR size. Auto-derives env from CI context.
- **Nx Replay** — free self-hosted remote-cache plugins reintroduced in v20.8 (April 2025); also acts as the artifact transport between agents.
- **Self-Healing CI** — AI agent reads task logs + project graph, proposes a fix, validates by re-running the failed targets, comments on the PR via GitHub integration or Nx Console, auto-commits when accepted (~60% acceptance at scale).
- **Project Crystal / Inferred Tasks** — plugins infer targets from existing tool config (vite.config, playwright.config, eslint.config) instead of generating boilerplate JSON.
- **Atomizer** — splits each e2e spec into its own runnable target so they can be sharded across agents (Playwright, Cypress, Jest, Gradle test).
- **Continuous tasks** (Nx 21) — pipeline tasks no longer block on long-running processes (devservers).
- **Terminal UI** (Nx 21) — multi-task TUI with collapsible groups.
- **Conformance & Polygraph** (Enterprise) — TS-based custom rules published to Nx Cloud, applied across multiple repos. Polygraph adds a cross-repo Workspace Graph plus Custom Workflows for org-wide audits.
- **Synthetic monorepos** — Polygraph treats N repos as one logical workspace for AI agents.
- **Polyglot** — first-party Gradle, Maven, .NET; Python in 2026 roadmap. Nx core is being ported to Rust.
- **Mise integration** + incremental graph hydration on the 2026 roadmap.
- **Nx MCP server** — exposes project graph, generators, docs, and live CI/terminal output to Copilot, Cursor, Claude, JetBrains AI.
- **Migrate UI** in Nx Console — visual upgrade flow that runs migration generators with diff preview.
- **Task Sandboxing** (roadmap) — traces file ops to detect missing `inputs` declarations.
- Task / flaky / agent-resource analytics dashboards in Nx Cloud.

Sources: nx.dev/blog/wrapping-up-2025, nx.dev/blog/nx-2026-roadmap, nx.dev/docs/features/ci-features/self-healing-ci, nx.dev/blog/nx-cloud-introducing-polygraph, nx.dev/docs/concepts/inferred-tasks, nx.dev/ci/features/split-e2e-tasks, nx.dev/blog/nx-mcp-vscode-copilot.

### 1.2 Turborepo (turborepo.dev) — 2.5 / 2.6

- **Microfrontend proxy** (2.6, stable) — one local port routes to N apps via `microfrontends.json`; deep Vercel microfrontend tie-in.
- **Sidecar tasks** (2.5) — `with` key forces a persistent task to run alongside its long-running dependents (e.g. mock server with dev).
- **`--continue=dependencies-successful`** (2.5) — partial-failure semantics that don't cascade.
- **`turbo.jsonc`** with comments; **`$TURBO_ROOT$`** microsyntax for input/output globs that escape package boundaries.
- **`turbo prune`** for Bun (2.5), now stable for all major package managers; produces a containerizable subset.
- **Boundaries** (experimental, eslint-config-turbo) — catches caching-unsafe patterns and cross-package import violations.
- **Watch mode** with experimental cache writes (`--experimental-write-cache`).
- **Affected detection** — `--affected`, `TURBO_SCM_BASE/HEAD`, `affectedUsingTaskInputs` future flag for task-level (not just package-level) affected.
- **Strict env mode** (`TURBO_ENV_MODE=strict`) — tasks only see explicitly listed env vars.
- **Signed remote cache artifacts** via `TURBO_REMOTE_CACHE_SIGNATURE_KEY` (HMAC-SHA256, integrity not security).
- **Fingerprint plugins** (TS extensions to inject custom hash inputs, transform env, etc.).
- **TUI task search** (2.6) — press `/` to filter.
- **OpenAPI viewer** for the remote-cache HTTP protocol (2.5).
- **Run summaries** (`--summarize` → `.turbo/runs/*.json`); UI is community-built only.

Sources: turborepo.dev/blog/turbo-2-5, turborepo.dev/blog/turbo-2-6, turborepo.dev/docs/reference/configuration, turborepo.dev/docs/guides/microfrontends.

### 1.3 moon / moonrepo — 2.0 "Phobos" (late 2025)

- **WASM toolchain plugins** — every language toolchain (Node, Bun, Deno, Rust, Python) is a WASM plugin; community can ship new ones without core changes.
- **Action graph + task graph** (separated in v1.30) — `moon task-graph`, `moon query tasks`, `moon query affected` for scriptable inspection.
- **Smart hashing** — content-based, with auto-discovered inputs (lockfiles, requirements.txt, etc.) and customizable globs.
- **MQL query language** — SQL-ish project filtering by tag, type, language, owner, task name.
- **Codeowners auto-sync** — per-project `owners` aggregated into a generated `CODEOWNERS` file (GitHub/GitLab/Bitbucket flavours).
- **Toolchain hermeticity via `proto`** — pin Node/Bun/Deno/Rust/Python/Go versions in `.prototools`; moon uses proto under the hood.
- **Self-hosted remote cache via Bazel REAPI** (`unstable_remote`) — works with bazel-remote, BuildBuddy, BuildBarn, EngFlow. Moonbase (proprietary) was sunset in 2024.
- **Generators** — Tera templating, frontmatter, `extends` composition.
- **Docker integration** — `moon docker scaffold`, `moon docker prune`, `moon docker file`.
- **Webhooks** — POST on every pipeline event for OTel/metrics ingestion.
- **`...` glob targets** (Bazel-style: `app/...`).
- **Async affected tracker** (1.5–2× faster), Git submodule/worktree support.
- **`.config/moon` layout**, multi-format config (JSON, JSONC, YAML, TOML, HCL, Pkl).
- **VCS hook management** (auto-installs git hooks).
- **Flakiness detection** + retries; CI-by-default `moon ci`.

Sources: moonrepo.dev/blog/moon-v2.0, moonrepo.dev/blog/moon-v1.30, moonrepo.dev/blog/moonbase-sunset, moonrepo.dev/docs/guides/remote-cache, moonrepo.dev/docs/concepts/query-lang, moonrepo.dev/docs/guides/codeowners.

### 1.4 Vite+ alpha + Vite Task (VoidZero, shipped Mar 13 2026)

The Oct 2025 ViteConf announcement landed as a public alpha on Mar 13 2026. The task runner was extracted as `voidzero-dev/vite-task` (separate MIT Rust repo, ~415 stars at refresh time, 17 open issues). Pricing changed from "commercial bundle" to **fully MIT** — the company monetises through the companion `Void` deployment platform, not the CLI. The Vite+ binary is `vp` (alias `vpr` for `vp run`).

**Single `vite.config.ts` covers everything** — Vite + Vitest + Oxlint + Oxfmt + Rolldown + tsdown + Vite Task + `vp staged` (lint-staged-equivalent) all configure under one file. `vp migrate` collapses `.oxlintrc*`, `.oxfmtrc*`, lint-staged config into it.

**Subcommand surface (alpha, May 2026):**

- **Lifecycle:** `vp create`, `vp migrate`, `vp config`, `vp upgrade`, `vp implode`
- **Toolchain:** `vp env` (Node version mgr), `vp install`/`add`/`remove`/`update`/`dedupe`/`outdated`/`list`/`why`/`info`/`link`/`pm` (wraps detected pnpm/npm/yarn)
- **Develop:** `vp dev`, `vp check`, `vp lint`, `vp fmt`, `vp test`, `vp staged`
- **Execute:** `vp run`, `vp exec`, `vp dlx`, `vp cache`
- **Build:** `vp build`, `vp pack` (libraries + standalone app binaries), `vp preview`

**`vp run` (Vite Task) — what actually shipped:**

- Tasks defined under `run.tasks` in `vite.config.ts`: `command`, `dependsOn`, `cache`, `envs`. `dependsOn` supports `taskName` and `package#taskName`.
- pnpm-style `--filter` (name/glob/dir, `...` for deps/dependents, `!` exclusions). `-r` recursive, `-t` transitive, `-w` workspace root, `--parallel`, `--concurrency-limit` (default 4).
- **Auto-input tracking via syscall tracing (fspy).** Records reads, _missing-file probes_, and _directory listings_ — caching needs zero declared `inputs`. Adding a file to a probed directory or creating a previously-missing file invalidates the cache. (Open issues #353/#354 expose a SIGBUS edge on `/dev/shm`-constrained hosts — implementation is real, still rough.)
- **Compound-command sub-task splitting.** `a && b` and nested `vp run` calls are split into independent cached tasks. Granular cache hits, but the model has ordering bugs in flight (issue #364).
- `-v` summary, `--last-details` to replay prior run summary, cache stored at `node_modules/.vite/task-cache`.
- Args after the task name pass through to the underlying command (`vp run test --reporter verbose`).

**Notable open-issue gaps (May 2026):**

| Gap                                     | Issue            | Status in vis                                              |
| --------------------------------------- | ---------------- | ---------------------------------------------------------- |
| Remote cache                            | not on roadmap   | ✅ HTTP + REAPI gRPC, `vis cache doctor`                   |
| Affected detection                      | not on roadmap   | ✅ `vis affected`, `${affected.files}` token               |
| Watch mode                              | #276             | ✅ Vitest-style keybinds                                   |
| Cache eviction                          | #251, #315       | ✅ `vis cache prune --keep-last/--max-age-days/--max-size` |
| Output preserves colors / globs / mtime | #358, #321, #375 | ✅ archive preserves mtime+mode; `vis cache verify`        |
| Cache why / hash debugging              | hinted #311      | ✅ `vis cache why`, `vis cache hash`                       |
| Task aliases / groups / discoverability | #277             | ✅ `vis list --targets` + tag selectors                    |
| First-class task arg schema             | #274             | ✅ via `vis.task.ts`                                       |
| Per-task shell selection                | #275             | partial                                                    |
| Dependency on a group of tasks          | #272             | ✅ tag overlay                                             |
| RFC for richer `dependsOn` syntax       | #322             | ✅ `WhenCondition`                                         |
| Self-hosting Vite Task in own repo      | #256             | n/a (vis already self-hosts)                               |

**Underlying toolchain advantage** (still strong): Vite 8, Vitest 4.1, Oxlint 1.52 (~50–100× ESLint), Oxfmt beta (~30× Prettier), Rolldown (1.6–7.7× Vite 7), tsgo, tsdown. Shared Rust core across subcommands.

**`setup-vp` GitHub Action** (`voidzero-dev/setup-vp@v1`) is the official CI on-ramp; `namespace.so` provides CI infra for the vite-task repo itself.

**Differentiation read:** Vite+ is the "Vite ecosystem grew a task runner"; vis is the "task runner that grew adjacent tooling." Vite-task's syscall-traced inputs and compound-splitting are qualitatively different from declared-inputs hashing and worth borrowing as opt-in hash modes (see priority-roadmap items 32 + 33). vis's REAPI / MCP / self-heal / sidecar / signed-cache stack is well outside Vite-Task's near roadmap based on open issues — that's the moat to lead with.

Sources: [voidzero.dev/posts/announcing-vite-plus-alpha](https://voidzero.dev/posts/announcing-vite-plus-alpha), [voidzero.dev/posts/whats-new-march-launch-week-2026](https://voidzero.dev/posts/whats-new-march-launch-week-2026), [github.com/voidzero-dev/vite-plus](https://github.com/voidzero-dev/vite-plus), [github.com/voidzero-dev/vite-task](https://github.com/voidzero-dev/vite-task) (issues #251, #256, #272, #274–#277, #311, #315, #321, #322, #353/#354, #358, #364, #375), [viteplus.dev/guide/run](https://viteplus.dev/guide/run), [viteplus.dev/guide/cache](https://viteplus.dev/guide/cache).

### 1.5 Lage (Microsoft)

- Topological scheduling with worker pool + per-task profiler (`--profile` → Chrome trace).
- **Backfill** cache layer with pluggable providers — local FS, Azure Blob, S3, custom; `BACKFILL_CACHE_PROVIDER` env-driven.
- `LAGE_WRITE_REMOTE_CACHE` to gate uploads (read-only consumer pattern).
- **Cobuilds** — cooperative distributed builds via shared remote cache (no central scheduler).
- `lage info` to inspect pipeline.
- TS-typed pipeline definition in `lage.config.js`.
- Designed to be lighter than Nx for teams that just want caching + parallelism.

Sources: microsoft.github.io/lage, github.com/microsoft/lage.

### 1.6 Rush (rushstack, @microsoft/rush 5.175+)

- **Phased commands / operations** with `rush-project.json` `operationSettings`.
- **Build cache** with cloud providers (Azure, AWS, GCS) via plugin; `--set-cache-only` flag (rush-bridge-cache-plugin) seeds caches without executing.
- **Cobuilds** — cheap distributed builds via Redis lock + shared cache.
- **Change management** — `rush change` files → version policies (lockstep or independent), changelog generation.
- **Strict install** — `rush install --strict-peer-dependencies`, autoinstallers for tooling, repo-wide approved-package allowlist.
- **Watch mode** with abort-via-key (a/q).
- Plugin API (custom commands, custom installers, custom cache providers).
- Repo-policy rules (preferred versions, ensureConsistentVersions, allowedAlternativeVersions).

Sources: rushjs.io, rushjs.io/pages/maintainer/phased_builds.

### 1.7 Lerna (Nx-owned, v9 — Sept 2025)

- **OIDC trusted publishing to npm** (no static tokens in CI).
- Removed legacy `lerna add`/`lerna bootstrap`; defers to native pnpm/yarn/npm/Bun workspaces.
- Defers task running to Nx (parallel + cache).
- Still uniquely useful: `lerna version` + `lerna publish` semantics across heterogeneous packages, conventional-commit-driven version bumps, fixed/independent modes.

### 1.8 Bazel / Buck2 / Pants — features that have crossed into JS-land

- **REAPI v2** — the de-facto remote-cache + remote-execution wire protocol. Adopted by moon, Pants, Buck2, EngFlow, BuildBuddy, BuildBarn. **Now the realistic plug-in standard for JS task runners.**
- **Persistent workers** — long-lived JVM/tsc/etc processes for sub-second incremental tasks.
- **Hermeticity via sandboxing** — Linux user-namespace sandbox, network isolation. Buck2 enforces hermeticity by _requiring_ declared inputs.
- **Action graph + Starlark/BXL** — queryable graph the user can script over.
- **Dynamic execution** — race local + remote, take whichever finishes first.
- **rules_js / rules_ts** (aspect-build) — Bazel-native pnpm symlink layout, isolated DTS, ts_project.

Sources: bazel.build/remote/persistent, bazel.build/remote/rbe, buck2.build, pantsbuild.org, github.com/aspect-build/rules_js.

### 1.8.1 Please (thought-machine/please) — v17.30.0 (Apr 2026)

Go-built, monorepo build system in the Bazel/Buck/Pants family. ~2.6k stars; created and maintained by Thought Machine. Smaller surface area than Bazel, sharper opinions, REAPI v2 wire-compatible.

- **REAPI gRPC v2 remote execution + cache** — `[Remote]` section in `.plzconfig` (URL, NumExecutors, Secure TLS, Platform key/value). Drop-in compatible with bazel-remote, BuildBuddy, BuildBarn, EngFlow.
- **HTTP cache backend** — `[Cache] HttpUrl` with `HttpWriteable` (read-only/writeable mode), `HttpTimeout`, `HttpRetry`, `HttpConcurrentRequestLimit` (default 20). Cleaner read/write split than Nx's `ciMode`/`localMode`.
- **Built-in cache retention** — local DirCache with `HighWaterMark`/`LowWaterMark` (default 10GB/8GB) → automatic LRU eviction. Theme-N gap that no JS-land runner ships natively.
- **Hermetic Linux sandbox** — `[Sandbox]` user namespaces, configurable Build/Test toggles, `Namespace = always|sandbox|never`, dir masking. `plz exec --share_network --share_mount` for opt-out.
- **BUILD-file language** — Python-like (subset, statically parseable, similar to Starlark). Parsed in parallel (`NumThreads = CPU+2`). `plz fmt` uses buildifier.
- **Language Server Protocol** — `plz tool lps` ships a real LSP for BUILD files: completion (build labels), hover, goto-def, diagnostics, signature help, format, references. Beats most JS-land runners' editor story.
- **Plugin system** — `plugin_repo()` rule + `[Plugin "name"]` config. First-class plugins: C/C++, Go, Java, Python, Proto, Shell. **No first-class JS/TS/Node plugin** (pleasings/community only) — door is open for vis-style migrators.
- **Query introspection** — `plz query` with `alltargets`, `deps`, `reverseDeps`, `changes` (affected), `graph` (JSON), `rules`, `whatinputs`/`whatoutputs`. Scriptable equivalent of moon's MQL.
- **Watch mode** — `plz watch` rebuilds/retests on file change; `--run` to execute instead.
- **`plz hash`** — content-hash CLI, with `--update` writing hashes back into BUILD files. Theme-M (surface content hashes) shipped natively.
- **`plz gc`** — identifies unused targets (experimental, `--conservative`, `--targets_only`). Equivalent to a Knip-like dead-code pass for the build graph.
- **`plz export`** — exports a workspace subset (with optional target trimming) — Bazel-style standalone-able subgraph; analogue of `turbo prune`.
- **`plz init --bazel_compat`** — Bazel-compatibility init mode → seeded Bazel-migration story.
- **`plz op`** — reruns previous command (small, but a UX win).
- **Aliases for custom commands** — like Cargo's `[alias]` table; users build per-project verbs without plugin code.
- Polyglot first-class (C/C++, Go, Java, Python, Proto, Shell). Multi-language co-located builds.

Notable gaps vs vis target audience: no first-class JS/TS rules, no MCP/AI integration, no editor extension beyond LSP, no Docker scaffolder, no CODEOWNERS sync, no inferred tasks (BUILD files are explicit), no S3/GCS/Azure cache backends without REAPI proxy, no flake detection / retry, no test atomization beyond what users wire up, no migration tooling out (only in via `--bazel_compat`).

What vis can crib from Please:

- **DirCache `HighWaterMark`/`LowWaterMark`** — already in Section 8.4 #7 (cache retention) — Please is the proof of concept that this is days, not weeks.
- **`plz hash --update`** — write authoritative hashes back into config so reviewers can diff them.
- **REAPI `[Remote]` config shape** — clean separation from `[Cache]` HTTP. Worth mirroring when vis ships REAPI.
- **`plz query whatinputs <file>`** — answers "which target(s) consume this file?" — pairs with `vis why <task>` (Section 8.4 #6) from the _file_ side.
- **`plz tool lps`** — bundling an LSP for `vis-config.ts` / `project.json` is cheaper than VS Code/JetBrains extensions.

Sources: github.com/thought-machine/please (v17.30.0, 2026-04-21), please.build, please.build/quickstart.html, please.build/config.html, please.build/plugins.html, please.build/commands.html.

### 1.9 Bit (teambit/bit)

- **Component-as-unit-of-versioning** — every component has its own snap history, independent build/test/version, dependency-graph-aware version bumps.
- **Lanes** — branch-equivalent at the component level; review and atomic merge across N components.
- **Scopes** — collaboration servers per team; component IDs include scope; cross-scope imports are first-class.
- **Snap** — immutable record of source + deps + config + build artifacts.
- **MCP for components** — AI agents create/reuse components, framework-aware envs.
- **Ripple CI** — Bit's own CI that builds only affected components.

### 1.10 Point tools to consider absorbing

- **Knip 5** — unused files, exports, deps, devDeps, binaries, configs; production mode; native workspaces / TS project refs / 50+ plugins; `--fix` autofix.
- **Syncpack** — version groups, semver groups, `lint`, `fix`, `update`, `format`, `list`, `json`. Filters by scope/dep type/specifier kind.
- **Sherif** — zero-config monorepo linter — empty-deps, multiple-dependency-versions, root-package-manager-field, types-in-deps, unordered-deps, unsync-similar-deps, non-existent-packages.
- **Manypkg** — sibling rules (workspace protocol, internal-mismatch).
- **Wireit** — caches npm scripts with declared inputs/outputs, watch with poll fallback, GH Actions cache v2 backend.
- **Preconstruct** — TS multi-entrypoint library bundler with monorepo dev-redirects, auto DTS, ESM `module: true`.

---

## Section 2 — Cross-cutting capability matrix

Legend: ✓ first-class · ~ partial / experimental / community plugin · — absent

| Capability                                | Nx             | Turbo 2.6       | moon 2.0     | Vite+    | Lage       | Rush          | Bazel/Buck2/Pants/Please | Bit         | **vis**    |
| ----------------------------------------- | -------------- | --------------- | ------------ | -------- | ---------- | ------------- | ------------------------ | ----------- | ---------- |
| Remote cache (HTTP)                       | ✓ Replay       | ✓ Vercel+custom | ~ REAPI only | ✓        | ✓ backfill | ✓             | ✓                        | ✓           | ✓          |
| Remote cache (S3/GCS/Azure)               | ✓ self-host    | ~ custom server | ✓ via REAPI  | —        | ✓ Azure    | ✓             | ✓                        | ✓           | ~          |
| REAPI gRPC v2                             | —              | —               | ✓            | —        | —          | —             | ✓                        | —           | —          |
| Distributed task execution                | ✓ Agents       | — (sharding)    | — (planned)  | —        | ~ Cobuilds | ~ Cobuilds    | ✓ RBE                    | ✓ Ripple CI | —          |
| Affected/changed-since                    | ✓              | ✓               | ✓            | ✓        | ✓          | ✓             | ✓                        | ✓           | ✓          |
| Task-level affected                       | ✓ Atomizer     | ~ future flag   | ✓            | ✓        | —          | ~             | ✓                        | ✓           | ~          |
| Project-graph viz (interactive HTML)      | ✓              | — CLI only      | ✓            | ~ ui     | —          | —             | ~                        | ✓           | ✓          |
| Watch / continuous tasks                  | ✓ continuous   | ✓               | ✓            | ✓        | ~          | ✓             | ✓                        | ✓           | ✓          |
| CODEOWNERS sync                           | —              | —               | ✓            | —        | —          | —             | —                        | ~ scopes    | ✓          |
| Boundaries / module rules                 | ✓ ESLint       | ✓ Boundaries    | ~ tags       | ~ Oxlint | —          | ~ policies    | ✓ visibility             | ✓           | ✓ layer    |
| Generators / scaffolders                  | ✓              | —               | ✓ Tera       | ✓        | —          | —             | ✓ Starlark               | ✓ envs      | ✓          |
| Inferred tasks (no boilerplate)           | ✓ Crystal      | —               | —            | ✓ run    | —          | —             | —                        | ✓           | ~          |
| Migrators / codemods                      | ✓              | ~               | ✓            | —        | —          | ~             | —                        | ✓           | ✓          |
| Toolchain version mgmt                    | ~ mise roadmap | —               | ✓ proto      | ✓        | —          | —             | ✓                        | ~           | ✓          |
| Secret / vuln scanning                    | ~ conformance  | —               | —            | —        | —          | ~ policies    | ~                        | —           | ✓          |
| License compliance                        | ~              | —               | —            | —        | —          | ~             | ✓                        | —           | ~          |
| Test sharding/atomization                 | ✓ Atomizer     | ~               | ~            | ✓        | —          | —             | ✓                        | ✓           | —          |
| Flake detection / retries                 | ✓              | ~               | ✓            | ✓        | ~          | —             | ~                        | ~           | ✓          |
| Docker prune / scaffold                   | —              | ✓ prune         | ✓ all 3      | —        | —          | ~             | ✓                        | ✓           | ✓          |
| Editor integrations                       | ✓ Console      | —               | —            | ~ ui     | —          | ~             | ~                        | ✓           | —          |
| MCP / AI agent                            | ✓ MCP          | —               | —            | —        | —          | —             | —                        | ✓ MCP       | ~ ai cmd   |
| Self-healing CI                           | ✓              | —               | —            | —        | —          | —             | —                        | —           | —          |
| OpenTelemetry / webhooks                  | ✓ analytics    | —               | ✓ webhooks   | —        | —          | ~             | ~                        | ~           | ~ otel     |
| Plugin / extension API                    | ✓              | ~ fingerprint   | ✓ WASM       | ✓        | ✓          | ✓             | ✓ Starlark               | ✓           | ~ internal |
| Run replay / time-travel                  | ~ analytics    | ~ summary       | —            | —        | ~ profile  | —             | ~ logs                   | ✓ snaps     | ~ summary  |
| Polyglot (Rust/Go/Py)                     | ✓ JVM/.NET     | —               | ✓ Py/Rust    | —        | —          | —             | ✓                        | ~           | —          |
| Hermetic / sandboxing                     | ~ roadmap      | —               | —            | —        | —          | —             | ✓                        | ~           | ~ tracker  |
| Versioning / changesets                   | ~ Nx Release   | —               | —            | —        | —          | ✓ rush change | —                        | ✓ snap+tag  | —          |
| Workspace catalogs sync                   | ✓ pnpm         | ✓               | ✓            | ~        | —          | ✓             | ✓                        | ✓           | ✓          |
| OIDC trusted publish                      | ~              | —               | —            | —        | —          | —             | —                        | —           | —          |
| Unused-code (Knip-class)                  | —              | —               | —            | ~ Oxlint | —          | —             | —                        | ✓           | —          |
| Dep-version sibling lint (sherif/manypkg) | —              | —               | —            | —        | —          | ~ policies    | —                        | —           | —          |

---

## Section 3 — vis baseline (what does NOT need work)

These are first-class in vis today and broader than every competitor except Nx:

- Local + HTTP remote caching (`@visulima/task-runner`)
- Affected detection (Git-aware)
- Target selectors + MQL-like query language (`tag=X && language=Y`, `pkg:t`, `:t`, `~:t`, `#tag:t`)
- File groups + scoped task defaults
- Watch mode (`vis run :test --watch`)
- Flakiness detection (auto on failure, `--no-flaky` to suppress)
- Layer constraints (`enforceLayerRelationships`) + version constraints (semver.validRange)
- Project graph visualization (ASCII / DOT / JSON / HTML)
- `vis ci`, `vis doctor`
- Migrators: turborepo, nx, moon, gitleaks, secretlint, lint-staged, nano-staged
- Docker integration (`vis docker scaffold` + prune with `--focus`)
- CODEOWNERS sync (`vis sync codeowners`)
- Generators (`vis generate` — native TS templates **and** moon-format Tera with frontmatter)
- Remote project scaffolding (`vis create` via giget)
- Toolchain delegation (`vis toolchain` — proto/mise/fnm/volta/asdf/nvm)
- SBOM (`vis sbom` — CycloneDX 1.7 JSON/XML, full lockfile closure)
- Secret scanning (`vis secrets` — Rust port of gitleaks engine)
- `vis staged` (lint-staged replacement, no peer dep)
- Audit/check (`vis audit`, `vis check`, OSV.dev)
- Typosquat detection + Socket Security checks
- aube installer integration (Rust-native PM)
- AI commands (`vis ai`, `ai-analysis.ts`, `ai-cache.ts`)
- `vis analyze`, `vis optimize`
- chrome-trace profiles in task-runner (Lage `--profile` parity)
- file-access-tracker.ts (sandbox precursor)
- framework-inference.ts (Project-Crystal precursor)
- project-constraints.ts (Boundaries precursor)
- run-summary.ts (Turbo `--summarize` parity)
- OTel plugin (`src/plugins/otel.ts`)
- JSON Schemas for `project.json` + `vis-config.schema.json`
- Per-task shell override (unix/windows)
- Shell completions, interactive project picker, target auto-discovery, typo suggestions

---

## Section 4 — Gap analysis

### Tier 1 — High-leverage gaps (biggest differentiation impact)

| #   | Feature                                                    | Who has it                     | Why it matters                                                                                                                                                                     | Effort                           |
| --- | ---------------------------------------------------------- | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| 1   | **REAPI gRPC v2 remote cache**                             | moon, Bazel/Buck2/Pants/Please | Unlocks bazel-remote, BuildBuddy, BuildBarn, EngFlow as drop-in backends instead of yet-another HTTP protocol. Already in `todo.md` as Tier-3.                                     | High                             |
| 2   | **Distributed agents** (real-time, resource-aware)         | Nx Agents                      | Pre-bin sharding (Turbo) is the alternative. Lage Cobuilds is the lighter pattern (cooperative via shared cache + Redis lock).                                                     | High → Medium for Cobuilds-style |
| 3   | **MCP server**                                             | Nx, Bit                        | Exposes graph, generators, run logs to Claude/Cursor/Copilot. Cheap to ship, currently a moat for Nx in JS-land.                                                                   | Low–Medium                       |
| 4   | **Self-healing CI** (AI fix-on-failure with PR comment)    | Nx (alone)                     | vis already has `vis ai` / `ai-analysis.ts` — extend with a CI PR-comment loop. Strong differentiator vs everyone except Nx.                                                       | Medium                           |
| 5   | **Inferred tasks / Project Crystal**                       | Nx, Vite+                      | Read `vite.config`, `playwright.config`, `eslint.config`, `tsup.config`, `packem.config` → infer targets without `project.json` boilerplate. `framework-inference.ts` is the seed. | Medium                           |
| 6   | **Test atomization** (split each spec into its own target) | Nx Atomizer                    | Required to actually shard e2e/test work across distributed agents. Pairs with item 2.                                                                                             | Medium                           |
| 7   | **Public plugin API** (typed `VisPlugin` w/ stable hooks)  | Nx, moon (WASM), Rush          | Already open in `todo.md`. Without it, items 8 and 11 are blocked from third parties.                                                                                              | Medium                           |
| 8   | **Conformance / publishable cross-repo rules**             | Nx Polygraph (Enterprise)      | Probably overkill for v1; the seed = make `enforceLayerRelationships` + version constraints publishable as a package and runnable across repos.                                    | Medium                           |

### Tier 2 — Fills checklist parity

- **Webhooks / pipeline events** — open in `todo.md`. ~100 LOC over `LifeCycleInterface`. moon ships this; Nx has analytics; Turbo doesn't.
- **Sidecar / continuous tasks in the graph** — Turbo 2.5 `with:`, Nx 21 continuous. vis has task types `server`/`utility` and watch — confirm this maps cleanly or needs an explicit `with:` field.
- **Run replay / time-travel** — vis already produces `run-summary.ts`. Add a `vis replay <run-id>` that replays the recorded plan + diffs against current. Differentiator nobody else ships.
- **Boundaries / import-rule eslint plugin** — Turbo + Nx ship one. vis has `enforceLayerRelationships`; surface it as `eslint-plugin-vis` so existing ESLint configs pick it up.
- **`turbo prune`-equivalent for non-Docker case** — `vis docker scaffold --focus` exists, but the bare `prune` (containerizable workspace subset, no Dockerfile) is its own UX.
- **OIDC trusted publishing** — Lerna 9 added this Sept 2025. Relevant if vis grows a release surface; skip if `multi-semantic-release` stays the answer.
- **Knip / syncpack / sherif absorption** — `vis check`/`update` covers catalog drift; missing: unused-files/exports (`vis prune-deps`?), sibling version mismatch lint (sherif), workspace protocol enforcement (manypkg). High-value, low effort each.
- **Microfrontend dev proxy** — Turbo 2.6 stable. Niche unless you have a target audience there.
- **Strict env mode** (Turbo `TURBO_ENV_MODE=strict`) — tasks only see explicitly-listed env vars. Catches caching bugs.
- **Signed remote cache artifacts** (Turbo HMAC-SHA256) — integrity for self-hosted caches.
- **Fingerprint plugins** (Turbo TS extensions) — custom hash inputs / env transforms.
- **Workspace-graph queries** (`moon query`, `nx graph --focus`) — vis has graph viz but not scriptable queries.
- **Glob targets `app/...`** (Bazel-style, moon supports) — recursive subtree selection.

### Tier 3 — Long tail / niche

- **Polyglot first-class** (Gradle, .NET, Python) — Nx is investing heavily; moon has WASM toolchain plugins. Skip until clear demand.
- **Hermetic sandbox / network isolation** — `file-access-tracker.ts` is the seed. Nx has it on the 2026 roadmap; Bazel-style sandboxing is a multi-quarter project.
- **VS Code / JetBrains extension** — Nx Console is a real moat. Consider an MCP server (Tier-1 #3) first since it covers the AI-IDE flank cheaply.
- **Web UI / cloud dashboard** — Nx Cloud / Vercel Remote Cache. Out of scope without a hosting commitment.
- **Persistent workers** (Bazel) — sub-second incremental tsc/eslint. Big effort, narrow audience.
- **Component-level versioning** (Bit) — fundamentally different model; out of scope.
- **Dynamic execution** (race local vs remote) — only meaningful with a strong remote-execution backend.
- **Versioning / changesets engine** — `multi-semantic-release` already covers this. Don't compete.

---

## Section 5 — Recommendations

If picking 3–4 items for the next milestone, the strongest hand is:

1. **MCP server** — low effort, high signal in the AI-tooling year. Nx alone owns this in JS-land.
2. **Self-healing CI loop** on top of `vis ai` — Nx is the only competitor with this; you already have AI primitives.
3. **REAPI gRPC cache backend** — already on `todo.md`. Single big-ticket cache differentiator vs Turbo/Nx/Lage. Pair with the existing HTTP backend, don't replace it.
4. **Inferred tasks** built on `framework-inference.ts` — closes the "vis.json boilerplate" complaint vs Crystal/Vite+ run.

Items to explicitly defer:

- Distributed agents (high cost; Cobuilds-style is enough for v1)
- Polyglot (Gradle/.NET/Python)
- Hermetic sandbox
- Web UI / cloud dashboard
- Microfrontend proxy
- Component-level versioning

Worth reading before committing scope: `framework-inference.ts`, `project-constraints.ts`, `src/plugins/otel.ts`, `aube-resolver.ts`. Items 5 and the OTel-webhook gap may already be partially implemented.

---

## Section 6 — Sources

- Nx: nx.dev/blog/wrapping-up-2025, nx.dev/blog/nx-2026-roadmap, nx.dev/docs/features/ci-features/self-healing-ci, nx.dev/blog/nx-cloud-introducing-polygraph, nx.dev/docs/concepts/inferred-tasks, nx.dev/ci/features/split-e2e-tasks, nx.dev/docs/enterprise/conformance, nx.dev/blog/nx-mcp-vscode-copilot
- Turborepo: turborepo.dev/blog/turbo-2-5, turborepo.dev/blog/turbo-2-6, turborepo.dev/docs/reference/configuration, turborepo.dev/docs/guides/microfrontends, turborepo.dev/docs/crafting-your-repository/caching
- moon: moonrepo.dev/blog/moon-v2.0, moonrepo.dev/blog/moon-v1.30, moonrepo.dev/blog/moonbase-sunset, moonrepo.dev/docs/comparison, moonrepo.dev/docs/guides/remote-cache, moonrepo.dev/docs/guides/codeowners, moonrepo.dev/docs/concepts/query-lang, moonrepo.dev/docs/guides/webhooks, moonrepo.dev/docs/guides/docker, moonrepo.dev/proto
- Vite+: voidzero.dev/posts/announcing-vite-plus, voidzero.dev/posts/announcing-vite-plus-alpha, infoq.com/news/2025/10/vite-plus-unveiled
- Lage: microsoft.github.io/lage, github.com/microsoft/lage, github.com/microsoft/lage/blob/master/docs/docs/Guide/remote-cache.md
- Rush: rushjs.io, rushjs.io/pages/maintainer/phased_builds, github.com/microsoft/rushstack/issues/3485
- Lerna: nx.dev/blog/whats-new-with-lerna-6-5, lerna.js.org/docs/lerna-and-nx
- Bazel/Buck2/Pants/Please: bazel.build/remote/persistent, bazel.build/remote/rbe, buck2.build/docs/users/remote_execution, pantsbuild.org/dev/docs/using-pants/remote-caching-and-execution/remote-execution, github.com/aspect-build/rules_js, github.com/thought-machine/please, please.build, please.build/quickstart.html, please.build/config.html, please.build/plugins.html, please.build/commands.html
- Bit: github.com/teambit/bit, bit.dev/reference/reference/scope/scope-overview, bit.dev/reference/change-requests/building-lanes, bit.dev/reference/components/snaps
- Point tools: knip.dev, github.com/JamieMason/syncpack, github.com/QuiiBz/sherif, github.com/Thinkmill/manypkg, github.com/google/wireit, preconstruct.tools

---

## Section 7 — GitHub issue mining (added 2026-04-28)

Mined open issues across competitor repos to extend Sections 1–4 with user-validated demand signals. Reaction/comment counts approximate (GitHub HTML doesn't expose them reliably).

### 7.1 Visulima/vis own repo

`github.com/visulima/visulima/issues` returns no public feature requests against `@visulima/vis` — only the Renovate dashboard. The package is alpha; the issue tracker is not yet a roadmap signal source.

### 7.2 Themes from competitor issue trackers

#### Theme A — Cache backends (universal pain)

```
microsoft/lage #321  — Pluggable cache provider (public extension point)
microsoft/lage #728  — Pluggable cacheStorageConfig doesn't actually accept third-party providers
microsoft/lage #1037 — Move Azure cache implementation to plugin (v3 split)
microsoft/rushstack #2393 — [rush] Build cache feature (long-running thread)
microsoft/rushstack #1847 — [rush] CI caching with S3/GCS/Azure
nrwl/nx #33335 — S3 Cache Plugin: read-only cache mode not recognized
nrwl/nx #31398 — Not clear how to enable 'ciMode' for self-hosted remote cache
nrwl/nx #35455 — @nx/s3-cache 5.0.3 panics
vercel/turborepo #683 — Backend-as-binary, language-agnostic remote cache server
```

Takeaway: protocol matters less than the contract. Users want (a) documented HTTP/gRPC shape, (b) a `cacheMode: read | write | readwrite` triplet that actually works per environment, (c) S3+GCS+Azure+R2 first-class without forking. The Tier-1 REAPI gRPC item should ship together with explicit `cacheMode` so vis avoids Nx's `ciMode`/`localMode` confusion.

#### Theme B — Watch / devserver UX papercuts

```
vercel/turborepo #1497  — Multiple dependent long-running tasks in parallel (partial fix in 2.5 `with:`)
vercel/turborepo #12654 — `turbo watch dev` re-runs package dev when app changes (wrong-direction invalidation)
vercel/turborepo #4608  — failed to contact turbod / fsevents cookie (daemon liveness)
vercel/turborepo #8281  — Turborepo hanging in CI (daemon hang in non-TTY)
vercel/turborepo #12651/#12652 — Graceful shutdown / SIGINT not forwarded with sh on Windows
nrwl/nx #28513 — Watch throws "Daemon is not running" on Windows
nrwl/nx #35036 — Windows transient cmd.exe windows on file save
moonrepo/moon #2150 — Native restart-on-file-change
moonrepo/moon #1662 — TUI for local running tasks
google/wireit #233  — Keyboard shortcuts for watch mode (r/q/a like Vitest)
google/wireit #553  — Built-in --watch flag
```

Concrete wins: (a) interactive watch keybinds (Vitest-style `r/q/a/p`), (b) clean SIGINT/SIGTERM forwarding tested on Windows cmd/PowerShell + sh, (c) daemon health command + auto-recover, (d) sidecar/`with:` semantics so app-changes don't re-run packages.

#### Theme C — Affected detection edge cases

```
moonrepo/moon #1865 — $AFFECTED_FILES token in task commands
moonrepo/moon #2047 — Jujutsu (jj) workspace support
nrwl/nx #18754 — CLI flag to display which input(s) caused a cache miss
nrwl/nx #12847 — Allow inputs from outside {workspaceRoot}
vercel/turborepo #8051 — Tasks should run dependsOn before hashing inputs
```

Pickups: `$AFFECTED_FILES` token, `--why-not-cached <task>` debug command, Jujutsu support, inputs-outside-workspaceRoot. vis's `VIS_AFFECTED_FILES` env-var forwarding is close but not the same as inline command tokens.

#### Theme D — Per-task / per-env config gaps

```
nrwl/nx #14010 — Disable loading .env files (strict env mode)
moonrepo/moon #1666 — Conditional tasks (when: { os, env, branch, ci })
moonrepo/moon #1815 — Cleanup / finally tasks (always-run-on-finish)
moonrepo/moon #801  — Explicit serial/parallel task execution control per edge
google/wireit #66   — Package-level defaults (not just root + per-task)
google/wireit #325  — Semaphore-style "max N of these at once"
microsoft/lage #82  — Per-task --no-cache from CLI
microsoft/lage #818 — Inputs/output paths relative to different roots
```

Pickups: conditional tasks, finally-tasks, per-edge concurrency limits, per-task memory/CPU caps, strict env mode, `--no-cache <task>` per-invocation.

#### Theme E — Plugin / extension API requests

```
microsoft/lage #321 — Pluggable cache provider (also Theme A)
moonrepo/moon #1902 — Generator command execution as plugin
google/wireit #152 — Wireit configuration file (precondition for plugins)
```

Confirms vis's open-todo plugin-API item is universally requested in this product category.

#### Theme F — Editor / IDE / LSP requests

```
moonrepo/moon #1878 — IntelliJ IDE plugin
moonrepo/moon #2220 / #1455 — Better autocomplete / dynamic shell completion
vercel/turborepo #9869 — LSP fails to connect
vercel/turborepo #8577 / #8583 — VSCode extension fragility
webpro-nl/knip #1490 / #1491 / #1566 — VS Code extension polish (multi-root, refresh)
```

Cheaper play than building Nx Console parity: (1) MCP server (already Tier-1), (2) JetBrains/VSCode tree-view shelling out to `vis`, (3) tree-sitter/LSP for `vis-config.ts` + `project.json`.

#### Theme G — CI providers beyond GH Actions

Surprisingly thin signal — most CI issues are TTY/daemon bugs, not "please add Jenkins/CircleCI/GitLab support." Implication: ship clean GH Actions presets and the rest mostly works. Differentiation opportunity: GitLab CI / Buildkite / Bitbucket Pipelines presets (Nx and Turbo only ship GH Actions).

#### Theme H — Telemetry / OTel / webhooks

```
moonrepo/moon #2490 — OpenTelemetry task-level tracing and metrics
```

Single but loud signal. vis already has `src/plugins/otel.ts`; flesh it into a documented contract → instant competitive selling point.

#### Theme I — Bazel-shop crossover (RBE / hermeticity / persistent workers)

```
aspect-build/rules_js #1258 — Bun support under Bazel/RBE
aspect-build/rules_js #239  — .npmrc public hoisting under sandbox
aspect-build/rules_js #362  — ESM imports escape sandbox & runfiles
aspect-build/rules_js #1168 — js_binary launcher not portable host→exec
aspect-build/rules_js #1985 — Vite devserver DX under RBE
```

Bazel-shop users keep migrating _out_ because of #1985-class DX papercuts. vis's pitch is the inverse — Bazel hermeticity at JS ergonomics. REAPI backend + existing watch UX targets these migrators directly.

#### Theme J — Lock-in / migration pain

```
lerna/lerna #51 — lerna --dryrun preview
vercel/turborepo #1100 — Strip in-workspace devDependencies when pruning
vercel/turborepo #504  — Vercel docs for `turbo prune` Next.js incomplete
teambit/bit #4281 — API unavailable (proprietary scope server lock-in)
nrwl/nx #14524 — Completely silent mode (for migrating *out* of Nx)
microsoft/rushstack #2045 — Lightweight 'rush deploy' without symlinks
```

Insight: vis's existing inbound migrators (turbo/nx/moon → vis) are correct. The missing piece is the **inverse** — `vis export` emitting a runnable `turbo.json` / `nx.json` / `moon.yml` so users can prove "yes, you can leave any time."

#### Theme K — Diagnostics ("why did/didn't this happen?")

```
vercel/turborepo #937 — Scripts run unnecessarily depending on config
nrwl/nx #18754 — Show which input caused cache miss (same root cause)
microsoft/lage #689 — Lage hard-errors when run outside git repo
microsoft/lage #695 — Local cache silently no-ops in CI
microsoft/lage #82  — --no-cache as escape hatch
moonrepo/moon #1998 — Failed to load toolchain in CI
moonrepo/moon #2363 — Can't run pnpm in script after v2 system toolchain change
nrwl/nx #32996 — Remote cache EACCES mkdir (container perms)
```

Universal UX gap. Concrete commands to ship: `vis why <task>` (cache hit/miss + which input changed), `vis explain <task>` (resolved env, shell, cwd, hash inputs), `vis doctor --task <task>` (toolchain/perms preflight).

#### Theme L — Knip / syncpack / unused-code asks

```
webpro-nl/knip #1442 — Unused exports in entry files
webpro-nl/knip #1670 — Type imports in Svelte not detected
webpro-nl/knip #1562 — `knip --watch` breaks on Windows
JamieMason/syncpack #220 — Custom npm registries
JamieMason/syncpack #304 — Overrides + catalogs in pnpm-workspace.yaml (vis already covers)
JamieMason/syncpack #244 — Constraints applying only when updating (lint vs update modes)
```

Knip-class unused-export detection is the largest pure-feature gap relative to vis's breadth ambition. Mid-effort to absorb.

### 7.3 Surprises — items NOT in Sections 1–4 baseline

These should be added as new line-items:

1. **Jujutsu (jj) VCS support** — moon #2047 traction; AI-pair workflows are pushing jj adoption. Abstract the affected-detection backend.
2. **`vis why <task>` cache-miss diagnostics** — Nx, Lage, Turbo all field the same root-cause asks separately.
3. **`$AFFECTED_FILES` token in command strings** — moon #1865; close to vis's existing env-var forwarding but not the same.
4. **Conditional tasks** (`when: { os, env, branch, ci }`) — moon #1666.
5. **Finally / cleanup tasks** (`always: true`) — moon #1815.
6. **Per-edge concurrency limits** ("max N of these at once") — wireit #325.
7. **Per-task memory/CPU caps** — implicit in Nx Agents resource scheduling; useful even without distributed agents.
8. **Inputs from outside `{workspaceRoot}`** — Nx #12847.
9. **Outbound migrators** (`vis export → turbo/nx/moon.yml`) — anti-lock-in story.
10. **GitLab CI / Buildkite / Bitbucket presets** — only Nx ships these well.
11. **Daemon health & auto-recover** — Turbo #4608, Nx #28513 pattern.
12. **`--no-cache <task>` per-invocation** — Lage #82.
13. **Watch keybindings (Vitest-style)** — wireit #233.
14. **Strict env mode** — Turbo has it; Nx users still ask. Ship explicitly with a clear failure mode.
15. **Knip-class unused-code detection** (`vis dead-code` / `vis prune`) — real demand, real gap.

### 7.4 Updated priority candidates (issue-mined)

These reorder the Section 5 recommendations based on user-validated demand:

1. **`vis why <task>`** — cache-miss & input-change diagnostics. Three competitor communities filing the same root-cause issue from different angles. vis already produces run summaries; surfacing them as `why` is days of work for a flagship UX win.

2. **`$AFFECTED_FILES` token + per-task condition system** (moon #1865, #1666, #1815). Affected-file tokens, conditional tasks, finally-tasks together change what users can express. Low risk, high leverage; pairs with vis's existing affected pipeline.

3. **REAPI gRPC backend with explicit `cacheMode: read|write|readwrite` per env.** Already Tier-1; issue mining adds the UX requirement — Nx's `ciMode`/`localMode` confusion is the main reason people give up on remote cache. Ship the protocol + fix the mode story together.

4. **Watch UX bundle** — Vitest-style keybinds + Windows-clean SIGINT + daemon-doctor. Three competitors have unresolved Windows watch bugs. vis is alpha — building this in correctly _now_ is far cheaper than retrofitting.

5. **MCP server + outbound migrator (`vis export`).** Pair them: MCP gets the AI-tooling year (Nx alone owns it in JS); `vis export` gets the anti-lock-in story (turbo/nx/moon → vis already exists; vis → them does not). Together: "low-risk to adopt, low-risk to leave."

Deferred: distributed agents (Cobuilds-style is cheaper), Knip absorption (separate product surface), persistent workers (no demand signal in JS task-runner issues), polyglot (only one moon C# signal), IntelliJ plugin (MCP covers most surface).

---

## Section 8 — Deep-pass issue mining (added 2026-04-28)

After the initial sample pass, ran a thorough sweep:

- **Full coverage** (every open issue): syncpack (24), bit (25), turborepo (33), wireit (98), moon (113), lage (116), rules_js (164) — 573 issues
- **Top-100 reactions + 50 most-recent**: nx (352 → 140 read), rushstack (885 → 140 read)
- Skipped: knip, lerna (per request)

Coverage gaps disclosed: nx has ~210 unread (mostly per-plugin Angular/NestJS bugs); rushstack has ~745 unread (mostly api-extractor / eslint-patch internals — zero vis crossover).

### 8.1 NEW themes (not in Section 7.2)

#### Theme M — Surface content hashes & make caching debuggable from outside

CLI exposes the actual hashes driving cache hits/misses, plus structured manifest output. Goes beyond Theme K — treat the hash itself as a first-class artifact for cross-machine cross-checks, CI logs, dashboards.

- `moonrepo/moon#2174 — [feature] Surface Content Hashes via CLI`
- `microsoft/lage#688 — Log environmentGlob hash to console with running task`
- `microsoft/lage#640 — [RFC]: Compute hash of dependent targets`
- `google/wireit#1315 — Include additional fields in package.json in fingerprint`

#### Theme N — Cache size management & retention

Universal complaint: caches grow forever, deletion is slow, DBs become unbounded. None of Nx/Lage/Wireit/Rush ships a real retention policy.

- `nrwl/nx#35329 — @nx/shared-fs-cache constructs NxCache without maxCacheSize → unbounded growth`
- `microsoft/lage#921 — Deleting lage cache takes multiple minutes`
- `microsoft/lage#120 — Cache continues to grow. Needs retention policy`
- `google/wireit#71 — Garbage collection for cache directory`
- `google/wireit#605 — Restoring from cache is very slow for large files`

Concrete shape: max-size + TTL + LRU, with `cache prune --keep-last 30d --max-size 5GB`.

#### Theme O — Cache-restored output fidelity (timestamps, perms, ordering)

Restoring from cache produces files with mtime=now, breaking Make-style downstream tools, container layer caching, and any tool using mtime as a heuristic.

- `google/wireit#1316 — Restore timestamps when restoring from cache`
- `microsoft/lage#766 — cached task overwrites modified top-level files outside src/`
- `microsoft/lage#839 — Hashes should differ when inputs differ by filename only`
- `microsoft/lage#690 — Cache invalidation issue for test files`

Important if vis wants Docker layer caching to work cleanly with `vis docker scaffold`.

#### Theme P — Skip-on-warning / non-failing build incrementality

Cache should skip projects that previously emitted warnings but not errors. Today most runners treat exit 0 + stderr as cacheable, but TS/eslint warnings are an iteration loop users want to short-circuit.

- `microsoft/rushstack#1402 — Incremental build should skip projects that succeed with warnings`
- `microsoft/lage#634 — [RFC]: "Force Verbose" logging configuration for certain tasks`
- `nrwl/nx#31827 — eslint output logged twice with output-style=static`

#### Theme Q — Pass changed-files / argv list to underlying script

Distinct from Theme C ($AFFECTED_FILES env var). Users want runners to **invoke the underlying tool with the changed file list** — e.g., `eslint --` followed by N filenames. One rung deeper than affected detection.

- `google/wireit#168 — Script access to changed/added/removed files`
- `moonrepo/moon#2260 — Add a "flag-per-file" token`
- `microsoft/lage#745 — lage shouldn't forward all arguments to all running targets`

Converging shape: `${affected.files}` token expanding to space-separated paths; `flag-per-file` variant for tools needing `--file X --file Y`.

#### Theme R — Service / sidecar lifecycle that survives across invocations

Beyond Turbo's `with:` (within one run), users want long-lived services (DB, mock server, devserver) shared across multiple `vis run …` calls within the same shell session.

- `google/wireit#580 — Allow services to be shared across wireit invocations` (8 thumbs)
- `google/wireit#608 — Proposal: protocol watch processes can implement`
- `moonrepo/moon#1365 — Persistent Tasks and Dependencies`
- `moonrepo/moon#2003 — Run persistent task and run other task after`
- `microsoft/rushstack#1151 — Long-running toolchain process to avoid cold start`

Concrete shape: a `services` registry — `vis service start db; vis run :test` and the test task auto-attaches.

#### Theme S — Configuration layering / hierarchy / extends

Package-level defaults (not just root + per-project), shared task templates with private extends, aliasing/namespacing for tasks. Multiple competitors stuck here.

- `google/wireit#66 — Specify options for all scripts in a package`
- `google/wireit#1292 — Extend a common configuration`
- `moonrepo/moon#2164 — Support private repositories for `extends`in`.moon/tasks/\*`
- `moonrepo/moon#2113 — `.moon.yml` as additional entry point`
- `moonrepo/moon#1499 — Hierarchical project grouping`
- `moonrepo/moon#2036 — Namespacing/aliasing for commands with same name across tags`
- `microsoft/lage#816 — [RFC]: Pipeline definition merging`
- `microsoft/lage#817 — [RFC]: Target settings support in package.json`
- `microsoft/lage#163 — Package level lage.config.js`

Recurring shape: root `vis-config.ts` + per-package `vis-task.ts`, both contributing to a merged definition with explicit override semantics.

#### Theme T — Output styles & log-quietness controls

Verbose-on-failure / quiet-on-success. Distinct from watch UX (Theme B). Either Vitest-style quiet-by-default with auto-expand on failure, or per-task verbose configuration.

- `moonrepo/moon#2475 — Native CLI mode for quiet-on-success / verbose-on-failure`
- `moonrepo/moon#2451 — Stream task stdout without decorative headers`
- `moonrepo/moon#1930 — Hide output from cached tasks`
- `moonrepo/moon#2424 — Silence output of implicit triggered tasks`
- `moonrepo/moon#2146 — Show logs from last failed task`
- `microsoft/lage#634 — Force Verbose logging for certain tasks`
- `google/wireit#1303 — Non-interweaved output for simple logger`
- `google/wireit#56 — Pretend to be a TTY` (5 thumbs)

#### Theme U — Worktree / multi-checkout support

Distinct from VCS support (jj). With AI agents now spawning N parallel worktrees from one repo, runners that share state in `~/.cache` or `common/temp/build-cache` get cross-contamination.

- `microsoft/rushstack#5633 — Better support for Git Worktrees`
- (cross-ref: `moonrepo/moon#2047` jj — adjacent)

Concrete shape: cache key namespace by worktree fingerprint; per-worktree overlay over a shared base cache.

#### Theme V — Standalone / language-agnostic / non-npm execution

Asks to run the runner over directories that aren't npm packages. Less ambitious than full polyglot — let `vis run` work on `pyproject.toml` / `Cargo.toml` projects without a `package.json` shim.

- `google/wireit#1407 — Support standalone (non-npm) usage`
- `vercel/turborepo#683 — Backend-as-binary, language-agnostic remote cache (140 thumbs)`

moon already does this; Turbo doesn't; vis status unclear.

#### Theme W — Lockfile/install awareness inside task graph

Detect "lockfile changed but you didn't `pnpm install`" before tasks run; detect that a `package.json` change requires re-install.

- `moonrepo/moon#2055 — Doesn't invalidate cache when file: protocol deps change`
- `moonrepo/moon#2163 — moon sync should update package.json's engines + packageManager`
- `microsoft/rushstack#5624 — rush change does not detect catalog version changes`
- `vercel/turborepo#12658 — Cannot parse pnpm 11 lockfiles with new flat-string patchedDependencies`
- `microsoft/lage#735 — Adding a new package without yarn link causes a crash`

#### Theme X — Interactive / stdin tasks

Genuine product gap. Few runners handle generators, codemods, REPLs, prompts transparently.

- `google/wireit#281 — Support interactive scripts`
- `google/wireit#808 — Forward keyboard press events`
- `google/wireit#56 — Pretend to be a TTY`
- `nrwl/nx#9038 — Add support for other enquirer prompts`

#### Theme Y — Task descriptions / discoverability

Each task should carry a human-readable description visible in `--help`, autocomplete, TUIs. Trivial; repeatedly requested.

- `google/wireit#1015 — Support script comment/description`
- `google/wireit#647 — Concise scripts`
- `moonrepo/moon#1914 — title option to moon task`
- `moonrepo/moon#2415 — Configurable CLI foreground colors for task names`
- `moonrepo/moon#1455 — Dynamic Bash/Fish tab completion`

#### Theme Z — Generator / template introspection for AI agents

Beyond a bare MCP server: AI agents need template _discovery_ tools so they can list available templates and their variables before invoking a generator.

- `moonrepo/moon#2437 — Add MCP tools for template discovery and introspection`
- `moonrepo/moon#2367 — [IDEA] Deeper AI integration`

Concrete: ship MCP `list_templates` / `describe_template` alongside `run_generator`. Same for `list_projects` / `describe_project`.

#### Theme AA — Release-from-runner pipelines (build → package → publish chain)

Users want the runner itself to orchestrate "deploy"/"release" workflows end-to-end.

- `moonrepo/moon#1698 — Support a deploy task type`
- `moonrepo/moon#1681 (roadmap) — Release workflows (build → package → publish)`
- `microsoft/rushstack#3934 — [rush] Design: Publishing 2.0`
- `microsoft/rushstack#904 — Make publishing easier and more flexible`

vis defers versioning to multi-semantic-release; _deploy_ (push artifact, not version) is undertilled.

### 8.2 Additional supporting refs for existing Section 7.2 themes

**Theme A — Cache backends**

- `microsoft/rushstack#2393 — Build cache feature`
- `microsoft/rushstack#4477 — Rush build cache design incompatible with Next.js (folder vs glob)`
- `nrwl/nx#35329 — Shared FS cache lacks maxCacheSize`
- `nrwl/nx#35403 — Cache restoration on CI fails randomly`
- `nrwl/nx#31568 — Caching breaks with output paths outside workspace`

**Theme B — Watch / devserver UX**

- `nrwl/nx#23585 — SIGINT handling in executor broken after upgrade`
- `nrwl/nx#33720 — Terminal UI freezes when using nx run serve`
- `nrwl/nx#31119 — readyWhen not working as expected with TUI disabled`
- `nrwl/nx#31307 — Disabling TUI swallows output and breaks interactivity`
- `nrwl/nx#32802 — TUI doesn't handle mouse momentum well`
- `nrwl/nx#31849 — TUI crashes with "failed to openpty"`
- `microsoft/rushstack#2582 — rush watch mode design discussion`
- `google/wireit#788 / #790 — wireit watch crashes on symlink loops`

**Theme C — Affected detection edge cases**

- `moonrepo/moon#2476 — moon run warns about shallow checkout even without --affected`
- `moonrepo/moon#2499 — moon ci does not run dependents across project boundaries`
- `moonrepo/moon#1872 — Improve moon ci affected project detection`
- `moonrepo/moon#1971 — Moon ci fails in Azure DevOps PR builds`
- `moonrepo/moon#2198 — Moon CI skips dependent tasks`
- `nrwl/nx#20523 — Track external (outside NX project) directory changes for affected`
- `nrwl/nx#30169 — affected doesn't ignore test files`
- `nrwl/nx#32974 — Target inputs with {projectName} doesn't work with affected`

**Theme D — Per-task / per-env config**

- `moonrepo/moon#2345 — env vars with defaults in task commands`
- `moonrepo/moon#2243 — CLI option to replace/overwrite task arguments`
- `moonrepo/moon#1993 — Simpler way to define internal tasks`
- `moonrepo/moon#1562 — Give names to dependent tasks`
- `microsoft/lage#314 — Allow custom npmClient per task`
- `microsoft/lage#106 — Allow package-local cache configuration`

**Theme E — Plugin / extension API**

- `google/wireit#888 — Proposal: introduce Wireit plugins`
- `google/wireit#983 — Configure wireit through .wireitrc.js`
- `moonrepo/moon#2121 — OCI Artifact Distribution for Moon WASM Plugins`

**Theme F — Editor / IDE / LSP**

- `google/wireit#823 — Publish wireit extension to Open VSX`
- `nrwl/nx#34005 — Failed migration in Nx Console`
- `microsoft/rushstack#5558 — Add Test Harness for VS Code Extensions`

**Theme G — CI providers**

- `nrwl/nx#33998 — Nx hangs in GitHub Actions`

**Theme I — Bazel-shop crossover**

- `aspect-build/rules_js#2715 — Performance issues with remote cache`
- `aspect-build/rules_js#2540 — Installing new packages invalidates caches for unrelated targets`
- `aspect-build/rules_js#1751 — Preventing input leakage via global caches`
- `aspect-build/rules_js#1669 — __dirname is not hermetic`

**Theme J — Lock-in / migration**

- `microsoft/rushstack#5680 — Warnings on rush install`
- `vercel/turborepo#10618 — Installation fails on Windows / missing binaries`
- `nrwl/nx#35135 — Module Federation shared packages fail with Bun`

**Theme K — Diagnostics**

- `nrwl/nx#35339 — STATUS_STACK_OVERFLOW on Windows after Nx 20→22`
- `nrwl/nx#35297 — Non-deterministic ProjectConfiguration hash (JSON.stringify ordering)`
- `nrwl/nx#35150 — Negated outputs patterns don't prevent caching of excluded directories`
- `nrwl/nx#30886 — bang (!) in outputs does not work correctly`
- `microsoft/lage#86 — Generate informative cache-debug output`

**Theme L — Knip / syncpack / unused-code**

- `microsoft/rushstack#1454 — Command to fix version mismatches with interactive prompt`
- `microsoft/rushstack#5490 — allowedAlternativeVersions is too permissive`
- `microsoft/rushstack#5602 — common-versions.json preferredVersions causes rush install failure`
- `JamieMason/syncpack#220 — Custom npm registries (12 thumbs)`
- `JamieMason/syncpack#216 — Allow autofix to be optionally disabled`
- `JamieMason/syncpack#168 — Sync values which are not versions`
- `JamieMason/syncpack#205 — Allow sources to be added without replacing discovered`
- `JamieMason/syncpack#231 — Query language within pnpm.overrides`

### 8.3 Notable one-offs worth product-shaping

1. **`syncpack#285` — `syncpack install <pkg> -w <pkg>`** — install a dep that auto-conforms to existing version groups. vis could absorb as `vis install <pkg> --to <pkg>` since `vis check`/`update` already understand version groups. Trivial; users love it.

2. **`syncpack#244` — Constraints applying only when updating (lint vs update modes).** Different rules for "what's allowed to land" vs "what we'll auto-bump to."

3. **`turborepo#683` — Backend-as-binary, language-agnostic remote cache server (140 thumbs).** Most-reacted feature request across all repos surveyed. Confirms REAPI plan; suggests also shipping a **standalone `vis-cache` server binary** users can run anywhere.

4. **`turborepo#1100` — Strip in-workspace devDependencies when pruning (74 thumbs).** Universal Docker scenario; `vis docker scaffold --focus` should explicitly call out devDep stripping.

5. **`moon#2342` — Operate behind firewall.** Toolchain plugins fail in air-gapped/proxied corporate networks. Differentiator: ship `vis offline-bundle` capturing toolchain artifacts into a deployable tarball.

6. **`moon#1985 — RFC: Task input additions and enhancements.** URI-based input format (`file://`, `glob://`, `env://`, `func://`). Worth reading if vis adds new input types — adopt the URI scheme so future expansion is easy.

7. **`wireit#168` / `moon#2260` — flag-per-file token.** Specific shape: `${changed_files | flag '--file'}` expands `a b c` to `--file a --file b --file c`. eslint, prettier, tsc need this.

8. **`moon#2099` — Task-level tag.** Run only tasks tagged `gpu` on GPU runners; `slow` overnight; etc. Pairs with vis's MQL-like query.

9. **`rushstack#1857` / `#5633` — Project graph query + worktree support.** vis's graph viz should be queryable + worktree-aware.

### 8.4 Updated top priority candidates (post-deep-pass)

Reordered based on combined Section 7 + 8 evidence. The top 5 from 7.4 still hold; adding 5 more that the deep pass surfaced:

**From 7.4 (still confirmed):**

1. `vis why <task>` — cache-miss diagnostics
2. `$AFFECTED_FILES` token + conditional/finally tasks
3. REAPI gRPC backend with `cacheMode: read|write|readwrite`
4. Watch UX bundle (Vitest keybinds + Windows-clean SIGINT + daemon-doctor)
5. MCP server + outbound migrator

**New from deep pass (Section 8.4 picks):**

6. **Content-hash CLI surfacing** (Theme M) — bundle with #1 above. Ship `vis hash <task>` printing the resolved hash + every input that contributed; ship structured `--output-style json` so CI can ingest. Pulls from existing `run-summary.ts`. Days of work.

7. **Cache retention & GC** (Theme N) — `vis cache prune --keep-last 30d --max-size 5GB`. Universal foot-gun (nx#35329, lage#921, lage#120, wireit#71); no JS-land competitor ships clean retention. Direct production-pain win.

8. **Package-level + extends config layering** (Theme S) — root `vis-config.ts` + per-package `vis-task.ts` overlay with explicit merge semantics. wireit#66, moon#2113, lage#163, lage#816 all stuck here. Differentiator no one ships cleanly.

9. **Output styles** (Theme T) — quiet-on-success / verbose-on-failure. Single most-requested QoL across surveyed repos. One CLI flag + a `taskOptions.outputStyle` field to match Vitest's bar.

10. **Generator/template introspection MCP tools** (Theme Z) — bundle with the MCP-server priority. moon#2437 explicit: don't ship MCP without `list_templates` / `describe_template` / `list_projects` / `describe_project` or AI agents fly blind. Marginal cost over already-planned MCP server.

Honorable mentions (file but defer): shared services across invocations (Theme R, wireit#580), task-level tags (moon#2099), changed-files-as-argv token (Theme Q), worktree-aware caches (Theme U), standalone non-npm execution (Theme V), interactive/stdin tasks (Theme X), task descriptions (Theme Y), release-from-runner pipelines (Theme AA).
