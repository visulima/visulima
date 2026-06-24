# Design — `vis release`: release subsystem inside `@visulima/vis`

| Field                 | Value                                                                                                                                          |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **Status**            | Draft (RFC)                                                                                                                                    |
| **Author**            | Claude (initial draft)                                                                                                                         |
| **Branch**            | `claude/add-release-management-HRxHK`                                                                                                          |
| **Belongs to**        | `@visulima/vis` — release subsystem at `packages/tooling/vis/src/release/`                                                                     |
| **Replaces**          | `multi-semantic-release` + per-package `.releaserc.json` + `scripts/semantic-release-native-addons.mjs` + `scripts/publish-preview-release.js` |
| **Reference designs** | bumpy (primary port target) · nx release · semantic-release · changesets                                                                       |

---

## 1. Summary

A new release subsystem inside `@visulima/vis`, exposed as the `vis release …` command tree. Implemented in `packages/tooling/vis/src/release/`. **No separate package** — the release subsystem is part of vis itself, shipped with every vis release, registered via cerebro like every other top-level command.

**Core algorithm: port of bumpy.** Contributors drop YAML-frontmatter Markdown "change files" in `.vis/release/` (configurable), CI maintains a rolling release PR, merging it publishes. The release subsystem reuses vis's existing infrastructure:

- **Cerebro plugin manager** for command registration with lazy loaders
- **Config loader** (`loadVisConfig`) — adds a `release: {…}` block to the existing `vis.config.ts`
- **Project graph + affected detection** (already used by `vis run`, `vis ci`, `vis affected`)
- **Package-manager detection** (already used by `vis pm`)
- **Logger / error handler / security enforcement** plugins
- **Monorepo root finder** (`findMonorepoRootSync`)

Three features layered on top of bumpy's design:

- **Channel routing** (alpha/beta/next/latest by branch, borrowed from semantic-release) — built-in but optional config block.
- **NAPI sidecar publishing** (port of `scripts/semantic-release-native-addons.mjs`) — built-in but optional `versionActions` plugin, auto-detected via `napi` field in `package.json`.
- **Snapshot / preview releases** (replaces visulima's `pkg-pr-new` script) — built-in subcommand. Default backend stays `pkg-pr-new`; with three workflow ideas borrowed from alchemy's `pr-package` (multi-tag publishes, marker-based sticky comments, PR-close cleanup).

**Cross-package-manager support is first-class.** vis already runs in npm, pnpm, yarn, and bun projects — the release subsystem inherits that. The publish step always pipes the tarball into `npm publish <tarball>` regardless of which manager packed it (the lowest-common-denominator path that survives yarn's missing tarball-publish support and bun's missing provenance/OIDC).

Migration from visulima's existing `multi-semantic-release` setup is per-package opt-in via `release.managed: true|false`. Migration from `semantic-release` and `changesets` (in any project using vis) is supported by `vis release init --from-{semantic-release,changesets}`. Existing `CHANGELOG.md` files keep their format; the new subsystem prepends new entries (no reformat).

**If external (non-vis) adoption emerges**, the `core/` modules are written as pure functions with no cerebro/vis-specific imports — a future `@visulima/vis-release-core` library is a mechanical extraction (drag the directory, add a `package.json`). We do not pay that cost upfront.

---

## 2. Goals

1. **First-class `vis` subcommand suite.** `vis release add`, `vis release version`, `vis release publish`, `vis release snapshot`, `vis release ci {check,plan,release,snapshot,setup}`, `vis release init`, `vis release status`, `vis release check`, `vis release plan`, `vis release doctor`. Registered in `packages/tooling/vis/src/bin.ts` like every other vis command, with lazy loaders so cold-start cost is paid only when invoked.
2. **All four major package managers**: npm, pnpm, yarn (Berry/v4), bun. Auto-detect from lockfile (vis already does this); each PM has its own `pack`/install code path; **publish always normalizes to `npm publish <tarball>`** as the lowest-common-denominator (yarn refuses tarballs, bun lacks OIDC/provenance — see §11).
3. **First-class monorepo ergonomics**: one PR can carry N change files for M packages with M different levels and user-facing changelog prose.
4. **Workspace protocol resolution at publish time** for `workspace:^`, `workspace:~`, `workspace:*`, `workspace:^x.y.z`. **`catalog:` resolution is built-in** because only `pnpm pack` understands it natively — we rewrite catalog refs in-place before pack so npm/yarn/bun consumers get a clean tarball too.
5. **Channel routing as opt-in config** (not core algorithm): `main → latest`, `next → next`, `beta → beta`, `alpha → alpha`, plus maintenance branch globs. Versions get the right pre-release id and dist-tag automatically. Each channel can be configured with `mode: "auto-publish"` or `mode: "version-pr"` (review gate).
6. **NAPI/native addon support as a built-in plugin**, not core: parent + N platform packages versioned together, platform packages published first, OIDC token exchange per platform package. Auto-detected via `napi` field in `package.json`.
7. **Snapshot / preview releases**: `vis release snapshot --tag pr-1234` publishes affected packages with `0.0.0-pr-1234-<sha>` versions. Default backend `pkg-pr-new`; configurable to a registry of choice. Workflow ideas (multi-tag publish, sticky-comment-via-marker, PR-close cleanup) borrowed from alchemy's `pr-package` workflow — see §13.
8. **Pluggable `versionActions`** per package category (npm, native-addon, private, custom) — modeled on nx release's per-project plugin contract.
9. **Programmatic API** so internal tooling (Nx generators, custom scripts) can compose `releaseVersion()` / `releaseChangelog()` / `releasePublish()` / `releaseSnapshot()`. Same shape as nx release. Sub-export from vis: `import { releaseVersion } from "@visulima/vis/release"`.
10. **Migrateable from `multi-semantic-release`, `semantic-release`, and `changesets`**: existing tag history continues to work; existing `CHANGELOG.md` files are prepended-to (mixed format during transition); per-package opt-in via `release.managed: true|false`.
11. **Reuse vis infrastructure**, don't reimplement: cerebro plugin manager, `loadVisConfig`, `findMonorepoRootSync`, error handler plugin, security enforcement plugin, package-manager detection, project-graph affected detection.

## 3. Non-goals

- **Replacing Nx** for task orchestration. Nx still owns build/test/lint via `vis run` / `nx run-many`. The release subsystem _consumes_ Nx's project graph in visulima's case but doesn't _require_ it: in non-Nx projects vis already falls back to walking `package.json` `workspaces` globs (or pnpm-workspace.yaml / yarn workspaces / bun workspaces).
- **A separate the release subsystem package.** The release subsystem ships inside `@visulima/vis`. If external adoption demands it later, a `core/` extraction is a mechanical refactor (see §1) — but we do not build for that hypothetical user upfront.
- **A standalone `vis-release` bin.** Users invoke `vis release …`. No `npx vis-release add` — `npx vis release add` (which works because `vis` is the bin).
- **Complete GitHub + GitLab support** in v1. The `RemoteReleaseClient` interface is shipped with full `github` and `gitlab` adapters: sticky comments, release creation (including structured assets, GitHub `discussion-category`, GitLab `milestones`, GitLab Generic Package Registry uploads), pull/merge-request upsert, label application, and find-or-create + close failure-issue management. Self-hosted GitLab is configurable via `release.gitlabHost`. Detection (env vars + git remote URL) works for both providers; `release.provider: "github" | "gitlab" | "auto"` config is wired. Capabilities still deferred to a follow-up RFC: GH Enterprise URL config, HTTP(S) proxy config, GitHub two-step draft→publish atomic asset upload, GitHub `generate_release_notes: true` shortcut, post-release walk-and-comment for `successComment`/`releasedLabels` (the methods exist; an orchestrator wrapper is what's missing). **Bitbucket is explicitly out of scope** — Bitbucket Cloud's release model is different enough (no native Releases concept; tags + downloads instead) that a clean adapter requires more design than v1 has time for.
- **Docker image versioning** (nx release has it, experimental). Out of scope for v1.
- **Long-lived `canary` channel** as a permanent snapshot workflow. v1 ships one-shot snapshots only; canary channels are a v2 follow-up.
- **Rewriting commit-driven releases**. We support conventional-commits-driven bumps as a _fallback_ (`vis release generate`), but the primary workflow is change files.
- **Breaking the public CLI surface of `vis`**. `vis release` is additive; `vis run`, `vis ci`, etc. are unchanged.
- **Replacing `pkg-pr-new` itself.** Default snapshot backend remains pkg-pr-new (free, hosted, battle-tested). The subsystem is registry-agnostic so users can point at a self-hosted backend (e.g. alchemy's `pr-package`) via config.

---

## 4. Background — what we have today

Audited in `/home/user/visulima` on `claude/add-release-management-HRxHK`:

- **49 `.releaserc.json`** files. 41 plain `extends @anolilab/semantic-release-preset/pnpm`; 4 (`task-runner`, `vis`, `tui`, `secret-scanner`) inject `scripts/semantic-release-native-addons.mjs` for NAPI publishing.
- **`@anolilab/semantic-release-preset/pnpm`** chain: commit-analyzer → release-notes-generator → changelog → clean-package-json → pnpm → git → github. Branches: `main`, `next`, `next-major`, `+([0-9])?(.{+([0-9]),x}).x`, `{name:beta,prerelease}`, `{name:alpha,prerelease}`.
- **`scripts/semantic-release-native-addons.mjs`** (214 LOC): `verifyConditions` checks OIDC vs `NPM_TOKEN`; `prepare` walks `npm/<platform>/`, rewrites version, picks dist-tag from version suffix (`-alpha.` → alpha, `-beta.` → beta, `-rc.` → next, else latest), publishes via `pnpm publish` with per-package OIDC token exchange.
- **`scripts/publish-preview-release.js`** (45 LOC): reads `CHANGED_FILES`, asks Nx for affected packages, runs `pkg-pr-new publish` for them. Comments preview links on the PR.
- **`.github/workflows/semantic-release.yml`**: triggers on push to release branches, waits for CI, downloads native artifacts from `build-native.yml`, distributes `.node` files via `napi artifacts`, builds prod, runs `multi-semantic-release --ignore-packages='packages/**/npm/**'`.
- **`.github/workflows/preview-release.yaml`**: runs on every PR, similar artifact distribution + `pkg-pr-new`.
- **`.github/workflows/build-native.yml`**: matrix builds 8 NAPI targets × 4 packages, caches by source hash.
- **`pnpm-workspace.yaml`**: 31 catalogs (`dev`, `test`, `lint`, `build`, `cli`, `prod`, etc.); `saveWorkspaceProtocol: true`; uses `workspace:*` for inter-package deps and `catalog:<name>` widely.
- **`@visulima/cerebro`** is the CLI framework. `vis` registers ~50 subcommands via `cli.addCommand(...)` with lazy loaders (`loader: () => import("./handler")`). Commands live in `packages/tooling/vis/src/commands/<name>/`.
- **NAPI packages** under `packages/tooling/{task-runner,tui,vis,secret-scanner}/npm/<platform>/` with names like `@visulima/task-runner-binding-darwin-arm64`, listed in the parent's `optionalDependencies` as `workspace:*`.

### Pain points we are solving

1. **Squash merges destroy commit scope/type** → semantic-release picks wrong (or no) bump.
2. **One PR touching N packages** → `multi-semantic-release` can only derive from one merge commit's message.
3. **`catalog:` protocol is invisible** to semantic-release; preset doesn't rewrite it on publish.
4. **Custom NAPI plugin is fragile** — peers into private semantic-release internals, bound to plugin API stability.
5. **Changelogs are commit-derived** — terse, developer-facing, not user-facing prose.
6. **Sequential publishing** through `multi-semantic-release` is slow; on a release with all 49 packages it can take 30+ minutes.
7. **No release-PR review step** — releases happen on push to a release branch with no human gate.

---

## 5. Feature comparison matrix (synthesis of the four research outputs)

| Capability                                | semantic-release                         | changesets                   | nx release                                                                 | bumpy                                                                | **vis release (this RFC)**                                                                                               |
| ----------------------------------------- | ---------------------------------------- | ---------------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Bump source                               | conventional commits                     | `.changeset/*.md`            | CC **or** `.nx/version-plans/*.md`                                         | `.bumpy/*.md`                                                        | `.bumpy/*.md` (primary) + CC (fallback via `vis release generate`)                                                       |
| Multi-pkg-per-PR                          | ✗                                        | ✓                            | ✓                                                                          | ✓                                                                    | ✓                                                                                                                        |
| User-facing changelog                     | ✗ (commit-derived)                       | ✓                            | ✓                                                                          | ✓                                                                    | ✓                                                                                                                        |
| Dep propagation                           | `--deps.bump` modes                      | `updateInternalDependencies` | `updateDependents: auto/always/never`                                      | three-phase loop, `out-of-range`/`patch`/`minor` modes + `cascadeTo` | port bumpy three-phase + add `updateDependents:never` (nx) for opt-out                                                   |
| Fixed groups                              | ✗                                        | ✓                            | ✓                                                                          | ✓                                                                    | ✓                                                                                                                        |
| Linked groups                             | ✗                                        | ✓                            | ✗ (nx uses fixed-group only)                                               | ✓                                                                    | ✓                                                                                                                        |
| `workspace:` protocol resolution          | ✗ (delegated, often broken)              | delegated to pm              | ✓ (`preserveLocalDependencyProtocols`)                                     | ✓ (`pack` or `in-place` modes)                                       | ✓ port bumpy `pack` default; rewrite at `version` time also like bumpy                                                   |
| `catalog:` protocol resolution            | ✗                                        | ✗ (PR open)                  | ✗                                                                          | ✓ (named catalogs supported)                                         | ✓ port bumpy + visulima uses 31 catalogs                                                                                 |
| Per-pkg channels (alpha/beta/next/latest) | ✓ via `branches: [...]`                  | partial via `pre enter/exit` | partial via `--preid` + `--tag`                                            | ✗ (single `--tag` per run)                                           | **borrow semantic-release `branches: [...]` config + dist-tag derivation by branch name**                                |
| Pre-release versions (`-alpha.0`)         | ✓                                        | ✓ via `pre.json`             | ✓ via `--preid`                                                            | ✗                                                                    | ✓ port from semantic-release model                                                                                       |
| Snapshot / preview                        | ✗ (custom)                               | ✓ `--snapshot [tag]`         | ✗                                                                          | ✗                                                                    | ✓ port changesets `--snapshot`; replaces `pkg-pr-new` script                                                             |
| Native addon support                      | bespoke plugin                           | ✗                            | pluggable `versionActions`                                                 | per-pkg `publishCommand`                                             | **port existing native-addons plugin into a `@visulima/vis/release/version-actions (native-addon impl)` package**        |
| OIDC trusted publishing                   | ✓                                        | ✗                            | via executor                                                               | ✓                                                                    | ✓ port bumpy + reuse existing OIDC code from `semantic-release-native-addons.mjs`                                        |
| GH Action UX                              | push-to-release-branch                   | release PR (sticky)          | `nx release` in CI                                                         | release PR (sticky)                                                  | release PR (port bumpy) — replaces current "push to alpha → publish" flow                                                |
| Programmatic API                          | yes (`semanticRelease()`)                | yes (`@changesets/*`)        | yes (`releaseVersion`/`Changelog`/`Publish`)                               | yes (`src/index.ts` exports core)                                    | yes — model on nx release shape                                                                                          |
| Lifecycle hooks                           | 9-hook plugin lifecycle                  | none (custom changelog only) | `preVersionCommand`, `groupPreVersionCommand`, `afterAllProjectsVersioned` | none                                                                 | nx-style: `preVersionCommand`, `groupPreVersionCommand`, `versionActions.afterAllVersioned`, `prePublish`, `postPublish` |
| `--printConfig`                           | ✗                                        | ✗                            | ✓                                                                          | ✗                                                                    | ✓ borrow from nx — invaluable for debugging                                                                              |
| Plugin/extension                          | rich (verifyConditions/analyzeCommits/…) | none (custom changelog)      | `versionActions` per project                                               | custom `publishCommand`/`buildCommand`/`checkPublished` per pkg      | both: `versionActions` (core) + per-pkg `publishCommand`/`checkPublished` (escape hatch)                                 |
| Custom changelog formatter                | yes                                      | yes                          | yes (renderer class)                                                       | yes (`default`/`github`/path)                                        | yes — port bumpy formatter API                                                                                           |
| Aggregated GH release                     | ✗                                        | per-pkg                      | per-pkg + workspace                                                        | ✓ optional                                                           | ✓ port bumpy `aggregateRelease`                                                                                          |
| `migrate from existing tool`              | n/a                                      | n/a                          | n/a                                                                        | from changesets                                                      | **from `.releaserc.json` + per-pkg opt-in `managed: true`**                                                              |
| Already-published detection               | ✗ (re-runs harmless)                     | ✗                            | ✗                                                                          | git tag → npm registry → custom `checkPublished`                     | port bumpy                                                                                                               |

---

## 6. Architecture

### 6.1 Layout (inside `@visulima/vis`)

The release subsystem lives at `packages/tooling/vis/src/release/` (pure logic, no cerebro imports) and `packages/tooling/vis/src/commands/release/` (cerebro CLI handlers). Tests live alongside the existing test tree.

```text
packages/tooling/vis/
├── package.json                       # vis already has bin: { "vis": ... }; we add new deps
├── src/
│   ├── bin.ts                         # adds cli.addCommand(releaseCommand) alongside other top-levels
│   ├── commands/
│   │   ├── (existing flat commands: run, ci, audit, ...)
│   │   └── release/                   # NEW: nested cerebro command group
│   │       ├── index.ts               # parent — exports the cerebro Command tree (lazy loaders)
│   │       ├── add/{handler,index}.ts
│   │       ├── generate/{handler,index}.ts
│   │       ├── status/{handler,index}.ts
│   │       ├── check/{handler,index}.ts
│   │       ├── version/{handler,index}.ts
│   │       ├── publish/{handler,index}.ts
│   │       ├── snapshot/{handler,index}.ts
│   │       ├── plan/{handler,index}.ts
│   │       ├── doctor/{handler,index}.ts
│   │       ├── init/{handler,index}.ts
│   │       └── ci/
│   │           ├── check/{handler,index}.ts
│   │           ├── plan/{handler,index}.ts
│   │           ├── release/{handler,index}.ts
│   │           ├── snapshot/{handler,index}.ts
│   │           └── setup/{handler,index}.ts
│   ├── release/                       # NEW: pure logic (no cerebro/CLI imports)
│   │   ├── index.ts                   # programmatic API re-exported via @visulima/vis/release
│   │   ├── api.ts                     # releaseVersion, releaseChangelog, releasePublish, releaseSnapshot, ReleaseClient
│   │   ├── types.ts                   # public types (VisReleaseConfig, etc.)
│   │   ├── errors.ts                  # VisReleaseError + VisReleaseErrorCode (§19.4)
│   │   ├── config.ts                  # release config block schema; merges into vis.config.ts
│   │   └── core/
│   │       ├── workspace.ts           # delegates to vis's existing package discovery
│   │       ├── dep-graph.ts           # inverted-index dependents map; topological sort
│   │       ├── change-file.ts         # parse/write/delete <changesDir>/*.md
│   │       ├── release-plan.ts        # three-phase propagation algorithm (port bumpy)
│   │       ├── apply-release-plan.ts  # versions + changelogs + range rewrite + delete change files
│   │       ├── publish-pipeline.ts    # pack/publish, OIDC, protocol+catalog resolution
│   │       ├── clean-package-json.ts  # strip/keep on publish
│   │       ├── channels.ts            # branch → channel/preid/dist-tag (semantic-release-style)
│   │       ├── catalog.ts             # parse pnpm-workspace.yaml; rewrite catalog: refs in-place
│   │       ├── changelog/
│   │       │   ├── default.ts         # bumpy default formatter
│   │       │   ├── github.ts          # bumpy github formatter
│   │       │   └── api.ts             # ChangelogFormatter type + factory
│   │       ├── package-managers/
│   │       │   ├── interface.ts       # PackageManagerAdapter
│   │       │   ├── npm.ts │ pnpm.ts │ yarn.ts │ bun.ts
│   │       │   └── detect.ts          # delegates to vis's pm-detect helper
│   │       ├── version-actions/
│   │       │   ├── interface.ts       # VersionActions abstract class (nx-style)
│   │       │   ├── npm.ts             # default for npm-published packages
│   │       │   ├── native-addon.ts    # NAPI parent + N platforms (auto-detected via `napi` field)
│   │       │   └── private.ts         # for private packages (version only, no publish)
│   │       ├── git.ts                 # tag/push/commit/diff helpers (or import from vis/git)
│   │       ├── github-release.ts      # gh CLI + REST fallback (sticky-comment-via-marker)
│   │       ├── semver.ts              # bumpVersion, satisfies, channel-aware bump
│   │       └── commit-message.ts      # template resolution
│   └── (existing src/ tree — config, plugins, util, etc. — unchanged)
├── __tests__/
│   ├── (existing tests untouched)
│   └── release/
│       ├── core/{release-plan,change-file,publish-pipeline,channels,catalog,semver,dep-graph,clean-package-json}.test.ts
│       ├── core/package-managers/{npm,pnpm,yarn,bun}.test.ts
│       ├── core/version-actions/{npm,native-addon}.test.ts
│       ├── cli/                       # CLI handler tests
│       ├── integration/               # 7 fixtures: 4 PM workspaces (npm/pnpm/yarn/bun) + 3 migration sources (semantic-release/changesets/bumpy)
│       └── fixtures/release/
├── config-schema.json                 # JSON-schema for vis.config.ts release block
└── rfc/
    └── design-release-manager.md      # this file
```

### 6.1.1 Pure-functions discipline in `src/release/core/`

`core/` modules import only from: `node:*` builtins, `semver`, `yaml`, `zeptomatch`, `conventional-commits-parser`, `@visulima/fs`, `@visulima/path`, `@visulima/colorize`, `@visulima/redact`. **No imports from `@visulima/cerebro`, no imports from `src/commands/`, no imports from `src/cli/`**. This contract makes a future extraction to `@visulima/vis-release-core` mechanical (drag the directory, add `package.json`, done).

CLI handlers in `src/commands/release/<sub>/handler.ts` are the cerebro-aware layer that calls into `release/core/`. They handle argument parsing, prompt interaction (via vis's existing `@clack/prompts` wrapper), logging through the existing logger plugin, and error formatting through the existing error-handler plugin.

### 6.1.2 New runtime dependencies added to `@visulima/vis`

After verifying current vis deps (`packages/tooling/vis/package.json`), most needs are already covered:

| Dep                           | Why                                           | Status                                     |
| ----------------------------- | --------------------------------------------- | ------------------------------------------ |
| `yaml`                        | parse change-file frontmatter                 | already a vis dep (`catalog:prod`) — reuse |
| `semver`                      | version math + range satisfaction             | already a vis dep (`^7.7.4`) — reuse       |
| `zeptomatch`                  | glob matching for `fixed`/`linked`/`ignore`   | already a vis dep (`catalog:dev`) — reuse  |
| `@visulima/redact`            | OIDC / npm-token / GH-token redaction in logs | already a vis dep — reuse                  |
| `conventional-commits-parser` | `vis release generate` CC parsing fallback    | NEW — must be added in M1                  |

**Net new runtime deps: 1** (`conventional-commits-parser`). vis already standardizes on `yaml` (not `js-yaml`) and `zeptomatch` (not `picomatch`); using the same libraries keeps the bundle from carrying duplicates.

vis already loads config via its own loader, so no new `cosmiconfig` dep. `@clack/prompts` flows in transitively through cerebro. `@visulima/colorize` already present.

**Anti-deserialization safety with `yaml`**: parse via `yaml.parse(content, { strict: true, schema: 'core' })` — equivalent guarantees to `js-yaml` `JSON_SCHEMA` (rejects executable types).

### 6.2 Sub-export from `@visulima/vis`

Programmatic API is exposed via a sub-export:

```jsonc
// packages/tooling/vis/package.json (additions only)
{
    "exports": {
        ".": "./dist/index.js",
        "./release": "./dist/release/index.js",
        "./release/types": "./dist/release/types.js",
        "./release/version-actions": "./dist/release/core/version-actions/index.js",
        "./release/changelog": "./dist/release/core/changelog/index.js",
        "./release/package-managers": "./dist/release/core/package-managers/index.js",
        // (existing exports unchanged)
    },
}
```

Consumers:

```ts
import { releaseVersion, releaseChangelog, releasePublish, releaseSnapshot, release, ReleaseClient, defineReleaseConfig } from "@visulima/vis/release";

import type { ChangelogFormatter, ChangelogContext } from "@visulima/vis/release/changelog";
import { VersionActions } from "@visulima/vis/release/version-actions";
import type { PackageManagerAdapter } from "@visulima/vis/release/package-managers";
```

The implementation behind `@visulima/vis/release/index.js` is `src/release/index.ts`:

```ts
// packages/tooling/vis/src/release/index.ts
export { releaseVersion, releaseChangelog, releasePublish, releaseSnapshot, release, ReleaseClient } from "./api";
export { defineReleaseConfig } from "./config";
export type * from "./types";
```

#### `defineConfig` already exists in vis

Verified during M1: `@visulima/vis/config` already exports `defineConfig` (line 596 of `src/config/config.ts`) — wraps `applyDefaults(config)`. Examples in this RFC use that name.

What M1 actually adds:

1. `release?: VisReleaseConfig` field on the existing `VisConfig` type (in `src/config/types.ts`).
2. `VisReleaseConfig` itself (in `src/release/types.ts`) — see §8.1 for the shape.

The result: `defineConfig({ release: {…} })` validates the new block via standard structural typing.

### 6.3 Cerebro registration (already how every vis command works)

`src/commands/release/index.ts` exports a nested cerebro `Command` with subcommands. `bin.ts` adds a single `cli.addCommand(...)` call — no different from how `audit`, `check`, `ci`, `run`, etc. are registered today:

```ts
// packages/tooling/vis/src/bin.ts (additions only)
import releaseCommand from "./commands/release";
// ... existing imports + addCommand calls ...
cli.addCommand(releaseCommand);
```

Every subcommand handler uses `loader: () => import("./<sub>/handler")` so the heavy deps (`semver`, `js-yaml`, `conventional-commits-parser`, registry HTTP clients) are only parsed when the user invokes a release subcommand. `vis run`, `vis ci`, etc. cold-start cost is unaffected.

---

## 7. CLI surface

All commands invoked as `vis release <sub>`. Handlers in `src/commands/release/<sub>/handler.ts`, business logic in `src/release/core/`.

| Subcommand                                                                                    | Purpose                                                                                       |
| --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `vis release add`                                                                             | interactive (or `--packages a:minor,b:patch`) change-file authoring                           |
| `vis release generate [--from <ref>]`                                                         | auto-derive a change file from branch commits (CC + path-based fallback)                      |
| `vis release status [--json] [--filter <glob>] [--bump major,minor]`                          | print pending plan                                                                            |
| `vis release check [--strict] [--hook pre-commit\|pre-push] [--no-fail]`                      | enforce change-file presence (for husky/lint-staged)                                          |
| `vis release version [--commit] [--channel <name>]`                                           | apply change files: write versions + changelogs + delete consumed files                       |
| `vis release publish [--dry-run] [--tag <dist-tag>] [--filter <glob>] [--no-push] [--resume]` | pack-then-publish unpublished packages, push tags, create GH releases                         |
| `vis release snapshot --tag <name> [--filter <glob>] [--registry <url>]`                      | publish `0.0.0-<tag>-<sha>` versions to a named dist-tag (default backend: `pkg-pr-new`)      |
| `vis release plan [--json]`                                                                   | alias of `status --json` (kept for symmetry with nx)                                          |
| `vis release doctor [--json]`                                                                 | preflight diagnostics — see §19.2                                                             |
| `vis release init [--from-semantic-release\|--from-changesets\|--from-bumpy\|--fresh]`        | scaffold a `release: {…}` block in `vis.config.ts`, migrate `.releaserc.json` / `.changeset/` |
| `vis release ci check`                                                                        | post/update sticky PR comment with release plan                                               |
| `vis release ci plan`                                                                         | emit JSON + `$GITHUB_OUTPUT` for workflow step gating                                         |
| `vis release ci release [--auto-publish] [--branch <name>]`                                   | maintain version-PR or run version+publish on main                                            |
| `vis release ci snapshot [--tag <name>]`                                                      | snapshot publish + sticky PR comment with install instructions                                |
| `vis release ci setup`                                                                        | interactive: walk through `VIS_GH_TOKEN` / `NPM_TOKEN` / OIDC config                          |

Inherited globals (already on every vis command): `--cwd`, `--verbose`. Added by release: `--printConfig[=debug]` (port from nx), `--dry-run`, `--resume`.

### 7.2 Change-file directory

**Default: `.vis/release/`** — nests under the `.vis/` namespace (alongside any future `.vis/cache/`, `.vis/state/`). Configurable via `release.changesDir` in `vis.config.ts`.

`vis release init` migrates existing `.changeset/` or `.bumpy/` directories by **copying** their `*.md` change files into `.vis/release/` and rewriting any `_config.json` into a `release: {…}` block in `vis.config.ts`. The source directories are left in place; the operator removes them after confirming the migration looks right.

---

## 8. Configuration

### 8.1 Single `vis.config.ts` with a `release: {…}` block

The release subsystem reuses vis's existing `loadVisConfig` loader. Adds a top-level `release` block to `vis.config.ts` (or `vis.config.js` / `vis.config.json`). `.changeset/config.json` and `.bumpy/_config.json` are read in compatibility mode (`vis release init` migrates them into the `release` block).

Per-package overrides go in `package.json["vis-release"]` (the `vis-release` key is kept on packages for clarity; the parent config block is `release` for namespace economy inside `vis.config.ts`).

```ts
import { defineConfig } from "@visulima/vis/config";

export default defineConfig({
    // ... existing vis.config.ts fields (taskDefaults, targetDefaults, extends, etc.) ...

    release: {
        // ── Workspace-wide ───────────────────────────────────────────────────
        baseBranch: "main", // override per project
        changesDir: ".vis/release", // default; configurable
        access: "public",
        changelog: "github", // "default" | "github" | "./path.ts" | [path, opts] | false
        changedFilePatterns: ["**", "!__fixtures__/**", "!**/*.test.ts"],

        // ── Channels (semantic-release-style, optional) ──────────────────────
        // Omit or set to {} for single-channel projects.
        channels: {
            main: { tag: "latest", mode: "version-pr" }, // review gate before publish
            next: { tag: "next", mode: "version-pr" },
            alpha: { tag: "alpha", mode: "auto-publish", prerelease: "alpha" },
            beta: { tag: "beta", mode: "auto-publish", prerelease: "beta" },
            "next-major": { tag: "next-major", mode: "version-pr" },
            // glob: maintenance branches
            "+([0-9])?(.{+([0-9]),x}).x": { tag: "branch-name", range: "match" },
        },

        // ── Dep propagation (port bumpy) ─────────────────────────────────────
        updateInternalDependencies: "out-of-range", // "patch" | "minor" | "out-of-range"
        dependencyBumpRules: {
            dependencies: { trigger: "patch", bumpAs: "patch" },
            peerDependencies: { trigger: "major", bumpAs: "match" },
            devDependencies: false,
            optionalDependencies: { trigger: "minor", bumpAs: "patch" },
        },

        // ── Groups ───────────────────────────────────────────────────────────
        fixed: [], // [["@visulima/cerebro", "@visulima/cerebro-plugins-*"]]
        linked: [],
        ignore: [],
        include: [],
        privatePackages: { version: false, tag: false },

        // ── Publish ──────────────────────────────────────────────────────────
        publish: {
            packManager: "auto", // detect from lockfile (npm/pnpm/yarn/bun)
            publishStrategy: "npm-publish-tarball", // "npm-publish-tarball" (recommended, cross-pm) | "native"
            publishArgs: ["--provenance"], // npm/pnpm/yarn only — bun ignores
            protocolResolution: "pack", // "pack" | "in-place" | "none"
            catalogResolution: "auto", // "auto" | "in-place" | "delegate"
            // auto → in-place if pack manager isn't pnpm
        },

        // ── Snapshot ─────────────────────────────────────────────────────────
        snapshot: {
            backend: "pkg-pr-new", // "pkg-pr-new" | "registry" | { url, auth }
            tags: ["sha", "short-sha", "branch", "pr"], // multi-tag publish (port from pr-package)
            cleanupOnPrClose: true, // borrowed from pr-package workflow
            versionTemplate: "0.0.0-{tag}-{shortSha}",
        },

        // ── GH integration ───────────────────────────────────────────────────
        aggregateRelease: false, // single GH release vs per-pkg
        gitUser: { name: "release-bot", email: "..." },
        versionPr: {
            title: "🚀 Versioned release",
            branch: "vis-release/version-packages",
            preamble: "<docs link>",
            commentMarker: "<!-- vis-release-comment -->", // sticky-comment-via-marker pattern
        },

        // ── Per-package overrides (visulima case rarely needs them — NAPI is auto-detected) ─
        packages: {
            // example: force a custom versionActions for one package
            // "@my/special-pkg": { versionActions: "./version-actions/special.ts" },
        },

        // ── Migration gate ───────────────────────────────────────────────────
        // Per-package; missing/false → still managed by multi-semantic-release
        // (or whatever existed before)
        defaultManaged: false,

        // ── Pluggable hooks ──────────────────────────────────────────────────
        preVersionCommand: "",
        postVersionCommand: "",
        prePublishCommand: "",
        postPublishCommand: "",

        // ── Trust gate for per-pkg custom commands ───────────────────────────
        allowCustomCommands: false,
    },
});
```

The `release` field on `VisConfig` (existing in vis) provides full type-safety for the new `release` block.

### 8.2 Per-package config (in `package.json`)

```jsonc
{
  "vis-release": {
    "managed": true,
    "versionActions": "native-addon",       // string id or path
    "publishCommand": "...",                // requires allowCustomCommands
    "checkPublished": "...",
    "registry": "...",
    "skipNpmPublish": false,
    "changedFilePatterns": ["src/**"],
    "dependencyBumpRules": { ... },
    "cascadeTo": { "@visulima/cerebro-*": { "trigger": "minor", "bumpAs": "patch" } }
  }
}
```

Also accepted: top-level `"bumpy"` key (read-only fallback) for migration.

---

## 9. Bump file format

`.vis/release/<slug>.md` (configurable via `release.changesDir`) — port bumpy verbatim. Two frontmatter shapes.

**Simple:**

```yaml
---
"@visulima/cerebro": minor
"@visulima/cerebro-plugins": patch
---
Add lazy command loading API. Plugins now ship via `loader: () => import(…)`.
```

**Nested with cascade:**

```yaml
---
"@visulima/error":
    bump: minor
    cascade:
        "@visulima/error-handler": patch
        "@visulima/inspector": patch
---
Body becomes the changelog entry for `@visulima/error`; cascaded packages get a "Version bump from @visulima/error@X.Y.Z" entry.
```

Levels: `major | minor | patch | none`. Empty body = recorded but no changelog entry. Inline metadata in body recognized by github formatter: `pr: 42`, `commit: abc1234`, `author: @user`.

Multiple bump files for the same package → `maxBump`. Visulima also adds: **channel hint** (`@visulima/cerebro: minor!alpha`) — see §10.

---

## 10. Channel routing (optional — semantic-release-style)

Bumpy has no per-package channel concept. We port semantic-release's channel model on top of the bump-file system. **Channels are opt-in**: a project that omits the `channels` config block runs single-channel (everything publishes to `latest`).

### 10.1 How it works

1. **`vis release version`** detects current branch via `git rev-parse --abbrev-ref HEAD`.
2. Looks up the branch in `config.channels` (supports glob patterns).
3. The channel config supplies `tag` (npm dist-tag), optional `prerelease` (preid), and `mode` (`auto-publish` or `version-pr`).
4. When `prerelease` is set, every `newVersion` is computed as `bumpVersion(oldVersion, level, preid)` — using semver's `prerelease` math: `1.2.3` + minor + alpha → `1.3.0-alpha.0`, then `-alpha.1`, etc.
5. **Channel transitions** collapse or re-counter pre-release suffixes. Concrete table (matches semantic-release's behavior):

    | From channel | Last published  | To channel                 | Result          | Notes                                                   |
    | ------------ | --------------- | -------------------------- | --------------- | ------------------------------------------------------- |
    | `main`       | `1.2.3`         | `alpha` (minor bump)       | `1.3.0-alpha.0` | new prerelease line opened                              |
    | `alpha`      | `1.3.0-alpha.5` | `alpha` (patch bump)       | `1.3.0-alpha.6` | counter increments                                      |
    | `alpha`      | `1.3.0-alpha.5` | `beta` (no new bump)       | `1.3.0-beta.0`  | re-counter against new preid                            |
    | `beta`       | `1.3.0-beta.5`  | `next` (no new bump)       | `1.3.0-rc.0`    | next channel's preid is `rc` (configurable per channel) |
    | `next`       | `1.3.0-rc.5`    | `main` (no new bump)       | `1.3.0`         | preid stripped — final release                          |
    | `alpha`      | `1.3.0-alpha.5` | `main` (no new bump)       | `1.3.0`         | direct merge — preid stripped                           |
    | `main`       | `1.2.3`         | `1.x` (maintenance, patch) | `1.2.4`         | maintenance branch range-bound                          |

    Pending change files at the merge point are **consumed at the next `vis release version`** (i.e. they accumulate; they don't auto-merge with the channel-transition step). The channel-transition logic only re-computes the preid; bump levels still come from change files.

6. **Dist-tag** is taken from `config.channels[branch].tag`. Snapshots use whatever tag the user passes to `--tag`.

### 10.1.1 Channel mode (per-channel auto-publish vs version-PR)

| `mode`           | CI behavior                                                                                                                                     |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `"auto-publish"` | `vis release ci release` runs version + publish inline on push to the branch (current visulima alpha/beta workflow).                            |
| `"version-pr"`   | `vis release ci release` opens or updates a rolling "Versioned release" PR; merging it publishes (current bumpy default; closer to changesets). |

**Auto-publish ordering** (precise sequence): write versions + changelogs → run lockfile sync → format → commit + tag locally → publish each package (topo order) → push commit + tags atomically (`git push && git push --tags`, or `git push --atomic`) → create GH releases. State file (§19.1) is written before commit and cleared after push succeeds. If publish fails mid-wave: state file persists with `applied: [...] published: [...] tagged: [...] pushed: false`; re-run with `--resume` skips already-published packages and retries the rest.

**Version-PR ordering**: same as above through "commit + tag locally", but commits go onto the version-PR branch (not the main branch) and tags are NOT created at version-time. Tags + publish + GH releases happen on the **next** push to the main branch (i.e. after the version-PR is merged), at which point the same lifecycle runs in auto-publish mode against the merged commit.

Visulima recommendation: `auto-publish` for `alpha`/`beta` (preserves today's UX), `version-pr` for `main`/`next` (adds a review gate before stable releases).

### 10.2 Per-package channel hint (optional)

Some packages need to release on a channel even from another branch (rare but real — e.g. emergency hotfix pushed to `alpha` but tagged `latest`). Syntax:

```yaml
---
"@visulima/cerebro": minor!latest # force channel "latest" regardless of branch
---
```

The `!<channel>` suffix overrides branch detection for that package only. (Open question 2: do we need this in v1, or punt to v2?)

### 10.3 Already-published version lookup

For each package, the resolver consults (in order):

1. The latest matching git tag for the channel (`<pkg>@<X.Y.Z-channel.*>`)
2. The npm registry's dist-tag for that channel
3. `package.json`'s current version

This is the same algorithm semantic-release uses for branch-aware version detection.

---

## 11. Workspace protocol & `catalog:` resolution (cross-PM)

Port bumpy's `resolveProtocolsInPlace` algorithm and extend it with explicit `catalog:` rewriting (since only pnpm rewrites it natively).

### 11.1 `vis release version` (preserves protocols)

Rewrites internal-dep ranges in `package.json` source files but **preserves the `workspace:` prefix**: `workspace:^1.0.0` → `workspace:^2.0.0`. Skips shorthands `workspace:*`, `workspace:^`, `workspace:~` (which keep their semantics). For `catalog:<name>` refs, no rewrite — catalog version updates flow through `pnpm-workspace.yaml` edits, not through this path.

### 11.2 `vis release publish` (resolves protocols)

Pre-publish, `core/publish-pipeline.ts` rewrites:

| Source              | Resolved to (in published `package.json`)                                        |
| ------------------- | -------------------------------------------------------------------------------- |
| `workspace:*`       | `^<post-bump-version>` (yarn writes `=<version>` natively — we normalize to `^`) |
| `workspace:^`       | `^<post-bump-version>`                                                           |
| `workspace:~`       | `~<post-bump-version>`                                                           |
| `workspace:^1.2.3`  | `^1.2.3` (literal)                                                               |
| `catalog:`          | resolved from default catalog in `pnpm-workspace.yaml`                           |
| `catalog:<name>`    | resolved from named catalog                                                      |
| `npm:<name>@<spec>` | passed through unchanged                                                         |

### 11.3 Cross-PM strategy

Cross-PM research (separate analysis) identified three blockers for naïve "use the active PM's pack-and-publish":

1. **Yarn (Berry/v4) does not accept tarballs in `yarn npm publish`** — it always re-packs the source workspace. To consume a pre-built tarball, must shell out to `npm publish <file.tgz>`.
2. **Bun has no `--provenance` and no OIDC** — `bun publish` with provenance fails silently.
3. **Only pnpm rewrites `catalog:`** in pack output. npm/yarn/bun produce broken tarballs (literal `"react": "catalog:"`).

Resulting rules in `core/publish-pipeline.ts`:

- **`packManager`** (default `"auto"`): pack with the project's lockfile-detected manager (`<pm> pack`).
- **`publishStrategy: "npm-publish-tarball"` (default)**: regardless of which manager packed, run `npm publish <tarball>` for the publish step. `npm publish` accepts foreign tarballs and supports OIDC + provenance. This is the LCD that survives all four ecosystems.
- **`publishStrategy: "native"`**: use `<pm> publish` directly. Pinned for users who explicitly want yarn's `yarn npm publish` (provenance only) or bun's faster path (no OIDC). Triggers compatibility warnings if config requests features the chosen pm can't do.
- **`catalogResolution: "auto"` (default)**: if the active pack manager is pnpm, leave `catalog:` to `pnpm pack`. Otherwise, **rewrite `catalog:` refs in-place** in `package.json` before invoking pack (revertible after pack via `git checkout`). Mode `"in-place"` forces our rewrite for all managers; `"delegate"` skips and trusts the pack manager (will silently break for npm/yarn/bun).
- **`protocolResolution: "pack"` (default)**: trust the pack manager for `workspace:` rewriting. Mode `"in-place"` rewrites ourselves; required for: (a) custom publish commands that bypass pack, (b) projects on bun before 1.1.36.

### 11.4 Yarn-specific quirks handled

- **`workspace:*` → `=version`**: yarn writes strict-equal. We normalize to `^version` in the published tarball by re-reading it post-pack and rewriting before `npm publish`.
- **Tarball name `package.tgz`**: we always pack with `--out '%s-%v.tgz'` to get `<name>-<version>.tgz`.
- **No tarball-publish in `yarn npm publish`**: forced to use `npm publish <tarball>` regardless of strategy.

### 11.5 Already-published detection

Per-package, in order:

1. Custom `checkPublished` shell command (per-pkg config), if `allowCustomCommands` is on.
2. Git tag presence: `<name>@<version>`.
3. npm registry query: `npm view <name>@<version> version`.

---

## 12. Native addon (NAPI) handling — `versionActions` plugin

The current `scripts/semantic-release-native-addons.mjs` is the most fragile part of today's release flow. We promote it to a first-class `versionActions` plugin.

### 12.1 The plugin contract (port from nx release)

```ts
abstract class VersionActions {
    abstract readCurrentVersion(): Promise<string>;
    abstract bumpVersion(newVersion: string, ctx: BumpContext): Promise<{ changedFiles: string[] }>;
    abstract updateDependencyVersions(deps: DepUpdate[]): Promise<{ changedFiles: string[] }>;
    abstract publish(opts: PublishOptions): Promise<PublishResult>;
}

abstract class AfterAllProjectsVersioned {
    abstract afterAllVersioned(ctx: WorkspaceContext): Promise<{ changedFiles: string[]; deletedFiles: string[] }>;
}
```

### 12.2 The `native-addon` implementation (`src/core/version-actions/native-addon.ts`)

For `task-runner`, `vis`, `tui`, `secret-scanner`:

- `bumpVersion(newVersion)`: writes parent `package.json` AND every `npm/<platform>/package.json` to `newVersion`. Updates parent's `optionalDependencies` to `<binding>: <newVersion>` (resolves `workspace:*`).
- `publish()`:
    1. Detects OIDC vs `NPM_TOKEN` (port `getGithubActionsIdToken` + `resolveAuthToken` helpers from existing script).
    2. Topo-publish: every `npm/<platform>/` first, parent last.
    3. Per-platform OIDC token exchange: `https://registry.npmjs.org/-/npm/v1/oidc/token/exchange/package/<name>` (port verbatim).
    4. Dist-tag derived from `channels[branch].tag` (NOT from version string suffix as the current script does — single source of truth).
    5. On failure during platform publishing, parent is **not** published; re-runs are idempotent because of "already published" detection.

### 12.3 Default `versionActions` per package — auto-detection

Detected automatically; no per-package config required for the common cases:

1. `package.json` has a top-level `napi` field (NAPI-RS marker) → `native-addon`. Platform packages under `npm/<platform>/` are auto-discovered and managed by the parent's plugin.
2. `package.json` has `"private": true` and no `version-actions` override → `private` (versioned but not published).
3. Else → `npm`.

Override with explicit per-package config in `vis.config.ts` `packages[<name>].versionActions = "native-addon" | "npm" | "private" | "<custom>"` or in the package's own `package.json["vis-release"]["versionActions"]`.

For visulima, the four NAPI parents (`task-runner`, `vis`, `tui`, `secret-scanner`) all have `napi` fields → no per-package config needed.

### 12.4 Platform-package exclusion from change discovery

Today's workflow uses `--ignore-packages='packages/**/npm/**'`. Equivalent in our model: platform packages (`@visulima/*-binding-*`) are auto-excluded from the workspace package list because they're managed by the parent's `versionActions`. The `discoverPackages` step looks for parents with `versionActions: native-addon` (or `napi` field in package.json) and filters their `npm/*` subdirectories out.

### 12.5 Build-native workflow stays as-is

`.github/workflows/build-native.yml` continues to produce `.node` artifacts. The `vis release publish` workflow downloads them and runs `pnpm exec napi artifacts --output-dir . --npm-dir npm` exactly as today (this step is workflow-side, not part of the release subsystem itself).

---

## 13. Snapshot / preview releases

Replaces visulima's `scripts/publish-preview-release.js`. Algorithm derived from changesets `--snapshot`; workflow ergonomics borrowed from alchemy `pr-package` (multi-tag publishes, marker-based sticky comment, PR-close cleanup) — but **not** porting pr-package itself (it's a Cloudflare Worker backend service, not a CLI).

### 13.1 Algorithm

`vis release snapshot --tag pr-1234`:

1. Resolve **affected packages**:
    - If Nx project graph is available (visulima): `nx affected --files=<changed>`.
    - Else: walk the dep graph from packages whose source files changed since `<base-ref>`.
2. For each affected package:
    - `newVersion = config.snapshot.versionTemplate` interpolated (default `0.0.0-{tag}-{shortSha}`)
3. Apply versions in a **throwaway worktree** (`git worktree add` then deleted) — never mutates the user's working tree.
4. Resolve workspace protocols + `catalog:` refs (mode: forced `"in-place"` for snapshots — the pack manager doesn't always rewrite, and the version is fake).
5. Pack via active PM, publish via `npm publish <tarball> --tag <tag> --no-git-checks`.
6. No change file consumption, no changelog write, no git tag (snapshots are ephemeral).
7. **Re-publish handling**: if the same `<sha>` was already published under the same `<tag>`, the registry rejects with `EPUBLISHCONFLICT`. The snapshot path catches this error and skips the package (treating as success — the existing tarball is what we wanted). This makes re-running on the same PR commit safe (no-op).
8. **Sortability**: `0.0.0-<tag>-<sha>` always sorts BELOW any real release (`1.2.3`) in semver. Consumers who pin `pkg@^1.2.3` won't accidentally resolve to a snapshot. Pinning `pkg@0.0.0-pr-1234-abc1234` is required for explicit consumption.

### 13.2 Multi-tag publishing (port from pr-package workflow)

Each snapshot publishes under multiple aliases simultaneously, configurable via `snapshot.tags`:

```ts
snapshot: {
  tags: ["sha", "short-sha", "branch", "pr"],
}
```

For PR #1234 on commit `abc1234567890def…`:

- `0.0.0-pr-1234-abc1234` (the `pr` tag)
- `0.0.0-abc1234-abc1234` (the `short-sha` tag)
- `0.0.0-abc1234567890def…` (the `sha` tag)
- `0.0.0-feature-foo-abc1234` (the `branch` tag)

Lets reviewers pin to whatever granularity they prefer.

### 13.3 Sticky PR comment via marker (port from pr-package workflow)

`vis release ci snapshot` posts/updates a sticky comment using a sentinel marker (default `<!-- vis-release-comment -->`):

1. `gh api repos/{owner}/{repo}/issues/{pr}/comments` → list.
2. Filter for any comment containing the marker.
3. If found → `gh api -X PATCH ...` to edit. Else → POST.
4. Comment body lists every published preview package with copy-paste install commands per package manager.

No third-party action dep; pure `gh` CLI.

### 13.4 PR-close cleanup (port from pr-package workflow)

If the configured backend supports tag deletion (self-hosted registries, or a custom backend), `vis release ci snapshot --on-close` enumerates every commit SHA in the closed PR via `gh api repos/.../pulls/N/commits`, computes the cross product with `snapshot.tags`, and issues deletes. Default behavior with `pkg-pr-new` is **no-op** (pkg-pr-new GCs automatically).

### 13.5 Backend choice

| `snapshot.backend`       | Behavior                                                                                              |
| ------------------------ | ----------------------------------------------------------------------------------------------------- |
| `"pkg-pr-new"` (default) | shell out to `pnpm dlx pkg-pr-new publish ...`; consumers install via `npm i pkg@<pkg-pr-new-url>`    |
| `"registry"`             | publish to whatever `publish.registry` is configured (a private/scoped npm registry)                  |
| `{ url, auth }`          | custom HTTP backend (e.g. self-hosted alchemy `pr-package` Worker) — POST tarball, return install URL |

Visulima keeps `"pkg-pr-new"` for v1 (lowest-risk migration from current setup).

### 13.6 Staged publishing (npm CLI ≥ 11.15.0)

npm shipped staged publishing in CLI 11.15.0 (May 2026). `npm stage publish`
runs the same auth + provenance path as `npm publish` but parks the version
in a review state that's **invisible to `npm install`** until a maintainer
runs `npm stage approve <id>` (2FA-gated) or hits "Approve" on the npmjs.com
web UI. There's no push notification — vis detects the decision by polling.

Opt in via `release.publish.stage: true` (defaults 30-min timeout, 15s poll),
or `release.publish.stage: { timeoutMs, pollIntervalMs }` to override.

**Flow:**

1. `npm pack` produces the tarball, `vis release publish` invokes
   `npm stage publish --json` and captures the returned `stageId`.
2. The publish step **blocks**, polling `npm stage view <id>` every
   `pollIntervalMs`. Heartbeats print to stderr every 5 minutes so a CI
   log tail doesn't look hung.
3. When the stage record disappears (decision made), vis disambiguates via
   `npm view <pkg>@<version> dist.tarball`: present → approved; absent →
   rejected.
4. **Approved**: pipeline continues — tags, GH release, post-hooks fire
   against the now-live version exactly as in the non-staged path.
5. **Rejected** or **timeout**: package flows through `result.skipped[]`
   with reason `stage-rejected` or `stage-timeout`. CI **stays green** —
   rejection is a normal review outcome, not a bug, and timeout is
   recoverable. Downstream side-effects (tags, GH release, post-hooks)
   skip this package because they iterate `result.published[]`.
6. GitHub Actions warnings (`::warning::`) are emitted on rejection /
   timeout so reviewers spot them in the job summary even though the
   exit code is 0.

**Why CI stays green on rejection/timeout:**

Failing the build for a reviewer's "no" or a slow weekend approver would
make every subsequent push to the channel branch start with a red commit
history. That confuses dashboards (looks like infra is broken when really
the gate worked) and trains operators to ignore the red. Better DX: emit
visible warnings, leave the package out of the published set, and let
the operator re-run `vis release publish` once the team is ready.

**Constraints** (enforced by `vis release doctor`):

- npm ≥ 11.15.0 — `npm stage` doesn't exist in older CLIs.
- Registry must be `registry.npmjs.org`. Staging is npm Inc-specific;
  private registries (Verdaccio, Artifactory, GitLab Package Registry)
  don't implement it.
- **OIDC + restricted-access packages is refused.** The post-decision
  disambiguation GET needs read auth that OIDC tokens don't provide.
  Operators publishing restricted packages must export `NPM_TOKEN`
  instead of relying on trusted publishing, or disable `publish.stage`
  for those packages. Tracked for v2.
- Approval itself requires interactive 2FA; OIDC tokens are rejected at
  `stage approve` time by design. Operators run `vis release stage
approve --all` locally with their authenticator if they need to
  promote a stage that was left pending after CI cancelled.

Snapshots always use the regular `npm publish` path; preview content
shouldn't gate on human review.

**The pending-stage registry (`.vis/release/staged.json`):**

Tracked in git (NOT gitignored) so pending stages survive CI runner
churn and branch switches. Schema lives in `release/types.ts` as
`StagedRegistryFile`. The publish flow:

1. Reads the registry on entry
2. Records rejected / timed-out stages via `upsertPendingStages`
3. Drains approved stages via `removePendingStages` (looked up by
   `(name, version)` since the npm.ts publish action clears `stageId`
   on success)
4. Writes the registry to disk
5. If the file changed, creates a `[skip ci]`-tagged commit and pushes

`[skip ci]` is recognised by GitHub Actions and GitLab CI; without it
the chore commit would re-trigger the release workflow on every
publish wave.

**The stage-pending guardrail:**

Both `vis release version` (in `applyContext`) and `vis release publish`
(in `publishContext`) call `assertNoConflictingPendingStages` before
mutating anything. The function:

- Reads `staged.json`
- Looks up conflicts by **package name only** (not name + version) —
  this catches both "re-publish would create a parallel stage" and
  "re-version would orphan the prior tarball"
- Self-heals out-of-band approvals by running `npm view <pkg>@<version>
dist.tarball` per conflict; live versions are silently drained so the
  operator doesn't need to manually edit `staged.json` after approving
  on npmjs.com
- Throws `STAGE_PENDING` if any conflict remains

**The `vis release stage` companion commands:**

- `vis release stage list [pkg]` — merges `npm stage list --json` with
  `staged.json`. Entries get a `[npm-only]` / `[registry-only, reason]`
  tag when the two sources disagree.
- `vis release stage approve <ids…>` or `--all` — wraps `npm stage
approve` per id, runs sequentially so the 2FA prompt reaches the
  operator's tty once per id. `--all` reads `.vis/release/staged.json`
  (the tracked file). On success, drains approved ids from the
  registry, commits with `chore(release): approve N stages [skip ci]`,
  and pushes.
- `vis release stage reject <ids…>` — wraps `npm stage reject`; same
  registry-update flow as approve. Permanent on the npm side.

Both approve/reject expose `--no-commit` and `--no-push` for local
triage flows where the operator wants to inspect the registry change
before committing.

**Deferred to v2:**

- OIDC + restricted-access via a registry-supplied stage-decision
  webhook (would let vis skip the read-auth GET entirely).
- Verdaccio middleware emulating `/-/stage/*` so integration tests can
  exercise the real CLI against a local registry.
- Per-package `publish.stage` opt-in (currently workspace-wide).

---

## 14. Lifecycle hooks

Port nx release's hook model (less surface than semantic-release's 9 hooks but more focused):

| Hook                                              | Where                                                                | Port from |
| ------------------------------------------------- | -------------------------------------------------------------------- | --------- |
| `preVersionCommand`                               | shell command, before any versioning                                 | nx        |
| `groupPreVersionCommand` (per fixed/linked group) | shell command                                                        | nx        |
| `versionActions.afterAllVersioned`                | TS function returning `{changedFiles, deletedFiles}` for git staging | nx        |
| `prePublishCommand`                               | shell command, after version, before publish                         | (new)     |
| `postPublishCommand`                              | shell command, after all publishes                                   | (new)     |
| Custom `versionActions` class                     | per-pkg                                                              | nx        |
| Custom `ChangelogFormatter`                       | function                                                             | bumpy     |

Hook execution order on `vis release`:

1. `preVersionCommand`
2. (per group) `groupPreVersionCommand`
3. `releasePlan` assembled
4. `apply-release-plan`: write versions + changelogs + delete change files
5. (per pkg) `versionActions.afterAllVersioned`
6. **Lockfile sync**: `PackageManagerAdapter.installLockfileOnly()` — `pnpm install --lockfile-only` / `npm install --package-lock-only` / `yarn install --mode update-lockfile` / `bun install --lockfile-only`. Resulting lockfile mutations are auto-staged (must enter the same release commit as the package.json bumps; otherwise `pnpm install` on a clean clone post-release fails).
7. Format changed files (prettier)
8. Validate tag uniqueness
9. Stage / commit / tag (config: `git.commit`, `git.tag`)
10. `prePublishCommand`
11. (per pkg, topo order) `versionActions.publish`
12. `postPublishCommand`
13. `git push --tags` (unless `--no-push`)
14. Create GH releases (per-pkg or aggregated)

---

## 15. Programmatic API (model on nx release)

```ts
import { releaseVersion, releaseChangelog, releasePublish } from "@visulima/vis/release";

const versionData = await releaseVersion({
    // optional overrides; defaults from vis.config.ts
    projects: ["@visulima/cerebro"],
    channel: "alpha",
    dryRun: false,
});

const changelogData = await releaseChangelog({
    versionData,
    interactive: false,
});

const publishResult = await releasePublish({
    versionData,
    tag: "alpha",
    otp: undefined,
});
```

Same shape as nx: `versionData` flows from version → changelog → publish so we don't re-walk the project graph 3×. Each function reads `vis.config.ts` once and merges with overrides.

`ReleaseClient` class form for inline config (no file lookup), again mirroring nx.

---

## 16. GitHub Actions integration

### 16.1 New workflows

| Workflow                                     | Purpose                                                   | Replaces               |
| -------------------------------------------- | --------------------------------------------------------- | ---------------------- |
| `.github/workflows/vis-release-check.yml`    | runs `vis release ci check` on every PR                   | (no equivalent today)  |
| `.github/workflows/vis-release.yml`          | runs `vis release ci release` on push to release branches | `semantic-release.yml` |
| `.github/workflows/vis-release-snapshot.yml` | runs `vis release ci snapshot --tag pr-<n>` on PRs        | `preview-release.yaml` |

### 16.2 Tokens & permissions

Same pattern as bumpy:

- `GH_TOKEN`: `${{ github.token }}` (default — comments + reads).
- `VIS_GH_TOKEN`: PAT or GitHub App token for force-pushing the version PR (default token's anti-recursion guard prevents follow-up workflows).
- `NPM_TOKEN`: only as fallback. OIDC primary.

Permissions:

| Workflow | Needs                                                        |
| -------- | ------------------------------------------------------------ |
| check    | `pull-requests: write`                                       |
| release  | `contents: write`, `pull-requests: write`, `id-token: write` |
| snapshot | `contents: write`, `pull-requests: write`, `id-token: write` |

### 16.3 Native artifact distribution stays workflow-side

The release workflow still:

1. Waits for `build-native.yml` to complete.
2. Downloads artifacts via `actions/download-artifact`.
3. Distributes via `pnpm exec napi artifacts --output-dir . --npm-dir npm`.
4. _Then_ calls `vis release ci release`.

The release subsystem does not orchestrate native builds — only the publish of `.node`-containing platform packages.

### 16.4 Concurrency

Release workflow uses `concurrency: { group: "vis-release", cancel-in-progress: false }` to serialize releases (port bumpy's recommendation).

---

## 17. Migration plans

The release subsystem ships with two first-class migration paths: from **semantic-release / multi-semantic-release** (visulima's case) and from **changesets** (any other monorepo). Both are exercised by `vis release init` (which detects the source tool by inspecting the repo) and both are tested against fixture monorepos in CI.

### 17.0 `vis release init` detection logic

```text
detect:
  if .changeset/ exists                       → from-changesets
  elif any */.releaserc{.json,.cjs,.js} exist → from-semantic-release
  elif .bumpy/ exists                         → from-bumpy (rename + read _config.json)
  else                                        → fresh init (interactive prompts)
```

Override with `vis release init --from-{semantic-release,changesets,bumpy,fresh}`.

### 17.1 Migration from semantic-release / multi-semantic-release

Goal: zero-downtime migration. Both systems coexist for ≥1 release cycle.

#### Per-package opt-in

`vis.config.ts` has `defaultManaged: false`. Each package must opt in via `package.json["vis-release"]["managed"]: true`. Until then, the package is owned by `multi-semantic-release` and its `.releaserc.json` continues to function.

`vis release version` skips packages with `managed: false`. `vis release publish` skips them. The `multi-semantic-release` workflow uses `--ignore-packages` to exclude `managed: true` packages.

#### What `vis release init --from-semantic-release` does

1. **Read root config** (`package.json["release"]` if present, plus root `.releaserc.json`).
2. **Detect preset chain** via `extends:` field. Common: `@anolilab/semantic-release-preset/pnpm` → infer plugin chain (commit-analyzer + release-notes-generator + changelog + git + npm + github).
3. **Map `branches` config → `channels` config**:
    ```text
    "main"                                         → channels.main = { tag: "latest" }
    { name: "alpha", prerelease: true }            → channels.alpha = { tag: "alpha", prerelease: "alpha", mode: "auto-publish" }
    { name: "beta", prerelease: true }             → channels.beta  = { tag: "beta",  prerelease: "beta",  mode: "auto-publish" }
    "next"                                         → channels.next  = { tag: "next",  mode: "auto-publish" }
    "+([0-9])?(.{+([0-9]),x}).x"                   → channels[…glob…] = { tag: "branch-name", range: "match" }
    ```
4. **Per-package overrides**: walk every `*/.releaserc.json`, capture any plugin-array overrides (e.g. `scripts/semantic-release-native-addons.mjs`) → emit a TODO comment in the generated config asking the user to confirm `versionActions: "native-addon"` (already auto-detected via `napi` field for visulima).
5. **Last-published baseline**: existing `<pkg>@<X.Y.Z>` git tags **stay valid** — `vis release publish`'s already-published detection reads them in the same format. No tag backfill needed.
6. **Existing `CHANGELOG.md`**: untouched. New entries prepended on next release. Mixed format accepted (see §17.3).
7. **Migration aids**: write a `MIGRATION.md` listing every package + suggested `managed: true` migration order (leaf packages first via dep-graph topological sort).
8. **Don't delete `.releaserc.json` files**. They stay until the package opts in to `managed: true`. **Phase 6** (after all packages migrated) is when `vis release init --remove-releaserc` walks the tree and deletes them in one PR.

### 17.2 Migration from changesets

`changesets` ships with `.changeset/*.md` files and `.changeset/config.json`. Format is similar enough to bumpy / the vis release subsystem that migration is mostly mechanical.

#### What `vis release init --from-changesets` does

1. **Read `.changeset/config.json`** → emit `vis.config.ts`. Mapping:
    ```text
    changelog                       → changelog              (path supported as-is; "@changesets/cli/changelog" → "default"; "@changesets/changelog-github" → "github")
    commit                          → versionPr.autoCommit    (boolean)
    fixed                           → fixed
    linked                          → linked
    access                          → access
    baseBranch                      → baseBranch
    updateInternalDependencies      → updateInternalDependencies (compatible: "patch"|"minor")
    ignore                          → ignore
    privatePackages                 → privatePackages
    snapshot.prereleaseTemplate     → snapshot.versionTemplate (translate placeholder syntax)
    snapshot.useCalculatedVersion   → snapshot.useCalculatedVersion
    ```
2. **Migrate `.changeset/*.md` files** to `.vis/release/*.md`. The frontmatter is **already compatible** (YAML keys = package names, values = bump levels). Copy verbatim, rename file extension preserved.
3. **Pre-release mode** (`.changeset/pre.json`): if present, **abort migration with a clear error**: "exit pre-release mode (`changeset pre exit`) and run a release before migrating". Pre-mode state is too tightly coupled to changesets internals to translate cleanly.
4. **Existing tags + CHANGELOG.md**: untouched. Same as semantic-release migration.
5. **Per-package opt-in not needed for changesets**: changesets is all-or-nothing; once you flip the workflow to `vis release ci release`, all packages move at once. (Unlike semantic-release where each `.releaserc.json` is a per-package gate.)
6. **Delete `.changeset/`**: only after the user confirms (via `vis release init --remove-changesets`).
7. **GitHub Action**: `vis release init --from-changesets --update-workflows` rewrites `.github/workflows/release.yml` from `changesets/action` → `vis release ci release`.

### 17.3 Migration phases (visulima rollout)

**Phase 0 — RFC accepted, skeleton merged into vis.** Empty `src/release/` and `src/commands/release/` directories; this RFC committed. No behavior change. `@visulima/vis` continues to release via its existing `.releaserc.json` for now (the release subsystem is shipped as part of vis but not yet activated for visulima's own packages).

**Phase 1 — Implement `release/core/` against fixtures, no production use.** Tests pass; CLI handlers work on fixture monorepos under `__tests__/release/fixtures/`. The new commands ship in the next vis alpha but are dogfood-only.

**Phase 2 — Pilot package: a non-NAPI package.** Vis itself is a NAPI parent (has a `napi` field, ships 8 platform packages under `npm/`) so it cannot self-host until the `native-addon` versionActions plugin lands in Phase 4. Pilot Phase 2 instead with a leaf, non-NAPI, well-isolated package — recommendation: **`@visulima/string`** (no inter-package deps that complicate the propagation algorithm; produces a fast feedback loop). Add `"vis-release": { "managed": true }` to the pilot, delete its `.releaserc.json`, write the first `.vis/release/*.md` change file. Catches dogfooding bugs in change-file authoring, version computation, publish-pipeline, and the mixed-format CHANGELOG flow.

**Phase 3 — Migrate non-NAPI packages in waves.** For each wave:

1. Add `"vis-release": { "managed": true }` to the wave's packages.
2. Backfill missing git tags for the wave (so "already published" detection works).
3. Add wave packages to `multi-semantic-release` `--ignore-packages` exclusion list.
4. Run a release; verify both systems coexist.

Suggested wave order: tooling (least dep'd) → terminal → error-debugging → data-manipulation → filesystem → email → api → storage → tooling/native (NAPI).

**Phase 4 — Implement `native-addon` versionActions, then migrate NAPI packages.** First, implement + battle-test `native-addon` against fixtures (NAPI parent + 8 platform packages, OIDC token exchange per platform). Then switch the four NAPI parents (`@visulima/task-runner`, `@visulima/vis`, `@visulima/tui`, `@visulima/secret-scanner`) to it — including vis itself. Remove `scripts/semantic-release-native-addons.mjs` once the four parents have shipped a successful release each.

**Phase 5 — Replace `preview-release.yaml` with snapshot.** Switch `pkg-pr-new` flow to `vis release ci snapshot`. Delete `scripts/publish-preview-release.js`.

**Phase 6 — All packages migrated. Remove `multi-semantic-release` from root `package.json`.** Remove all `.releaserc.json` files. Remove `semantic-release.yml`. Replace with `.github/workflows/vis-release.yml` calling `vis release ci release`.

**Phase 7 — Flip `release.defaultManaged: true`.** New packages auto-included. Per-package `managed: false` becomes the explicit opt-out.

### 17.4 Tag/changelog continuity

- `vis release publish` reads existing `<pkg>@<version>` tags as the "last published" signal. Works for both semantic-release and changesets migration sources (both use the same tag format).
- `apply-release-plan` **prepends** to existing `CHANGELOG.md` — does NOT regenerate or reformat history. Format is `## <version>\n<sub>date</sub>\n\n- [tag] entry…` (bumpy default).

**Insertion-point logic** (handles all three real-world starting states):

| Existing CHANGELOG state                                                                                                      | Insertion point                                         |
| ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Has `# Title` then `##` entries (bumpy / changesets convention)                                                               | After the `# Title` line, before the first `##`         |
| Starts directly with `##` entries (semantic-release / visulima convention — verified `## @visulima/string [3.0.0-alpha.11]…`) | At the very top of the file                             |
| Empty file or file does not exist                                                                                             | Create file with `# Changelog\n\n` header, then prepend |

Existing semantic-release entries (`## @visulima/cerebro [3.0.0-alpha.13](compare-link) (2026-04-30)`) and changesets entries (`## 1.2.3\n\n### Patch Changes\n\n- abc1234: …`) remain untouched below the new entries. Mixed format is intentional and accepted — the file is human-readable, the inconsistency is a one-time visual artifact at the migration boundary.

### 17.5 Branch strategy continuity

Port semantic-release's `branches` config (§10) so all 5 visulima channels work day-one. No workflow changes for contributors; releases still happen via push-to-branch (or the new release-PR flow, opt-in via `channels.<name>.mode = "version-pr"`).

---

## 18. Implementation milestones

**Distinct from §17.3's rollout phases.** §17.3 phases (P0–P7) describe **when each visulima package migrates**. §18 milestones (M1–M14) describe **what code lands in vis when**. Renamed to avoid the "Phase 4 means two different things" confusion.

| Milestone                                    | Deliverable                                                                                                                                                                                                                                    | Estimated complexity |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| **M1. RFC + skeleton**                       | This file + `package.json` adds `conventional-commits-parser` (the only net-new dep — `yaml`/`semver`/`zeptomatch`/`@visulima/redact` already present) + empty `src/release/` + empty `src/commands/release/` + `release` field on `VisConfig` | trivial              |
| **M2. Core algorithms**                      | `core/release-plan.ts` (three-phase loop), `core/dep-graph.ts`, `core/change-file.ts`, `core/semver.ts`, `core/channels.ts`, `core/catalog.ts`, `core/workspace.ts` (Nx-graph-backed where available)                                          | ~800 LOC + tests     |
| **M3. Apply + publish**                      | `core/apply-release-plan.ts`, `core/publish-pipeline.ts`, `core/clean-package-json.ts`, `core/package-managers/{npm,pnpm,yarn,bun}.ts`, `core/version-actions/{npm,private}.ts`                                                                | ~700 LOC             |
| **M4. CLI scaffold**                         | `commands/release/{add,status,check,version,publish,plan,doctor,init}/{handler,index}.ts` + cerebro registration in `bin.ts`                                                                                                                   | ~500 LOC             |
| **M5. Channels in CLI**                      | wire branch detection + channel routing + pre-release suffix into `version`/`publish` handlers                                                                                                                                                 | ~150 LOC             |
| **M6. Changelog formatters**                 | `core/changelog/{default,github,api}.ts` + author resolver                                                                                                                                                                                     | ~300 LOC             |
| **M7. Native addon plugin**                  | `core/version-actions/native-addon.ts` — port `semantic-release-native-addons.mjs` (OIDC token exchange, per-platform pack/publish)                                                                                                            | ~300 LOC             |
| **M8. Snapshot**                             | `commands/release/snapshot/handler.ts` + `commands/release/ci/snapshot/handler.ts` + Nx-affected integration + multi-tag publish                                                                                                               | ~200 LOC             |
| **M9. CI commands**                          | `commands/release/ci/{check,plan,release,setup}/handler.ts` + state file persistence + sticky-comment-via-marker                                                                                                                               | ~500 LOC             |
| **M10. Init + migration readers**            | `commands/release/init/handler.ts` + readers for `.releaserc.json`, `.changeset/config.json`, `.bumpy/_config.json`; husky prompt; per-pkg opt-in plumbing                                                                                     | ~400 LOC             |
| **M11. Programmatic API**                    | `src/release/index.ts`, `src/release/api.ts`, `ReleaseClient`, types export from `@visulima/vis/release` sub-export                                                                                                                            | ~200 LOC             |
| **M12. Docs + JSON-schema**                  | `README.md` section, `config-schema.json`, examples, migration recipes                                                                                                                                                                         | ~docs                |
| **M13. GH Actions workflows**                | `vis-release-check.yml`, `vis-release.yml`, `vis-release-snapshot.yml` — replaces `semantic-release.yml` and `preview-release.yaml`                                                                                                            | ~200 LOC YAML        |
| **M14. Pilot release of `@visulima/string`** | First non-NAPI package self-hosts (matches §17.3 Phase 2). End-to-end smoke test of M1–M13                                                                                                                                                     | trivial              |

Order can run partially in parallel (changelog formatters and CI commands have no shared code; M6/M9 can land in parallel after M2–M4 ship). M7 unblocks §17.3 Phase 4 (NAPI migration including vis itself).

Total: ~4000 LOC implementation + ~2500 LOC tests, plus visulima-specific migration work (mostly per-package config edits + workflow rewrites).

### 18.1 Phase 0 / M1 Verification tasks (do during M1)

Before writing more code, verify the tool-chain assumptions made in this RFC:

- [ ] Confirm `pnpm dlx pkg-pr-new publish ...` works without listing `pkg-pr-new` as a dep — needed for `vis release ci snapshot` default backend (§13.5).
- [ ] Confirm `pnpm pack` on a package with `catalog:` refs in `dependencies` produces a tarball with the catalog refs **resolved** (not literal `catalog:`) — required for `catalogResolution: "auto"` default to work (§11.2). Tested on pnpm 10.32.1.
- [ ] Confirm `npm publish <foreign-tarball>` with `id-token: write` works under OIDC trusted publishing for tarballs produced by `pnpm pack`/`yarn pack`/`bun pm pack` (the LCD strategy in §2 / §11.3).
- [x] ~Confirm `picomatch` is NOT already a vis dep~ — vis uses `zeptomatch` instead; reuse it.
- [x] ~Confirm `js-yaml` is NOT already a vis dep~ — vis uses `yaml` instead; reuse it.
- [x] ~Confirm `defineConfig` is NOT already exported~ — vis already exports `defineConfig` from `@visulima/vis/config` (line 596 of `src/config/config.ts`, wraps `applyDefaults`). M1 just adds `release?: VisReleaseConfig` to the `VisConfig` type. The release sub-export ships its own narrower helper named `defineReleaseConfig` (for users who put release config in a separate file).

---

## 19. Operational concerns

### 19.1 Failure modes, atomicity, recovery

Best-practice contract for a release tool — borrowed from semantic-release's `verifyConditions` discipline plus bumpy's per-package isolation:

**Pre-flight (no side effects):**

1. Auth check — OIDC env vars or `NPM_TOKEN`; `gh auth status`; `git remote get-url`.
2. Registry reachability — HEAD `https://registry.npmjs.org/-/ping` (or configured registry) per unique registry.
3. Workspace integrity — no duplicate package names, no dep cycles, all platform packages exist for `native-addon` parents, all `workspace:` refs resolve.
4. Build artifacts — `dist/` exists for every package whose `package.json` declares `files`/`exports` pointing at it.
5. Tag-collision check — proposed `<pkg>@<version>` tags don't already exist locally or on remote.
6. `vis.config.ts` valid against JSON-schema.

If any pre-flight check fails, **no version files are written**, **no tags are created**, **no network calls are made**. Exit non-zero with a typed error code (modeled on nx's `CreateNxReleaseConfigError` — see §19.4).

**Mutation phase (per-package atomicity):**

Each package's mutation is treated as a **single atomic unit**: pack → publish → tag local → record success. Failures don't roll back **already-successful** packages; `vis release publish` collects failures and exits non-zero with a summary.

**Ordering invariants:**

- Topological order (deps before dependents).
- Native-addon: platform packages publish before parent (forced by the `native-addon` versionActions implementation, not config).
- Tags created **after** publish succeeds (avoids the "tag exists but package doesn't" failure mode).
- `git push --tags` happens **once at the end**, after every package is published. Pushing per-package would emit N webhook deliveries and slows things down.

**Idempotent re-runs:**

The "already-published" detection (§11.5) makes every command safe to re-run:

1. `<pkg>@<version>` git tag exists locally → skip publish.
2. `npm view <pkg>@<version> version` returns the version → create the missing tag, skip publish.
3. Custom `checkPublished` shell command (per-pkg, gated by `allowCustomCommands`) → run it.

A failed wave can be resumed by re-running the same `vis release publish` invocation. Packages that succeeded are skipped; packages that failed are retried.

**State file:**

`<changesDir>/.state.json` (gitignored) persists in-progress release state across re-runs:

```jsonc
{
    "version": 1,
    "startedAt": "2026-05-02T10:15:00Z",
    "channel": "alpha",
    "plan": [
        /* full release plan */
    ],
    "applied": ["@scope/pkg-a@1.2.0", "@scope/pkg-b@2.0.1"], // versions written to disk
    "published": ["@scope/pkg-a@1.2.0"], // tarballs uploaded
    "tagged": ["@scope/pkg-a@1.2.0"], // local tags created
    "pushed": false, // tags pushed to remote
}
```

`vis release version --resume` and `vis release publish --resume` consult the state file. The file is deleted after `git push --tags` completes successfully. Failed runs leave it in place.

`vis release init` writes `.state.json` to `.gitignore` automatically.

**Concurrency lock:**

Three layers (defense in depth):

- **Process-level**: `<changesDir>/.lock` file with PID + timestamp; refuses to start if held by a live PID. Stale-lock detection: PID not running OR lock older than 1 hour.
- **In-flight version-PR check**: before starting `publish`, query `gh pr list --head ${versionPr.branch} --state open --json number`. If a version-PR exists, `publish` refuses with a clear error: "An open release PR exists (#NNN). Merge or close it before publishing locally." This catches the cross-machine race where a developer runs `vis release publish` locally while CI is mid-release-PR cycle.
- **CI-level**: GitHub Actions `concurrency: { group: "vis-release-${{ github.ref }}", cancel-in-progress: false }` (port from bumpy). Configurable via workflow.

**Tag-then-push-fail recovery:**

If `git push --tags` fails after publish succeeded: state file persists with `tagged: [...] pushed: false`. Re-run `vis release publish --resume` skips publish (idempotent) and retries the push.

**Half-published wave summary:**

`vis release publish` exit codes:

- `0` — every package published successfully.
- `1` — pre-flight failed (no changes made).
- `2` — partial publish (some packages published, others failed). State file persisted.
- `3` — all packages failed (auth issue, registry down).

The summary printed at the end lists every `published` / `skipped` / `failed` package with the failure reason and a copy-paste retry command for the failed subset.

### 19.2 Validation & preflight: `vis release doctor`

`vis release doctor` runs the pre-flight checks above plus deeper diagnostics, designed for "why isn't my setup working?" troubleshooting:

| Check                                                                    | Severity                                         |
| ------------------------------------------------------------------------ | ------------------------------------------------ |
| Lockfile + `packageManager` field consistency                            | warn                                             |
| All workspace globs resolve to ≥1 package                                | error                                            |
| No duplicate package names                                               | error                                            |
| No dep cycles (DFS check)                                                | warn (cycles work but cause topo-sort surprises) |
| `gh auth status` returns OK                                              | error if `gh` is required by config              |
| Registry reachable (HEAD ping per unique registry)                       | error                                            |
| OIDC env vars present (in CI only)                                       | warn                                             |
| Native-addon parents: all platform packages exist + version match        | error                                            |
| Native-addon parents: `optionalDependencies` reference platform packages | error                                            |
| Existing tags parseable as `<pkg>@<version>`                             | warn                                             |
| Existing `CHANGELOG.md` files have a recognized format                   | info                                             |
| `pnpm-workspace.yaml` catalogs match catalog refs in package.jsons       | warn                                             |
| Package manager version meets minimums (§19.6)                           | error                                            |

`vis release doctor --json` emits a machine-readable report. Exit code: 0 if no errors, 1 otherwise.

`vis release version --check-only` and `vis release publish --check-only` run the same pre-flight subset and exit without mutating.

### 19.3 Testing strategy

**Unit tests** (`__tests__/core/*.test.ts`):
Pure functions, no I/O. Covers `release-plan` (every phase + every dep-rule combo), `dep-graph` (topo sort + cycle detection), `change-file` (parse/write/validate), `semver` (channel-aware bumps + collapsing prerelease suffixes), `channels` (branch matching + dist-tag derivation), `catalog` (pnpm-workspace.yaml parse + ref resolution).

**Integration tests** (`__tests__/release/integration/*.test.ts`):
Run the actual CLI against fixture monorepos. **4 PM fixtures** (npm/pnpm/yarn/bun) covering pack + publish + workspace-protocol resolution; **3 migration-source fixtures** (semantic-release / changesets / bumpy) on pnpm only — migration logic is PM-agnostic so cross-product is wasteful. Total **7 fixtures** under `__tests__/release/fixtures/`. Each fixture has `package.json`, lockfile, ≥3 packages with cross-deps, ≥2 change files, 1 prior CHANGELOG.

**Mock npm registry**: [verdaccio](https://verdaccio.org/) (the de facto standard for testing npm publishing). A vitest setup hook starts verdaccio on `http://localhost:4873`; tests pass `--registry http://localhost:4873`. Verdaccio is read after publish to assert on tarball contents (extract the published `package.json`, verify `workspace:`/`catalog:` rewriting).

**Mock GitHub API**: [MSW](https://mswjs.io) intercepts at the HTTP level. `gh api` calls are routed through `core/shell.ts`'s `_setInterceptor()` (port from bumpy) so we can assert on PR-comment payloads, release-create requests, etc.

**Snapshot tests**: Vitest snapshots for changelog renderer output (default + github formatters), PR-comment markdown, version-PR body, and `vis release status --json` output. Locked schema for `--json` outputs (CI consumers must not break).

**E2E tests** (`__tests__/e2e/*.test.ts`):
Spawn `vis release` as a child process against a fresh fixture (cloned via `git init`), run a full version → publish → snapshot cycle, verify final state on disk + verdaccio + the mock GH API.

**Coverage target**: 80% for `core/`, 60% for `cli/` (CLI shells are mostly arg-parsing). Tracked via `vitest --coverage`.

### 19.4 Security model

> Implementation status as of v1: every gate listed below ships with the
> subsystem and has dedicated unit tests in `__tests__/release/core/`.

**YAML safe-load:** ✅ shipped (`core/change-file.ts`)
Change files are parsed via vis's existing `yaml` dep: `yaml.parse(content, { strict: true, schema: 'core' })`. The `core` schema rejects executable types (`!!js/function`, `!!js/regexp`, etc.) — only allows scalar/sequence/mapping nodes. Equivalent guarantees to `js-yaml`'s `JSON_SCHEMA`.

**Package name validation:** ✅ shipped (`core/security.ts:isValidPackageName`, asserted at `core/workspace.ts:discoverPackages`)
Regex `^(@[a-z0-9-]{1,39}\/)?[a-z0-9._-]{1,214}$`, max total length 214, no leading hyphen/dot/underscore (npm-compliant). Reject control chars, HTML metachars, shell metachars, path separators outside scopes. Validation runs at the discovery boundary so every downstream consumer can trust `pkg.name` is shell-safe.

**Workspace path containment:** ✅ shipped

- `discoverPackages` rejects any `manifestPath` that resolves outside `cwd` — defends against a buggy PM adapter writing under `/etc`.
- `readChangeFiles` rejects any `changesDir` that resolves outside `cwd` — defends against a malicious `release.changesDir: "../../etc"` exfiltrating files.

**Markdown escaping in PR comments:** ✅ shipped (`core/security.ts:escapeMarkdown`)
User-supplied text (change-file body warnings, package descriptions) is escaped before embedding in PR-comment markdown: a backtick is replaced by its escaped form, `<` becomes `&lt;`, `>` becomes `&gt;`, and `&` becomes `&amp;`. Defense-in-depth: package names are also locked down via the regex above so backtick-wrapped name templates can't break out of inline-code spans.

**Shell injection:** ✅ shipped (`core/security.ts:sq`/`interpolateCommand`)
Port of bumpy's `sq()` quoter (POSIX `'…'` quoting with single-quote escape via `'\''`). Custom commands (`publishCommand`, `buildCommand`, `checkPublished`) ALWAYS run user-supplied tokens (`{{name}}`, `{{version}}`) through `sq()` before substitution. No raw concatenation. No `eval`. Native-addon publish uses `execFileSync` argv form (not `execSync` + string-concat) so even validated names get a second trust gate.

**Custom-command trust gate:** ✅ shipped (`core/security.ts:isCustomCommandAllowed`/`resolveCustomCommands`)

- Root `vis.config.ts`'s commands are trusted (the maintainer wrote them).
- Per-package `package.json["vis-release"]["publishCommand"]` requires `allowCustomCommands` to be truthy. Reasoning: in version-PR flows the bot runs publish, and a malicious PR could add a per-package custom command. Match bumpy's gate exactly.
- `allowCustomCommands` accepts `boolean | string[]`. Array form is a glob allowlist of package names.

**OIDC token redaction in logs:** ✅ shipped (`core/security.ts:redactTokens`, wired into `core/shell-runner.ts`)
The shared shell runner pipes every captured stdout/stderr (and caught error message) through a redaction regex that masks: `Bearer [^\s"']+` (HTTP), `npm_[A-Za-z0-9]+` (npm tokens), `ghp_/gho_/ghs_/ghu_[A-Za-z0-9]+` (GitHub tokens), `glpat-[A-Za-z0-9_-]+` (GitLab personal access tokens), `ACTIONS_ID_TOKEN_REQUEST_TOKEN=...` (GH Actions OIDC), `_authToken=...` (npmrc). Applied in **every** mode including `--verbose` and `--debug`. Inherited stdio (non-silent runs) bypasses redaction by design — auth-touching commands always run silently. Tests assert that a known token literal never appears in stdout/stderr capture.

**OIDC token-bearing temp dir hygiene:** ✅ shipped (`core/version-actions/native-addon.ts`)
Every `mkdtempSync(.../vis-release-napi-*)` is tracked in a per-call list and `rm -rf`'d in a `finally` block, even when `npm publish` throws mid-flight. Critical on shared-runner CI where `/tmp` is multi-tenant.

**Concurrency lock:** ✅ shipped (`core/state.ts:acquireLock`)
Uses `O_EXCL | O_CREAT` for atomic lock-file creation. Two processes racing the lock cannot both win: one sees `EEXIST`, inspects the existing lock for staleness (dead PID / >1h old), and either takes over (single retry) or refuses with `STATE_FILE_CORRUPT`.

**`gh api` request bodies:** ✅ shipped
By default log only status code + URL. **On `--debug`** (not `--verbose`), log the body too — needed when debugging changelog/release-notes rendering. Two-tier verbosity matches the rest of vis. Redaction above applies to debug-logged bodies.

**`--printConfig` PII scrubbing:** ✅ shipped (`core/print-config.ts`)
The configured `gitUser.email` is replaced with `[REDACTED]` in `--printConfig` output to avoid leaking PII when CI logs are captured/shared. Name is preserved (it's published in commit metadata anyway).

**Typed error codes:**
Port nx's `CreateNxReleaseConfigError` shape. Single union type `VisReleaseError` with codes:

```ts
type VisReleaseErrorCode =
    | "AUTH_MISSING"
    | "DUPLICATE_PACKAGE_NAME"
    | "CYCLIC_DEPENDENCY"
    | "TAG_COLLISION"
    | "BUMP_FILE_INVALID"
    | "CONFIG_INVALID"
    | "PM_VERSION_TOO_LOW"
    | "NATIVE_ADDON_VERSION_MISMATCH"
    | "PUBLISH_FAILED"
    | "TAG_PUSH_FAILED"
    | "STATE_FILE_CORRUPT";
```

> Codes are added as needed. Previously-listed but never-thrown codes
> (`AUTH_INVALID`, `REGISTRY_UNREACHABLE`, `WORKSPACE_REF_UNRESOLVED`,
> `CHANNEL_BRANCH_MISMATCH`, `PRERELEASE_DOWNGRADE`, `CUSTOM_COMMAND_NOT_ALLOWED`,
> `NATIVE_ADDON_PLATFORM_MISSING`, `VERSION_PR_OPEN`, `PRE_RELEASE_MODE_DETECTED`)
> were dropped to keep the public surface honest. Reintroduce them when the
> matching check actually throws.

Each error carries `{ code, message, hint, docsUrl?, packageName?, file?, line? }`.

### 19.5 Conventional commits + commitlint integration

**`vis release generate` parser:**
Uses [`conventional-commits-parser`](https://www.npmjs.com/package/conventional-commits-parser) with the `conventionalcommits` preset by default. Configurable via `config.commitParser.preset` (`angular`, `conventionalcommits`, `eslint`, custom). Mapping rules (`feat → minor`, `fix/perf → patch`, `BREAKING CHANGE/!` → `major`) live in `config.commitParser.bumpMap` and default to bumpy's `BUMP_MAP`.

If the project has a `commitlint.config.{js,cjs,mjs}` at root, `vis release generate` reads it via `cosmiconfig` and uses the same preset to stay consistent. Pure best-effort — no error if commitlint is missing.

**Version-PR / release commit message — commitlint compliance:**

Visulima's commitlint extends `@anolilab/commitlint-config`, which enforces conventional commits (`type(scope): subject`). The default release commit MUST pass commitlint, otherwise the husky `commit-msg` hook will reject it.

**Default `versionCommitMessage`** (overrideable):

```text
release(${channel}): ${plan.summary} [skip ci]

${plan.details}
```

Where:

- `${channel}` is the active channel name (`alpha`, `beta`, `next`, `main`, ...) → satisfies the `(scope)` requirement.
- `${plan.summary}` is `"version 12 packages"` or `"@visulima/cerebro 1.2.3, @visulima/cerebro-plugins 0.4.1"` if ≤3 packages.
- `${plan.details}` is the per-package list.
- `[skip ci]` prevents recursive triggering.

This format passes commitlint (visulima already has `release` in the allowed type list per `CLAUDE.md`'s commit convention section).

**Per-package release commit (current visulima format):** preserved when `aggregateRelease: false` and `oneCommitPerPackage: true` (new option); message template `release(${channel}): ${pkg}@${version} [skip ci]\n\n${notes}`.

**Version-PR commit message vs final release commit message:** the same `versionCommitMessage` template is used in both contexts. In `mode: "version-pr"`, the message lands on the version-PR branch first (force-pushed on each iteration) and then carries through unchanged when the PR is merged. In `mode: "auto-publish"`, the message lands directly on the release branch. Override both with one config key.

**`vis release init` validation:** if it detects a commitlint config without `release` in the allowed types, prints a warning with the snippet to add.

### 19.6 Package manager minimum versions

Hard requirements:

| Manager      | Minimum                     | Why                                                                              |
| ------------ | --------------------------- | -------------------------------------------------------------------------------- |
| npm          | **11.5.1**                  | OIDC trusted publishing GA                                                       |
| pnpm         | **9.5**                     | catalog protocol                                                                 |
| pnpm         | **10.0** (recommended)      | catalog refinements + native publish                                             |
| yarn (Berry) | **4.0**                     | only Berry; v1/Classic unsupported                                               |
| bun          | **1.1.36**                  | workspace publish + protocol rewriting                                           |
| node         | **22.14.0** ‖ **>=24.10.0** | matches visulima's `engines`                                                     |
| git          | **2.31**                    | sane `git for-each-ref` output for tag enumeration                               |
| gh CLI       | **2.40**                    | required when `gh` is invoked (release create + PR comments); otherwise optional |

Detected at startup via `<pm> --version`. Hard-fail with `PM_VERSION_TOO_LOW` if below minimum. Warn (not fail) if below recommended.

`bunfig.toml` / `.npmrc` / `.yarnrc.yml` are read passthrough — never modified by the release subsystem (avoid clobbering user auth/config).

### 19.7 Dry-run output spec

Every command accepts `--dry-run`. Behavior:

| Phase          | Live behavior                      | Dry-run behavior                                   |
| -------------- | ---------------------------------- | -------------------------------------------------- |
| File writes    | write to disk                      | write to in-memory `FsTree`; print unified diff    |
| Git commit/tag | execute                            | print command + flags                              |
| Git push       | execute                            | print command + flags                              |
| `npm publish`  | execute                            | print command + tarball name + dist-tag + registry |
| `gh api`       | execute                            | print method + URL + redacted body summary         |
| State file     | persist                            | persist in-memory only                             |
| Exit code      | 0 on success / non-zero on failure | always 0 unless pre-flight fails                   |

Dry-run output is prefixed with `[dry-run]` on every line for `grep`-ability. Trailer: `Dry run complete. No changes made.`

---

## 20. Visulima-specific integration points

Items from the audit that need explicit handling:

### 20.1 `postinstall` → `generate:release-artifacts`

Visulima's root `postinstall` script runs `pnpm run generate:release-artifacts` (OG images, packages list, labeler). Released versions affect what those scripts emit (e.g. the website's package list shows current versions).

**Strategy**: project-level concern, not the release subsystem's. Wire via `postVersionCommand`:

```ts
defineConfig({
    postVersionCommand: "pnpm run generate:release-artifacts",
    // ...
});
```

Output files (`.github/labeler.yml`, `apps/web/src/data/packages.ts`, `__assets__/*.png`) are auto-staged by `versionActions.afterAllVersioned` so they enter the same release commit.

### 20.2 `apps/web/src/data/packages-metadata.json` + `generate-packages.js`

The website's package list (`apps/web/scripts/generate-packages.js`) reads `package.json` versions + `project.json` tags. Same answer as 20.1 — wired through `postVersionCommand`.

### 20.3 `secretlint` on change files

Husky `pre-commit` runs `secretlint` (via `lint-staged`) on every staged file. Change files under `.vis/release/*.md` are user-authored — they shouldn't contain secrets, but author-handle patterns like `@danielbannert` can false-positive on some secretlint rules.

**Mitigation**: `vis release init` writes `.secretlintignore` adding `.vis/release/**` (or appends if the file exists). Documented as a known issue with the recommended fix.

### 20.4 `clean-package-json` — published-package strip list

Today's preset uses `@anolilab/semantic-release-clean-package-json`. The new tool ships `core/clean-package-json.ts` with the equivalent default behavior:

**Stripped on publish** (in the resolved tarball, never on disk):

- `scripts` (don't ship build/dev scripts)
- `devDependencies`
- `private` (false meta — published packages aren't private)
- `workspaces` (resolved tarballs don't need workspace globs)
- Tool config blocks: `vis-release`, `bumpy`, `release`, `nx`, `lint-staged`, `husky`, `commitlint`, `eslint`, `prettier`, `vitest`, `tsup`, `packem`, `tsdown`, `@visulima/packem`, `pnpm`

**Preserved**:

- `name`, `version`, `description`, `keywords`, `homepage`, `bugs`, `repository`, `funding`, `author`, `contributors`, `license`
- `dependencies`, `peerDependencies`, `peerDependenciesMeta`, `optionalDependencies` (after protocol/catalog resolution)
- `engines`, `os`, `cpu`
- `type`, `sideEffects`, `main`, `module`, `types`, `typings`, `exports`, `imports`, `bin`, `files`
- `publishConfig`, `napi`

Configurable per project:

```ts
publish: {
  cleanPackageJson: { strip: [...], keep: [...] } | false;
}
```

`strip` extends defaults; `keep` removes from defaults. `false` ships the unmodified `package.json`.

### 20.5 `lint-staged` integration

`vis release init --update-lint-staged` adds entries:

```jsonc
{
    ".vis/release/*.md": ["vis release check --hook pre-commit --no-fail"],
    "package.json": ["vis release validate-package-json"],
}
```

Optional — opt-in via flag. Documented as the recommended setup.

### 20.6 Existing `commitlint` and `release` type allowance

`@anolilab/commitlint-config` includes `release` in its allowed types per visulima's `CLAUDE.md` ("Types: `feat`, `fix`, `perf`, `docs`, `dx`, `refactor`, `test`, `workflow`, `build`, `ci`, `chore`, `types`, `wip`, `release`, `deps`, `revert`."). Default `versionCommitMessage` (§19.5) is compliant out of the box. No config changes needed.

### 20.7 Native artifact distribution stays workflow-side

`.github/workflows/build-native.yml` continues to build NAPI `.node` artifacts; the release workflow downloads them via `actions/download-artifact` and runs `pnpm exec napi artifacts --output-dir . --npm-dir npm` **before** invoking `vis release ci release`. The `native-addon` versionActions plugin operates on already-distributed `.node` files — it does not invoke `napi build`.

### 20.8 Dependency on existing `pkg-pr-new`

Visulima already has `pkg-pr-new` working via `scripts/publish-preview-release.js`. The `vis release ci snapshot` command preserves this:

- Default backend: `pkg-pr-new`
- Default behavior: identical PR comment to today's
- Migration: replace `scripts/publish-preview-release.js` invocation in `.github/workflows/preview-release.yaml` with `vis release ci snapshot --tag pr-${PR_NUMBER}`. Drop-in.

---

## 21. Public API stability & versioning policy

### 21.1 SemVer commitments at v1.0

Stable (breaking changes require a major version bump):

The release subsystem versions with `@visulima/vis`. Breaking changes follow vis's own SemVer policy — a vis major release may break the release subsystem's public API.

**Stable surface** (changes require a vis major):

- Sub-export entry points: `@visulima/vis/release`, `@visulima/vis/release/types`, `@visulima/vis/release/version-actions`, `@visulima/vis/release/changelog`, `@visulima/vis/release/package-managers`
- Function signatures: `releaseVersion()`, `releaseChangelog()`, `releasePublish()`, `releaseSnapshot()`, `release()`
- `defineReleaseConfig()` shape (the `VisReleaseConfig` type — the schema of the `release: {…}` block in `vis.config.ts`)
- `VersionActions` abstract class methods (`readCurrentVersion`, `bumpVersion`, `updateDependencyVersions`, `publish`, `afterAllVersioned`)
- `ChangelogFormatter` type and `ChangelogContext` shape
- `PackageManagerAdapter` interface (`pack`, `publish`, `install`, `listWorkspacePackages`, `resolveCatalog`)
- CLI subcommand names (`add`, `version`, `publish`, `snapshot`, `status`, `check`, `plan`, `doctor`, `init`, `ci check|plan|release|snapshot|setup`)
- Stable CLI flags (every flag documented in `--help`)
- The `--json` output schema for `status`, `plan`, `ci plan`, `doctor`
- Typed `VisReleaseErrorCode` union (additions are minor; removals are major)
- Change-file frontmatter syntax (both simple and nested forms)
- `<changesDir>/.state.json` schema (additions are minor)

**Unstable** (changes allowed in vis minor/patch):

- Internal `src/release/core/*` modules not re-exported from `src/release/index.ts`
- Default values (e.g. default `commentMarker` text, default version templates)
- Error message wording (only the `code` is stable)
- Log line formatting in human mode (JSON mode is stable)
- Bundled formatter implementations (`changelog/default.ts`, `changelog/github.ts`) — but the public formatter API is stable

### 21.2 Pre-1.0 maturity gate

The release subsystem is **flagged unstable** (printed warning on first invocation, suppressible via `release.acknowledgeUnstable: true` in `vis.config.ts`) until: (a) public API survives ≥3 months without breaking changes, (b) all visulima packages migrated through Phase 6 of §17, (c) ≥1 external project (outside visulima) reports successful adoption. Once the gate clears, the unstable warning is removed in the next vis minor release.

### 21.3 Bootstrap

Detailed in §17.3 (Phase 0 → Phase 7). Summary:

- Phase 0–1: code lands in vis but visulima releases continue via existing `multi-semantic-release`.
- Phase 2: vis itself adopts `release.managed: true` — first dogfood.
- Phase 3+: visulima packages migrate in waves; both systems coexist.
- Phase 6: legacy `.releaserc.json` files + `multi-semantic-release` removed.

---

## 22. Open questions

### Resolved (answered in conversation)

- ✅ **Change-file directory**: `.vis/release/` (configurable via `config.changesDir`).
- ✅ **Cross-PM support**: required — npm, pnpm, yarn, bun all first-class.
- ✅ **alchemy `pr-package`**: don't port (it's a server, not a tool); borrow only the multi-tag + sticky-comment + PR-close cleanup ideas, all baked into `core/github-release.ts` and the snapshot subcommand.
- ✅ **Channel mode**: configurable per channel (`auto-publish` vs `version-pr`); recommended split: alpha/beta auto-publish, main/next version-PR.
- ✅ **CHANGELOG format on migration**: mixed — prepend new bumpy-style entries on top of existing semantic-release/changesets entries, never reformat.
- ✅ **Delivery surface**: **fully integrated into `@visulima/vis`**. No separate package, no standalone bin. Users invoke `vis release …`. Programmatic API exposed via `@visulima/vis/release` sub-export. `core/` modules are pure-functions to enable a future mechanical extraction if external demand emerges (§1, §6).
- ✅ **`publishStrategy` default**: `"npm-publish-tarball"` (cross-pm safe).
- ✅ **NAPI auto-detection**: automatic via `napi` field in `package.json`. No per-package config needed for the common case.
- ✅ **Aggregated GH release**: default `false` (per-package); config switch to `true` for projects that want it. Visulima recommended to flip post-Phase-6.
- ✅ **Migration coverage**: both `semantic-release` AND `changesets` first-class via `vis release init --from-{semantic-release,changesets}`. Detection auto by filesystem inspection. See §17.0–§17.2.
- ✅ **Existing `.releaserc.json` files**: leave in place during per-package transition (Phase 3); `vis release init --remove-releaserc` deletes them in Phase 6.
- ✅ **Failure / recovery / atomicity**: pre-flight + per-package atomicity + state file + idempotent re-runs (§19.1).
- ✅ **`vis release doctor`**: ship it (§19.2).
- ✅ **Testing strategy**: 8 fixture monorepos + verdaccio + MSW + snapshot tests (§19.3).
- ✅ **Security model**: YAML safe-load + name validation + markdown escape + shell quote + token redaction (§19.4).
- ✅ **Conventional commits + commitlint integration**: default `release(${channel}): …` template; passes commitlint; reads project's commitlint preset for `vis release generate` (§19.5).
- ✅ **Package manager minimum versions**: hard-coded with version checks at startup (§19.6).
- ✅ **`clean-package-json`**: ship `core/clean-package-json.ts` with default strip/keep lists matching `@anolilab/semantic-release-clean-package-json` (§20.4).

### Still open (low-stakes, can defer to v1.x)

1. **Per-package channel hint syntax** (`@pkg: minor!alpha` in change-file frontmatter for emergency cross-channel publishes): ship in v1 or punt to v2?
2. **`catalog:` rewriting tightening**: should `catalogResolution: "in-place"` (force rewrite even when pack manager is pnpm) be exposed, or only `"auto"` and `"delegate"`?
3. **Token name**: `VIS_GH_TOKEN` (namespaced under vis) or `RELEASE_GH_TOKEN` (generic — same env var works if `core/` is later extracted)? Recommend support both, document `VIS_GH_TOKEN` as canonical.
4. **Author attribution exclusion list** (`internalAuthors: []` to suppress "Thanks @user!" for team members): adopt bumpy's config as-is?
5. **Husky integration in `vis release init`**: when `init` detects an existing `.husky/` directory, **prompt** the user before modifying anything: `Wire 'vis release check' into your pre-commit hook? [Y/n]`. If yes, append the snippet to `.husky/pre-commit`; if no, print the snippet for manual wiring. `--yes` flag skips the prompt and auto-wires; `--no-husky` flag skips entirely. Default behavior in non-interactive (CI) contexts: print snippet only, never modify.

---

## 23. References

### Reference designs (deeply analyzed during this RFC)

- Bumpy (primary port): <https://github.com/dmno-dev/bumpy>
- Bumpy docs: `docs/cli.md`, `docs/configuration.md`, `docs/version-propagation.md`, `docs/github-actions.md`
- nx release: <https://github.com/nrwl/nx/tree/master/packages/nx/src/command-line/release>
- nx release docs: <https://nx.dev/docs/features/manage-releases>
- semantic-release: <https://github.com/semantic-release/semantic-release>
- semantic-release plugins doc: <https://github.com/semantic-release/semantic-release/blob/master/docs/usage/plugins.md>
- changesets: <https://github.com/changesets/changesets>
- changesets docs: `docs/detailed-explanation.md`, `docs/command-line-options.md`, `docs/config-file-options.md`

### Snapshot/preview backends evaluated

- pkg-pr-new (kept as default): <https://github.com/stackblitz-labs/pkg.pr.new>
- alchemy `pr-package` (server-side, not ported; ideas borrowed from workflow only): <https://github.com/alchemy-run/alchemy-effect/tree/main/packages/pr-package>
- verdaccio (test registry): <https://verdaccio.org>

### Cross-PM references

- npm CLI source: <https://github.com/npm/cli> (`lib/commands/{pack,publish}.js`, `lib/utils/oidc.js`)
- pnpm catalogs: <https://pnpm.io/catalogs>
- yarn pack: <https://yarnpkg.com/cli/pack>
- yarn publish: <https://yarnpkg.com/cli/npm/publish>
- bun publish: `bun publish --help`
- npm Trusted Publishers (OIDC): <https://docs.npmjs.com/trusted-publishers/>

### Tooling

- conventional-commits-parser: <https://www.npmjs.com/package/conventional-commits-parser>
- cosmiconfig: <https://github.com/cosmiconfig/cosmiconfig>
- MSW: <https://mswjs.io>

### Existing visulima release machinery (audit findings)

- `/scripts/semantic-release-native-addons.mjs` (NAPI plugin to be ported into `version-actions/native-addon`)
- `/scripts/publish-preview-release.js` (replaced by `vis release ci snapshot`)
- `@anolilab/semantic-release-preset/pnpm` chain (replaced by `vis release` lifecycle)
- 49 `.releaserc.json` files (removed in Phase 6 of §17)
- `.github/workflows/{semantic-release.yml,preview-release.yaml,build-native.yml}` (rewritten/extended in §16)
