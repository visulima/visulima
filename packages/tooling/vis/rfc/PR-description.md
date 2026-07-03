# Add `vis release` — monorepo release subsystem inside `@visulima/vis`

Replaces `multi-semantic-release` + 49 `.releaserc.json` files + `scripts/semantic-release-native-addons.mjs` + `scripts/publish-preview-release.js` with a built-in release subsystem at `vis release …`.

**RFC**: [`packages/tooling/vis/rfc/design-release-manager.md`](packages/tooling/vis/rfc/design-release-manager.md) (1394 lines, 23 sections)

## Summary

- **Algorithm port**: bumpy's three-phase release-plan propagation (out-of-range fix → fixed/linked groups → proactive cascade), max-merge of multi-file bumps, channel-aware semver math (alpha → beta → next → main re-counter rules per RFC §10.1)
- **Cross-PM**: npm / pnpm / yarn (Berry) / bun all first-class. Pack with native PM, publish via `npm publish <tarball>` (lowest-common-denominator — yarn refuses tarballs in `yarn npm publish`, bun lacks OIDC + provenance)
- **`workspace:` + `catalog:` resolution** at publish time (in-place when pack manager isn't pnpm)
- **NAPI native-addon** versionActions plugin (port of `scripts/semantic-release-native-addons.mjs`) — auto-detected via `napi` field in `package.json`
- **Snapshot releases** replace `pkg-pr-new` script (`vis release snapshot --tag pr-1234`)
- **Pluggable forge provider**: `github` (complete) / `gitlab` (stub) / `bitbucket` (stub) via the `RemoteReleaseClient` interface
- **Migration paths**: from semantic-release / changesets / bumpy via `vis release init --from-{...}`
- **GH Actions workflows**: `vis-release.yml` / `vis-release-snapshot.yml` / `vis-release-check.yml`

## Layout (inside vis, no separate package)

```
packages/tooling/vis/
├── src/
│   ├── release/                  # pure-function logic (~5800 LOC)
│   │   ├── api.ts, config.ts, errors.ts, types.ts, index.ts
│   │   └── core/
│   │       ├── release-plan.ts, dep-graph.ts, change-file.ts, semver.ts
│   │       ├── apply-release-plan.ts, publish-pipeline integration
│   │       ├── catalog.ts, channels.ts, clean-package-json.ts, git.ts, state.ts
│   │       ├── orchestrator.ts, shell-runner.ts, sticky-comment.ts
│   │       ├── changelog/{api,default,github,resolve}.ts
│   │       ├── package-managers/{interface,npm,pnpm,yarn,bun,detect}.ts
│   │       ├── version-actions/{interface,npm,private,native-addon}.ts
│   │       └── remote/{interface,github,gitlab,bitbucket,detect}.ts
│   └── commands/release/         # cerebro CLI handlers (~1700 LOC)
│       ├── add, generate, status, plan, check, doctor (read-only / authoring)
│       ├── version, publish, snapshot (apply / publish)
│       ├── init (migration)
│       └── ci/{check, plan, release, snapshot, setup}
├── __tests__/release/core/       # 11 test files / 1662 LOC
└── rfc/design-release-manager.md
```

`packages/tooling/vis/package.json`:

- adds `conventional-commits-parser` (the only net-new dep — `yaml`/`semver`/`zeptomatch`/`@visulima/redact` already present)
- adds `./release` + `./release/types` to `exports` map
- adds `release?: VisReleaseConfig` field on `VisConfig` type

## Commands shipped

```
vis release add [--packages] [--message] [--empty] [--name]
vis release generate [--from <ref>] [--name <slug>] [--dry-run]
vis release status [--json] [--filter] [--bump]
vis release plan
vis release check [--strict] [--no-fail]
vis release version [--dry-run] [--commit] [--channel] [--filter]
vis release publish [--dry-run] [--tag] [--otp] [--no-push] [--resume]
vis release snapshot --tag <name> [--registry] [--filter] [--dry-run]
vis release doctor [--json]
vis release init [--from-semantic-release | --from-changesets | --from-bumpy | --fresh] [--dry-run]

vis release ci check  [--strict] [--no-fail]
vis release ci plan
vis release ci release [--auto-publish] [--branch] [--channel]
vis release ci snapshot [--tag]
vis release ci setup
```

All loaders are lazy — release deps (yaml/semver/etc.) only parse when a release subcommand is invoked.

## Migration plan (RFC §17.3)

Per-package opt-in via `package.json["vis-release"]["managed"]: true`. Both systems coexist during transition.

- **P0** RFC + skeleton merged (this PR)
- **P1** Implement against fixtures, no production use
- **P2** Pilot on `@visulima/string` (non-NAPI; vis itself is NAPI and waits for P4)
- **P3** Migrate non-NAPI packages in waves (tooling → terminal → error-debugging → data → fs → email → api → storage)
- **P4** Implement + battle-test `native-addon` versionActions; flip the 4 NAPI parents (`task-runner`, `vis`, `tui`, `secret-scanner`)
- **P5** Replace `preview-release.yaml` with `vis release ci snapshot`
- **P6** Remove `multi-semantic-release` + all `.releaserc.json` files + legacy scripts
- **P7** Flip `release.defaultManaged: true`

## Test coverage

11 test files / 1662 LOC against ~5800 LOC of release subsystem code:

- M2 core algorithms — release-plan (every phase + edge case), change-file, semver (every channel-transition table row), dep-graph, channels
- M3 modules — apply-release-plan (workspace:/catalog: preservation), catalog (parseCatalogs + rewrite), clean-package-json
- M6 default changelog formatter
- M9 sticky-comment helpers

vitest didn't execute in the development sandbox (no `pnpm install`); CI on this branch is the first run.

## Stability

`@visulima/vis/release` ships under vis's existing SemVer policy. The release subsystem is flagged unstable (warning on first invocation, suppressible via `release.acknowledgeUnstable: true`) until: (a) public API survives ≥3 months without breaking changes, (b) all visulima packages migrate through P6, (c) ≥1 external project reports successful adoption.

Stable surface (RFC §21.1): function signatures (`releaseVersion` etc.), `VisReleaseConfig` shape, `VersionActions` / `ChangelogFormatter` / `PackageManagerAdapter` / `RemoteReleaseClient` interfaces, CLI subcommand names + flags, `--json` schemas, `VisReleaseErrorCode` union, change-file frontmatter syntax, `.state.json` schema.

## What's NOT in this PR

- **Active rollout** — Phase 0 only. No package has been flipped to `managed: true` yet. Visulima continues releasing via `multi-semantic-release` until the first wave of P3.
- **Complete GitLab/Bitbucket support** — interface + detection ship; operations are stubs that throw `not implemented` for those providers.
- **e2e fixture monorepos** — RFC §19.3 lists 7 fixtures (4 PMs × pnpm-only migration sources). Unit tests are in; integration tests are punted to a follow-up.

## How to review

1. **Read the RFC** first: `packages/tooling/vis/rfc/design-release-manager.md`
2. **Skim the type surface**: `packages/tooling/vis/src/release/types.ts`
3. **Spot-check the algorithm**: `packages/tooling/vis/src/release/core/release-plan.ts` (the three-phase loop) + tests
4. **Confirm no impact on existing vis commands**: cerebro registration in `bin.ts` is additive (one new array iteration); all loaders are lazy
5. **Verify migration safety**: `init` is dry-run-by-default; existing `.releaserc.json` files are not touched

## Closes / replaces (when fully rolled out)

- ❌ `scripts/semantic-release-native-addons.mjs` (after P4)
- ❌ `scripts/publish-preview-release.js` (after P5)
- ❌ 49 × `.releaserc.json` files (after P6)
- ❌ `.github/workflows/semantic-release.yml` (after P6)
- ❌ `.github/workflows/preview-release.yaml` (after P5)
- ❌ `multi-semantic-release` dep in root `package.json` (after P6)
