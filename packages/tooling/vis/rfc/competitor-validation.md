# Competitor Feature Validation

Audit notes for the DX feature parity sweep. Each item maps to a specific
issue tracked against `changesets`, `release-please`, `semantic-release`,
or `nx` — verified by reading the current `@visulima/vis` source.

## a. Dates on changelog entries (changesets #109)

**Shipped.** The default formatter emits `## <version>` followed by a
`<sub>YYYY-MM-DD</sub>` line for every release entry. See
`packages/tooling/vis/src/release/core/changelog/default.ts:191-192`. The
keep-a-changelog formatter emits `## [<version>] - <date>` (line 191 of
`keep-a-changelog.ts`), matching the canonical keep-a-changelog spec.
The `date` token is provided by `ChangelogContext` (computed once per
release wave so every per-package changelog uses the same ISO date — no
clock-drift between packages). A future `dateFormat?: "iso" | "short" |
string` option could give operators control over the rendering, but the
current ISO default is the broadly-accepted convention and matches
changesets' behaviour after #109 was closed.

## b. `--config <path>` (semantic-release #1592)

**Capability present, CLI flag NOT yet surfaced.**
`packages/tooling/vis/src/config/config.ts:457` defines
`loadVisConfig(workspaceRoot, options?: { explicitConfigPath?: string })`
and resolves the override before falling back to discovery. However,
the binary at `packages/tooling/vis/src/bin.ts:255` calls
`loadVisConfig(workspaceRoot)` without forwarding any `--config` flag,
so operators can't override the config path from the CLI today.
Recommendation: thread a top-level `--config <path>` cerebro option into
`bin.ts` and pass it through as `explicitConfigPath`. The loader's
guard against `..` escapes already handles the security side. A doctor
finding pointing at the existing loader capability would be a useful
intermediate step; the proper fix is the CLI wire-up.

## c. `--dry-run` with read-only token (semantic-release #2232)

**Shipped.** `createRemoteReleases` (which shells out to `gh` for the
release POST + token-touching `listRecentReleases` probe) is gated
behind `!options.dryRun` in
`packages/tooling/vis/src/release/core/orchestrator.ts:1412`. The
`success-walk` (sticky comments + labels) lives inside the same gate,
and `publishContext` similarly short-circuits the `prePublishCommand`,
`postPublishCommand`, and the actual `pm.publish` invocation under
`dryRun`. As a result, `vis release --dry-run` runs end-to-end with no
gh-CLI shellouts or registry token reads; the doctor's own
`gh auth status` probe in the new `github.token-scopes` check (#2469)
is the only token-touching code path that still runs, and it's intentionally
read-only.

## d. `releaseAs` is per-package (release-please #1905)

**Shipped.** Change-file payload supports `releaseAs?: string` on the
nested `ChangeFileNested` shape (see `types.ts:65`). The release-plan
collects `releaseAs` overrides per package
(`release-plan.ts:622-637`) and throws `BUMP_FILE_INVALID` when two
change files disagree on the override for the same package — the right
behaviour for "force me to ship 2.0.0 right now" semantics. The override
is package-scoped: a `releaseAs` on `@scope/a` does not affect the
computed bump of `@scope/b` (whose entry in the same multi-package
change file goes through the normal `bumpVersion` path).

## e. Skip GH release while pushing tags (release-please #1295)

**Added.** Introduced `release.publish.noRelease?: boolean` in this
audit pass. Threaded into the createRemoteReleases gate at
`orchestrator.ts:1412` so `noRelease: true` keeps the npm publish + git
tag flow intact while skipping the forge release artifact entirely.
Useful for teams that maintain release notes elsewhere (a docs site,
an in-product changelog) and don't want the duplicate.

## f. Cross-branch tag search (release-please #2202)

**Shipped.** The git-tag resolver in
`packages/tooling/vis/src/release/core/version-resolver.ts:287-289`
runs `git tag --list <glob> --sort=-v:refname` without a branch filter.
Tag discovery walks the full tag namespace, so a release tag created on
`main` is still discoverable when running on `alpha`. The regex
compiled by `compileReleaseTagRegex` operates against the raw tag name,
not against the commit ancestry, so cross-branch lookup works out of
the box.

## g. Auth-verify plugin override (semantic-release #1729)

**Shipped via the VersionActions plugin surface.** Custom
`versionActions` modules ARE the publish step — `readPublishedVersion`,
`writeVersion`, and `publish` are all overridable per package via
`release.packages.<name>.versionActions: "./path/to/module"` (or the
`shell` built-in for arbitrary shell publish commands). This means a
team that needs to override the auth-verification flow (e.g. swap in a
custom JWT exchange before `npm publish`) can ship their own
`VersionActions` implementation; the orchestrator delegates the entire
publish lifecycle to it. The `@visulima/vis/release/plugin-sdk` module
exposes `defineVersionActions()` to author such plugins with full type
support. No additional config knob is needed — the publish step IS the
plugin override.

## h. Semver-range respect for dep bumps (nx #21457)

**Shipped.** Phase A of `assembleReleasePlan`
(`release-plan.ts:296-298`) calls `satisfiesRange(newVersion, cleaned)`
on every dependent's range; when the existing range still satisfies the
post-bump version, NO cascade fires. `cleanRange` strips the
`workspace:` / `catalog:` protocols and returns `null` for the
"always-satisfied" forms (handled separately at line 290). The default
`updateInternalDependencies: "out-of-range"` mode is built on this same
predicate — Phase C3 only escalates when an opt-in mode (`"patch"` or
`"minor"`) is set. The end result: a `^1.0.0` consumer of a package
that goes `1.0.0 → 1.5.0` does NOT get bumped in the default config,
matching nx's behaviour after #21457.
