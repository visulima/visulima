# `vis release` — monorepo release subsystem

Built-in release management for `@visulima/vis`. Replaces `multi-semantic-release` / `semantic-release` / `changesets` / `bumpy` with a unified workflow that handles versioning, changelog generation, dependency propagation, and publishing.

> **⚠ Status — unstable**
> The release subsystem is part of `vis` itself, but its public API is flagged unstable until: (a) it survives ≥3 months without breaking changes, (b) all visulima packages migrate via `release.managed: true`, (c) ≥1 external project adopts it. Suppress the startup warning via `release: { acknowledgeUnstable: true }` in `vis.config.ts`.

## Quick start

```bash
# Scaffold + auto-detect existing release tooling
vis release init

# Add a change file describing what's changing in this PR
vis release add --packages '@scope/cerebro:minor' --message 'Add tab completion'

# Preview the plan
vis release status

# Apply: bump versions, prepend changelogs, sync lockfile
vis release version --commit

# Publish (after merging the version PR or on the auto-publish branch)
vis release publish
```

## How it works

Contributors drop YAML-frontmatter Markdown files in `.vis/release/`, one per logical change:

```markdown
---
"@scope/cerebro": minor
"@scope/cerebro-plugins": patch
---

Add lazy command loading API. Plugins now ship via `loader: () => import(…)`.
```

When CI runs (or you invoke locally), `vis release` reads every change file, walks the dependency graph, computes which packages bump and to what version, writes new versions + prepended `CHANGELOG.md` entries, and (optionally) commits + tags + publishes.

## Config

Add a `release` block to your `vis.config.ts`:

```ts
import { defineConfig } from "@visulima/vis/config";

export default defineConfig({
    // … existing vis config …
    release: {
        baseBranch: "main",
        defaultManaged: true,
        channels: {
            main: { tag: "latest", mode: "version-pr" },
            next: { tag: "next", mode: "version-pr" },
            alpha: { tag: "alpha", mode: "auto-publish", prerelease: "alpha" },
            beta: { tag: "beta", mode: "auto-publish", prerelease: "beta" },
            "+([0-9])?(.{+([0-9]),x}).x": { tag: "branch-name", range: "match" },
        },
        publish: {
            packManager: "auto",
            publishStrategy: "npm-publish-tarball",
            publishArgs: ["--provenance"],
            cleanPackageJson: true,
        },
        gitUser: { name: "release-bot", email: "release@example.com" },
    },
});
```

JSON schema: `@visulima/vis/schemas/vis-release-config.schema.json`.

## Channels (semantic-release-style)

The `channels` block maps git branches → npm dist-tags + optional prerelease IDs. Per-channel `mode` controls CI behaviour:

- `auto-publish` — push triggers version + publish inline (good for `alpha` / `beta`)
- `version-pr` — push opens/updates a rolling release PR; merging publishes (good for `main` / `next`)

## Channel transitions

Versions collapse / re-counter as you move across channels:

| From                    | Last      | To      | Result                                   |
| ----------------------- | --------- | ------- | ---------------------------------------- |
| `main` (1.2.3)          | + minor   | `alpha` | `1.3.0-alpha.0` (open prerelease line)   |
| `alpha` (1.3.0-alpha.5) | + patch   | `alpha` | `1.3.0-alpha.6` (counter increments)     |
| `alpha` (1.3.0-alpha.5) | (no bump) | `beta`  | `1.3.0-beta.0` (re-counter on new preid) |
| `beta` (1.3.0-beta.5)   | (no bump) | `main`  | `1.3.0` (preid stripped — final)         |

## Cross-PM publishing

Detected from lockfile + `packageManager` field:

| Manager         | Pack                          | Lockfile sync                         | Publish                       |
| --------------- | ----------------------------- | ------------------------------------- | ----------------------------- |
| npm ≥11.5.1     | `npm pack --json`             | `npm install --package-lock-only`     | `npm publish <tarball>`       |
| pnpm ≥9.5       | `pnpm pack --json`            | `pnpm install --lockfile-only`        | `npm publish <tarball>` (LCD) |
| yarn (Berry/v4) | `yarn pack --out '%s-%v.tgz'` | `yarn install --mode update-lockfile` | `npm publish <tarball>` (LCD) |
| bun ≥1.1.36     | `bun pm pack`                 | `bun install --lockfile-only`         | `npm publish <tarball>` (LCD) |

Why always `npm publish`? Yarn refuses to publish pre-built tarballs in `yarn npm publish`; bun lacks OIDC and `--provenance`. The npm CLI is the lowest-common-denominator that works with foreign tarballs and supports trusted publishing.

## Workspace + catalog: protocol resolution

`workspace:^1.0.0`, `workspace:~1.0.0`, `workspace:*`, `workspace:^`, `workspace:~`, and `catalog:`/`catalog:<name>` refs are resolved at publish time. Default: trust pnpm's pack to do `workspace:`/`catalog:` rewriting; for npm/yarn/bun, rewrite in-place before pack (since only `pnpm pack` understands `catalog:`).

## NAPI native-addon publishing

Auto-detected via the `napi` field in `package.json`. The `native-addon` versionActions plugin:

1. Discovers `npm/<platform>/` subdirs
2. Bumps every platform package's `version` to match the parent
3. Resolves auth — GitHub Actions OIDC per-package token exchange, falls back to `NPM_TOKEN`
4. Publishes platform packages first, then the parent with `optionalDependencies` pinned to literal versions

## Snapshot / preview releases

Replaces visulima's `pkg-pr-new` script flow:

```bash
vis release snapshot --tag pr-1234
```

Publishes `0.0.0-pr-1234-<shortSha>` versions of affected packages. Default backend is `pkg-pr-new` (free, hosted); configurable via `release.snapshot.backend` (string id or `{ url, auth }`).

## Migration paths

```bash
vis release init                          # auto-detect
vis release init --from-semantic-release  # walks .releaserc.json files; maps branches → channels
vis release init --from-changesets        # copies .changeset/*.md verbatim; maps config.json
vis release init --from-bumpy             # copies .bumpy/*.md into .vis/release/, prints the translated config block; .bumpy/ is left in place for the operator to delete.
```

Per-package opt-in via `package.json["vis-release"]["managed"]: true`. Both old + new systems coexist during transition; existing tag history (`<pkg>@<version>`) and `CHANGELOG.md` files are preserved.

## CI integration

Three GitHub Actions workflows ship in `.github/workflows/`:

- `vis-release-check.yml` — every PR posts a sticky comment showing the release plan
- `vis-release-snapshot.yml` — every PR publishes preview snapshots
- `vis-release.yml` — push to a release branch triggers `vis release ci release`

Required secrets:

- `GH_TOKEN` (`${{ github.token }}` works)
- `VIS_GH_TOKEN` — PAT or GitHub App token; required for force-pushing the version-PR branch (the default token is anti-recursion-locked)
- `NPM_TOKEN` — fallback when OIDC trusted publishing isn't configured

## Provider abstraction

Forge operations (PR comments, version PRs, releases) live behind a `RemoteReleaseClient` interface. v1 ships:

- `github` — complete (uses `gh` CLI)
- `gitlab` — stub (detection works; ops throw with build-hint message)

Set `release.provider: "github" | "gitlab" | "auto"`. Auto-detection: env signal first (`GITHUB_ACTIONS` / `GITLAB_CI`), then git remote URL host, then `github` fallback. Bitbucket is not supported.

## Programmatic API

```ts
import { releaseVersion, releaseChangelog, releasePublish } from "@visulima/vis/release";

const versionResult = await releaseVersion({ cwd: "/path/to/repo", dryRun: true });
const changelogResult = await releaseChangelog({ cwd: "/path/to/repo" });
const publishResult = await releasePublish({ cwd: "/path/to/repo", tag: "alpha" });
```

> `releaseSnapshot` is exposed via the CLI (`vis release ci snapshot`); the
> programmatic API export is not implemented yet (lands in M8).

`ReleaseClient` class form for projects that prefer it:

```ts
import { ReleaseClient } from "@visulima/vis/release";

const client = new ReleaseClient({ baseBranch: "develop" });
await client.releaseVersion();
```

## Operational concerns

- **Idempotent re-runs**: every command uses three-layer "already published" detection (git tag → npm registry → custom `checkPublished`). Re-running `vis release publish` after a partial failure skips already-published packages.
- **State file**: `<changesDir>/.state.json` (gitignored) persists in-progress release state. Use `vis release publish --resume` after a failure to retry only the failed subset.
- **Concurrency**: process-level lock + GH Actions concurrency group. `vis release publish` refuses to start if an open release-PR exists (catches local-vs-CI races).
- **Dry run**: every command supports `--dry-run` with `[dry-run]` log prefixes. No file writes, no network calls.
- **Diagnostics**: `vis release doctor` runs preflight checks (workspace integrity, PM version, OIDC env, NAPI sidecars, etc.) and emits machine-readable `--json`.

## Reference

- RFC: [`packages/tooling/vis/rfc/design-release-manager.md`](../../rfc/design-release-manager.md)
- JSON schema: [`packages/tooling/vis/schemas/vis-release-config.schema.json`](../../schemas/vis-release-config.schema.json)
