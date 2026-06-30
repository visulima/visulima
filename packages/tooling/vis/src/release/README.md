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

## npm Trusted Publishing bootstrap (`pretrust`)

npm — unlike PyPI — refuses to configure a Trusted Publisher (OIDC) for a package that doesn't exist yet, so the _first_ OIDC publish of a brand-new package fails. `vis release pretrust` breaks that chicken-and-egg by publishing a minimal, explicitly non-functional placeholder for every managed package missing from the registry:

```bash
vis release pretrust                  # placeholder for each not-yet-published package
vis release pretrust --dry-run        # preview
vis release pretrust --filter '@scope/*'
```

The placeholder ships only a `README.md` (stating it must not be used) under a dedicated dist-tag (default `placeholder`, so `latest` stays unset and `npm install` keeps failing until the real release). Each published placeholder prints its `https://www.npmjs.com/package/<name>/access` link; open it, add a GitHub Actions Trusted Publisher, then run `vis release publish` over OIDC. Mirrors [`azu/setup-npm-trusted-publish`](https://github.com/azu/setup-npm-trusted-publish). Auth uses `NPM_TOKEN` (or your local npm login); packages already on the registry are skipped unless `--force`.

## Replay changelogs

A change file can carry `replay` conditions instead of a one-shot bump (tegami parity). Such a file is **retained** on `version` — not deleted — and its body is re-emitted into a package's changelog when a milestone fires:

```markdown
---
"@scope/cerebro":
  replay:
    - "@scope/cerebro@1.0.0" # when it reaches this exact version
    - "exit-prerelease:@scope/cerebro" # when it leaves a prerelease line
---

This note is replayed into the changelog at each milestone above.
```

Replay files are **changelog-only** — they never contribute a version bump (the file is long-lived, so bumping off it would re-bump every run), and setting both `bump` and `replay` is rejected. Each run, every matching condition injects the body once (de-duplicated per package); the file is deleted once **all** its conditions fire within a single run, otherwise it is retained. A file whose milestones can only land in separate runs (e.g. two distinct future versions) stays on disk until you remove it — keep one milestone per file for automatic cleanup.

## Migration paths

```bash
vis release init                          # auto-detect
vis release init --from-semantic-release  # walks .releaserc.json files; maps branches → channels
vis release init --from-changesets        # copies .changeset/*.md verbatim; maps config.json
vis release init --from-bumpy             # copies .bumpy/*.md into .vis/release/, prints the translated config block; .bumpy/ is left in place for the operator to delete.
vis release init --agent                  # append a 'Releasing with vis' section to AGENTS.md (idempotent) so AI agents author change files instead of hand-bumping
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

## Lifecycle plugins

Beyond the single-purpose `defineVersionActions` / `defineChangelogFormatter` / `defineNotificationChannel` extension points, a **lifecycle plugin** (tegami parity) can hook arbitrary points of the version/publish flow. Register via `release.plugins`:

```ts
import { defineReleasePlugin } from "@visulima/vis/release";

export default defineConfig({
    release: {
        plugins: [
            defineReleasePlugin({
                name: "build-before-publish",
                async willPublish({ package: pkg }) {
                    await runBuild(pkg.name); // return false to skip this package
                },
                async afterPublishAll({ result }) {
                    await pingDeployHook(result.published);
                },
            }),
        ],
    },
});
```

Hooks (all optional): `applyDraft({ plan })` after versions+changelogs are written, `willPublish({ package })` before each publish (return `false` to skip), `afterPublish({ package })` after each successful publish, `afterPublishAll({ result })` once the wave completes. **Error policy:** `applyDraft` / `willPublish` throw-propagate (they gate the release — fail fast); `afterPublish` / `afterPublishAll` are post-effect, so a throw is logged and swallowed — a side-effect hiccup can't "unpublish" a package.

## Shared group tags (`syncGitTag`)

`release.fixed` / `release.linked` groups can collapse to a **single git tag + one aggregate GitHub/GitLab release** for the whole group instead of one tag + release per member (tegami parity):

```ts
release: {
    fixed: [{ name: "acme", packages: ["@acme/*"], syncGitTag: true }],
}
```

This tags the wave once as `acme@<version>` (the highest member version; override with `tagPattern`, tokens `{name}`/`{version}`) and publishes one release listing every member. Members in a `syncGitTag` group are skipped in the per-package tag/release loop. Without `syncGitTag` (the default) each member keeps its own `<pkg>@<version>` tag + release.

## Operational concerns

- **Idempotent re-runs**: every command uses three-layer "already published" detection (git tag → npm registry → custom `checkPublished`). Re-running `vis release publish` after a partial failure skips already-published packages.
- **State file**: `<changesDir>/.state.json` (gitignored) persists in-progress release state. Use `vis release publish --resume` after a failure to retry only the failed subset.
- **Git-tracked publish lock**: set `release.publish.lockInGit: true` to persist that state to a committed `<changesDir>/publish-lock.json` instead. The lock is committed + pushed when a publish wave opens and removed (committed) on full success — so a partially-failed publish can be resumed from a **fresh checkout on a different runner** (the ephemeral-CI case where untracked `.state.json` never survives the clone). A committed lock is treated as an implicit `--resume`. Mirrors tegami's `publish-lock.yaml`-in-git model.
- **Concurrency**: process-level lock + GH Actions concurrency group. `vis release publish` refuses to start if an open release-PR exists (catches local-vs-CI races).
- **Dry run**: every command supports `--dry-run` with `[dry-run]` log prefixes. No file writes, no network calls.
- **Diagnostics**: `vis release doctor` runs preflight checks (workspace integrity, PM version, OIDC env, NAPI sidecars, etc.) and emits machine-readable `--json`.

## Reference

- RFC: [`packages/tooling/vis/rfc/design-release-manager.md`](../../rfc/design-release-manager.md)
- JSON schema: [`packages/tooling/vis/schemas/vis-release-config.schema.json`](../../schemas/vis-release-config.schema.json)
