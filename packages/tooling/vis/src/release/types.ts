/**
 * Public types for the vis release subsystem.
 *
 * Imported via `@visulima/vis/release/types` sub-export. See the RFC at
 * `packages/tooling/vis/rfc/design-release-manager.md` for the full design.
 *
 * Stability: every type here is part of vis's public API surface — breaking
 * changes require a vis major version bump (RFC §21.1).
 */

// ── Bump levels ──────────────────────────────────────────────────────

export type BumpLevel = "major" | "minor" | "patch" | "none";

export const BUMP_LEVELS: ReadonlyArray<BumpLevel> = ["major", "minor", "patch", "none"] as const;

/**
 * Numeric ranking used to compare two bump levels.
 * `major` &gt; `minor` &gt; `patch` &gt; `none`.
 */
export const bumpRank = (level: BumpLevel): number => {
    switch (level) {
        case "major": {
            return 3;
        }
        case "minor": {
            return 2;
        }
        case "patch": {
            return 1;
        }
        default: {
            return 0;
        }
    }
};

/** Take the maximum of two bump levels. */
export const maxBump = (a: BumpLevel, b: BumpLevel): BumpLevel => (bumpRank(a) >= bumpRank(b) ? a : b);

// ── Change files (a.k.a. "bump files" — `.vis/release/*.md`) ─────────

export interface ChangeFileSimple {
    /** Map of package-name → bump level. */
    bumps: Record<string, BumpLevel>;
}

export interface ChangeFileNested {
    /** Bump level for the primary. */
    bump: BumpLevel;
    /** Optional cascade: package-glob → bump level. */
    cascade?: Record<string, BumpLevel>;
    /** Single primary package being bumped. */
    package: string;

    /**
     * Pin the resulting version to this exact value, bypassing the
     * computed bump. Useful for "I need to ship 2.0.0 right now"
     * scenarios. Must be a valid semver string. Maps to release-please's
     * `Release-As: &lt;version>` PR footer.
     *
     * When set, the `bump` field is still required (for tooling
     * consistency + cascade triggering) but the resulting newVersion is
     * `releaseAs` literally, ignored by `bumpVersion`.
     */
    releaseAs?: string;
}

export interface ChangeFile {
    /** Markdown body — used as changelog entry verbatim. May be empty. */
    body: string;
    /** Slug of the file (filename without `.md` extension). */
    id: string;
    /** Optional inline metadata recognized by github formatter. */
    meta?: {
        author?: string;
        commit?: string;
        pr?: number;
    };
    /** File path relative to the repo root. */
    path: string;
    /** Either-or: simple multi-package or nested with cascade. */
    payload: ChangeFileSimple | ChangeFileNested;
}

// ── Workspace + dep-graph ────────────────────────────────────────────

export interface WorkspacePackage {
    /** Absolute directory containing the package. */
    dir: string;
    /** Raw `package.json` contents. */
    manifest: PackageManifest;
    /** Path to `package.json`. */
    manifestPath: string;
    /** Package name from `package.json#name`. */
    name: string;
    /** Whether `package.json#private === true`. */
    private: boolean;
    /** Current version from `package.json#version`. */
    version: string;
}

export interface PackageManifest {
    [key: string]: unknown;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    name: string;
    napi?: Record<string, unknown>;
    optionalDependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
    private?: boolean;
    publishConfig?: Record<string, unknown>;
    version: string;
    "vis-release"?: PerPackageReleaseConfig;
}

export type DependencyKind = "dependencies" | "devDependencies" | "peerDependencies" | "optionalDependencies";

export interface DependentInfo {
    /** Which dep field the source appears in. */
    kind: DependencyKind;
    /** Package depending on the source. */
    name: string;
    /** The raw range string (`workspace:^1.2.3`, `^1.2.3`, `catalog:dev`, etc.). */
    range: string;
}

// ── Release plan ─────────────────────────────────────────────────────

/**
 * Why a particular package ended up in the release plan.
 * Used for log lines and changelog attribution.
 */
export type BumpReason
    = | "EXPLICIT" // listed directly in a change file
        | "DEPENDENCY_OUT_OF_RANGE" // dep moved past existing range constraint
        | "DEPENDENCY_BUMPED" // dep moved at all (per dependencyBumpRules)
        | "DEVDEPENDENCY_BUMPED" // devDependency moved (opt-in via release.bumpDevDependencies)
        | "CASCADE" // change file's nested cascade block listed it
        | "CASCADE_TO" // source package's per-pkg cascadeTo listed it
        | "CATALOG_CHANGED" // pnpm catalog dep moved (opt-in via release.detectCatalogChanges)
        | "FIXED_GROUP" // shares a fixed group with a bumped package
        | "LINKED_GROUP" // shares a linked group with a bumped package
        | "PEER_DEP_MATCH"; // peer dependent inherited bump level

export interface BumpSource {
    bumpType: BumpLevel;
    name: string;
    newVersion: string;
}

export interface PlannedRelease {
    /** Change files contributing to this release (may be empty for pure dep bumps). */
    changeFiles: ChangeFile[];
    /** True when bumped by a cascade rule. */
    isCascadeBump: boolean;
    /** True when no change file directly named this package. */
    isDependencyBump: boolean;
    /** True when bumped by a fixed/linked group. */
    isGroupBump: boolean;
    /** Package name. */
    name: string;
    /** Post-bump version. */
    newVersion: string;
    /** Pre-bump version. */
    oldVersion: string;
    /** Reason this package made it into the plan. */
    reasons: BumpReason[];
    /** Sources that triggered cascading bumps (for changelog attribution). */
    sources: BumpSource[];
    /** Bump level applied. */
    type: Exclude<BumpLevel, "none">;
}

export interface ReleasePlan {
    /** Change files consumed by this plan (deleted on `vis release version`). */
    consumedChangeFiles: ChangeFile[];
    /** Sorted alphabetically by package name. */
    releases: PlannedRelease[];
    /** Non-fatal warnings to surface to the user. */
    warnings: string[];
}

// ── Channel routing (semantic-release-style) ─────────────────────────

export type ChannelMode = "auto-publish" | "version-pr";

export interface ChannelConfig {
    /** CI behavior: `auto-publish` (push triggers publish) or `version-pr` (review gate). */
    mode?: ChannelMode;
    /** Pre-release identifier (e.g. `"alpha"`, `"beta"`, `"rc"`). Omit for stable channels. */
    prerelease?: string;
    /** For maintenance branches: `"match"` keeps releases inside the branch's semver range. */
    range?: string;
    /** npm dist-tag for publishes on this channel. Use `"branch-name"` to mirror the branch name. */
    tag: string;
}

// ── Dep-propagation rules ────────────────────────────────────────────

export type BumpAs = BumpLevel | "match";

export interface DependencyBumpRule {
    /** Bump level to apply to the dependent. `"match"` = same as source. */
    bumpAs: BumpAs;
    /** Minimum source bump that activates this rule. */
    trigger: BumpLevel;
}

export type DependencyBumpRules = Partial<Record<DependencyKind, DependencyBumpRule | false>>;

export type UpdateInternalDependenciesMode = "patch" | "minor" | "out-of-range";

// ── Fixed / linked group config (RFC §6.1 — changesets #1059 parity) ─

/**
 * Per-group changelog routing.
 *
 *   - `"per-package"` (default) — every member writes to its own
 *     `&lt;pkg-dir>/CHANGELOG.md` exactly as if it weren't grouped.
 *   - `"shared"` — every member's entry is rendered into ONE shared
 *     file. `path` overrides the default location
 *     (`&lt;first-member-dir>/GROUP-CHANGELOG.md`). Useful for `core/utils`
 *     pairs and other tightly-coupled package sets where one
 *     consolidated changelog reads better than N tiny ones.
 */
export interface ReleaseGroupChangelogConfig {
    mode: "per-package" | "shared";
    /** Override file path. Default: `&lt;first-member-dir>/GROUP-CHANGELOG.md`. */
    path?: string;
}

/**
 * Dual-shape config for `release.fixed` / `release.linked` entries.
 *
 * Bare `string[]` is interpreted as `{ packages, changelog: { mode: "per-package" } }`
 * — keeps existing configs working without migration.
 */
export type ReleaseGroupConfig
    = | string[]
        | {
            changelog?: ReleaseGroupChangelogConfig;

            /**
             * Optional name for the group. Used as the heading in the
             * shared changelog when set; defaults to a "group-N"-style
             * identifier derived from the array index.
             */
            name?: string;
            /** Package names or globs that belong to this group. */
            packages: string[];
        };

/**
 * Normalise a `ReleaseGroupConfig` (bare array or object form) into the
 * object form. Centralised so plan-assembly, changelog routing, and
 * print-config all see the same shape.
 */
export const normaliseGroup = (
    group: ReleaseGroupConfig,
): {
    changelog: ReleaseGroupChangelogConfig;
    name?: string;
    packages: string[];
} => {
    if (Array.isArray(group)) {
        return { changelog: { mode: "per-package" }, packages: group };
    }

    return {
        changelog: group.changelog ?? { mode: "per-package" },
        name: group.name,
        packages: group.packages,
    };
};

// ── Snapshot ─────────────────────────────────────────────────────────

export type SnapshotTagKind = "sha" | "short-sha" | "branch" | "pr";

export type SnapshotBackend = "pkg-pr-new" | "registry" | { auth?: string; url: string };

// ── Notifications ────────────────────────────────────────────────────

/**
 * Common fields shared across built-in notification channels.
 * `id` is an operator-supplied disambiguator that surfaces in log lines
 * when fanning out to multiple instances of the same channel kind
 * (e.g. `slack:engineering` vs `slack:releases`).
 */
interface CommonChannelConfig {
    /** Optional disambiguator for log lines + doctor checks. */
    id?: string;
    /** Skip the `Skipped (N):` block. Default false (skipped are surfaced). */
    includeSkipped?: boolean;

    /**
     * Title template — see `expandNotificationTemplate` for tokens
     * (`{count}`, `{packages}`, `{firstName}`, `{firstVersion}`,
     * `{channel}`, `{repo}`, `{date}`). When omitted, a sensible
     * "🚀 Released N packages" default is used.
     */
    title?: string;
}

export interface SlackConfig extends CommonChannelConfig {
    /**
     * Override the channel the webhook posts to. Only honoured when
     * the webhook was created with multi-channel posting allowed (rare).
     */
    channelOverride?: string;
    /** Bot icon emoji (e.g. `":rocket:"`). */
    iconEmoji?: string;
    /** Bot display name override. */
    username?: string;

    /**
     * Slack incoming-webhook URL. Workspace+channel scoped. Use env
     * substitution if you don't want it inline:
     * `webhook: "${SLACK_WEBHOOK_URL}"`.
     */
    webhook: string;
}

export interface DiscordConfig extends CommonChannelConfig {
    /** Override the embed avatar. */
    avatarUrl?: string;
    /** Embed colour as an integer RGB (e.g. `0x3B82F6` = blue-500). */
    color?: number;
    /** Bot display name override. */
    username?: string;
    /** Discord webhook URL. Server+channel scoped. */
    webhook: string;
}

export interface WebhookConfig extends CommonChannelConfig {
    /**
     * Body template. When omitted, the full `NotificationContext` is
     * sent verbatim as JSON. When provided, every string leaf is run
     * through `expandNotificationTemplate`.
     */
    body?: unknown;
    /** Additional headers (values run through template interpolation). */
    headers?: Record<string, string>;
    /** HTTP method. Default `POST`. */
    method?: "POST" | "PUT";
    /** Target URL. */
    url: string;
}

export interface NotificationsConfig {
    /**
     * Built-in Discord channel(s). Single config or array. Each posts a
     * formatted embed with title + bullet-list of packages.
     */
    discord?: DiscordConfig | DiscordConfig[];

    /**
     * Custom channels loaded from a path. The module must export a
     * default `NotificationChannel` (object with `.send`) OR a factory
     * `(options) => NotificationChannel` for the tuple `[path, options]`
     * form.
     */
    plugins?: (string | [string, Record<string, unknown>])[];

    /**
     * Skip notifications on prerelease waves (when every published
     * version has a `-…` suffix). Default `true` — most teams want
     * Slack noise only on stable releases.
     */
    skipPrerelease?: boolean;

    /**
     * Built-in Slack channel(s). Each posts a Block Kit message with
     * a header + package list + context block.
     */
    slack?: SlackConfig | SlackConfig[];
    /** Generic webhook(s) for Teams / Mattermost / internal dashboards. */
    webhook?: WebhookConfig | WebhookConfig[];
}

export interface SnapshotConfig {
    backend?: SnapshotBackend;
    /** Whether to delete published snapshots on PR-close (no-op for `pkg-pr-new`). */
    cleanupOnPrClose?: boolean;
    /** When backend is `pkg-pr-new`, the registry URL is supplied automatically. */
    registry?: string;
    /** Multi-tag publish — pick which tag types to emit per snapshot. */
    tags?: SnapshotTagKind[];
    /** Version template — interpolation tokens: `{tag}`, `{shortSha}`, `{sha}`, `{branch}`, `{pr}`, `{timestamp}`. */
    versionTemplate?: string;
}

// ── Per-package config (in `package.json["vis-release"]`) ────────────

export interface PerPackageReleaseConfig {
    /**
     * Extra directories (or globs) that logically belong to this package.
     * Used by `vis release check --strict` to attribute changes outside
     * the package's own directory to this package — e.g. a shared
     * `docs/api/` directory whose updates should still trip the
     * "covered by a change file?" gate for the package they document.
     *
     * Globs are workspace-root-relative (NOT package-directory-relative).
     * Examples:
     *
     *   ```ts
     *   release: {
     *     packages: {
     *       "@scope/cli": {
     *         additionalPaths: ["docs/cli/**", "examples/cli/**"],
     *       },
     *     },
     *   }
     *   ```
     *
     * Default: `undefined` (only the package's own directory is
     * attributed to it). Release-please parity: #1921.
     */
    additionalPaths?: string[];
    /** Custom shell command run before publish (requires `allowCustomCommands`). */
    buildCommand?: string;

    /**
     * Build context passed to `docker buildx build` (the final positional
     * argument). Honoured by the `container` versionActions; defaults to
     * the package directory.
     */
    buildContext?: string;

    /**
     * Relative path from the package directory to `Cargo.toml` for the
     * `cargo` versionActions. Set automatically by the `cargo()` preset
     * from its `crateDir` option. Defaults to `"Cargo.toml"`.
     */
    cargoTomlPath?: string;
    /** Source-side cascade: glob → rule. */
    cascadeTo?: Record<string, DependencyBumpRule>;
    /** Per-pkg override of `release.changedFilePatterns`. Replaces (does not merge). */
    changedFilePatterns?: string[];
    /** Custom shell command that prints currently-published version to stdout. */
    checkPublished?: string;

    /**
     * Extra `--build-arg KEY=VALUE` pairs forwarded to `docker buildx
     * build`. Useful for stamping the version into the image at build
     * time. Consumed by the `container` versionActions.
     */
    containerBuildArgs?: Record<string, string>;

    /**
     * Fully-qualified container image reference, e.g.
     * `"ghcr.io/scope/foo"`. Required by the `container` versionActions
     * (no built-in default since the registry hostname is operator-
     * specific). Set automatically by the `container()` preset.
     */
    containerImage?: string;

    /**
     * Target platforms passed to `docker buildx build --platform`.
     * Defaults to `["linux/amd64", "linux/arm64"]`. Single-arch builds
     * can pass a one-entry array.
     */
    containerPlatforms?: ReadonlyArray<string>;

    /**
     * Post-push signing scheme for the `container` versionActions.
     * `"cosign"` runs `cosign sign --yes &lt;image>:&lt;version>` against the
     * just-pushed immutable tag. Future schemes (sigstore-bundle,
     * notation, etc.) can extend this union.
     */
    containerSigning?: "cosign";

    /**
     * Skip the conventional `:latest` floating tag on push. Useful for
     * pre-release / channel-specific images that shouldn't move the
     * shared `latest` pointer.
     */
    containerSkipLatest?: boolean;

    /**
     * Per-package override of the workspace-level `currentVersionResolver`.
     * Same set of modes: `"disk"`, `"registry"`, `"git-tag"`. Useful when
     * one package in the monorepo lags behind the registry / git-tag baseline
     * (e.g. a newly-added package that hasn't been published yet).
     */
    currentVersionResolver?: "disk" | "git-tag" | "registry";
    /** Per-pkg override of inbound dep-bump rules. */
    dependencyBumpRules?: DependencyBumpRules;

    /**
     * Per-package `extra-files` rules with paths relative to the
     * package directory. Merged with workspace-level
     * `release.publish.extraFiles` (per-package wins on path collision).
     */
    extraFiles?: ExtraFileRule[];

    /**
     * Relative path from the package directory to the JSR manifest
     * (`jsr.json` or `deno.json`) for the `jsr` versionActions. Set
     * automatically by the `jsr()` preset from its `manifestPath`
     * option. Defaults to `"jsr.json"`.
     */
    jsrConfigPath?: string;

    /**
     * Extra arguments forwarded verbatim to `jsr publish` for the `jsr`
     * versionActions (the `jsr()` preset wires this from its `publishArgs` /
     * `allowSlowTypes` options). The most common entry is
     * `"--allow-slow-types"`, which JSR requires for packages whose public
     * API has types it can't statically infer. `--allow-dirty` is always
     * passed by vis (the version is bumped on disk before publish) and need
     * not be listed here.
     */
    jsrPublishArgs?: string[];
    /** Hard opt-in/out — overrides every other rule. */
    managed?: boolean;

    /**
     * Override the Maven Central metadata URL used by the `maven`
     * versionActions for already-published detection. Set this when
     * publishing to a custom repository (Artifactory, Nexus, GitHub
     * Packages); the URL should point at
     * `&lt;base>/&lt;groupId>/&lt;artifactId>/maven-metadata.xml`. Pass `""`
     * (empty string) to disable the metadata check entirely.
     */
    mavenMetadataUrl?: string;

    /**
     * Override the path to `pom.xml` for the `maven` versionActions,
     * relative to the package directory. Defaults to `"pom.xml"`.
     */
    pomPath?: string;
    /** Custom shell command run instead of `npm publish` (requires `allowCustomCommands`). */
    publishCommand?: string | string[];

    /**
     * Relative path from the package directory to the directory
     * containing `pyproject.toml` for the `python` versionActions.
     * Set automatically by the `pyproject()` preset from its
     * `projectDir` option. Defaults to the package directory.
     */
    pythonProjectDir?: string;
    /** Custom registry URL (overrides `publish.registry`). */
    registry?: string;

    /**
     * Override the workspace-wide releaseTagPattern.
     * Tokens: `{name}`, `{unscopedName}`, `{version}`, `{major}`, `{minor}`,
     * `{patch}`, `{date}`, `{channel}`.
     */
    releaseTagPattern?: string;
    /** Skip the npm publish step but still create a git tag. */
    skipNpmPublish?: boolean;

    /**
     * Relative path from the package directory (or workspace root, for
     * uv-workspace setups) to `uv.lock`. Set when the operator wants
     * vis to acknowledge a uv-managed lockfile during doctor checks.
     *
     * vis does NOT mutate `uv.lock` itself — uv regenerates it on
     * `uv sync` / `uv build`. The path is recorded only so doctor can
     * warn when the file is missing despite the operator configuring
     * uv-aware tooling. Operators wanting `uv.lock` in the release
     * commit should run `uv lock` between `vis release version` and
     * the commit step (typically wired via `postVersionCommand`).
     *
     * release-please parity: #2561.
     */
    uvLockPath?: string;

    /**
     * uv workspace configuration. When set, the `python` versionActions
     * and the `pyproject()` preset treat this package as a member of a
     * uv workspace rooted at `uvWorkspace.root` (relative to the package
     * directory — typically `".."` or the path up to the repo root).
     *
     * Doctor checks:
     *   - the root's pyproject.toml exists at `&lt;root>/pyproject.toml`
     *   - `[tool.uv.workspace] members` lists the package's project
     *     directory (relative path from the workspace root)
     *
     * Set automatically by the `pyproject({ uvWorkspace })` preset.
     *
     * release-please parity: #2560.
     */
    uvWorkspace?: { root: string };

    /**
     * Built-in id (`"npm"`, `"native-addon"`, `"private"`, `"shell"`,
     * `"cargo"`, `"python"`, `"maven"`, `"container"`, `"jsr"`) or a
     * path to a custom implementation module.
     */
    versionActions?: string;
}

// ── Workspace-wide config (the `release: {…}` block in vis.config.ts) ─

export interface CleanPackageJsonConfig {
    /** Fields to keep — overrides default strip behaviour. */
    keep?: string[];
    /** Fields to strip from the published package.json (extends defaults). */
    strip?: string[];
}

export type ProtocolResolutionMode = "pack" | "in-place" | "none";
export type CatalogResolutionMode = "auto" | "in-place" | "delegate";
export type PublishStrategy = "npm-publish-tarball" | "native";
export type PackManager = "auto" | "npm" | "pnpm" | "yarn" | "bun";

/**
 * Pre-publish security gates — run after the manifest is rewritten and the
 * tarball is packed but BEFORE `npm publish` is invoked. Each gate is opt-in;
 * defaults aim for "useful for new repos, easy to disable for established ones".
 */
export interface PublishGuardsConfig {
    /**
     * Run `npm audit --omit=dev` against the resolved package and fail at the
     * configured severity. Skips devDependency CVEs (which don't ship to
     * consumers). `"off"` disables.
     */
    audit?: "critical" | "high" | "low" | "moderate" | "off";

    /**
     * Verify every leaf path declared in `package.json#exports` /
     * `main` / `module` / `types` / `bin` exists post-build. Wildcard exports
     * (`./feat/*.js`) check that the directory is non-empty after build.
     *
     * Catches "deleted file but forgot to update exports" before publish.
     */
    exportsExist?: boolean;

    /**
     * Gate on lifecycle scripts (`preinstall` / `install` / `postinstall`)
     * declared on the package being published. These run on the consumer's
     * machine at install time, so unauthorized additions are a supply-chain
     * vector.
     *
     * Modes: `"off"` (skip), `"warn"` (log + continue), `"strict"` (fail).
     * Object form provides an exact-match `allow` table — only commands matching
     * the listed value pass through.
     */
    lifecycleScripts?: "off" | "strict" | "warn" | { allow?: Record<string, string>; mode: "off" | "strict" | "warn" };

    /**
     * Scan the resolved tarball contents (post `npm pack`) for secrets.
     * Catches `.npmignore`/`files` misconfigurations that would ship `.env`,
     * AWS keys, etc. Different scope than log redaction — this gates what
     * actually leaves the machine.
     *
     * `true` runs the default `@visulima/secret-scanner` ruleset.
     * Object form lets callers narrow the rule set or skip files.
     */
    packSecretScan?: boolean | { ignore?: string[] };
}

/**
 * Optional asset-attestation work done after a successful publish. Both
 * GitHub and GitLab adapters honor these knobs — GitHub uploads the .tgz
 * directly, GitLab uses the project upload endpoint registered as a release
 * link. SHA256/SHA512 are stamped into the release body either way so
 * consumers can verify the registry tarball matches the audited build.
 */

/**
 * Regex-based file-substitution rule used by `publish.extraFiles`
 * (workspace) or `packages.&lt;name>.extraFiles` (per-package) to keep
 * version strings in non-package.json files in sync with the release.
 */
export interface ExtraFileRegexRule {
    /** Regex flags (default `"g"`). Combine as needed: `"gm"`, `"gmi"`, etc. */
    flags?: string;

    /**
     * File path. Workspace-root-relative when declared on
     * `release.publish.extraFiles`; package-directory-relative when on
     * `release.packages.&lt;name>.extraFiles`.
     */
    path: string;

    /**
     * Substitution template. `{version}` is replaced with the new
     * version literal. Standard regex backreferences (`$1`, `$2`, `$&amp;`)
     * work too. When omitted, the entire match is replaced with the new
     * version.
     */
    replace?: string;
    /** JavaScript regex source (without delimiters). */
    search: string;

    /**
     * Explicit type discriminator. Defaults to `"regex"` when omitted —
     * legacy rules without a `type` field continue to work as regex rules.
     */
    type?: "regex";
}

/**
 * Annotation-comment file-substitution rule — release-please parity.
 *
 * Instead of authoring a regex, the operator drops an `x-release-please-
 * version` (or custom-named) marker comment in the target file and vis
 * locates the semver-shaped substring on the marked line (or the line
 * immediately following an own-line marker) and replaces it with the
 * new version. Far more ergonomic than the regex form for the common
 * case of "bump this version string here".
 *
 * Two recognised placements:
 *
 *   1. **Inline** — marker on the same line as the version:
 *      ```ts
 *      export const VERSION = "0.1.0"; // x-release-please-version
 *      ```
 *
 *   2. **Preceding-line** — marker on the line just above the version:
 *      ```dockerfile
 *      # x-release-please-version
 *      ENV APP_VERSION="0.1.0"
 *      ```
 *
 * Like the regex path, missing files / no marker found surface as
 * `plan.warnings` rather than throwing.
 */
export interface ExtraFileAnnotationRule {
    /**
     * Limit the semver-replacement to occurrences anchored by this
     * literal prefix on the marked line. Useful when the file has
     * multiple version-shaped substrings (e.g. a lockfile or a
     * Dockerfile referencing both APP_VERSION and a base-image tag).
     *
     * Example — `ENV APP_VERSION="0.1.0"` with `anchor: "APP_VERSION"`
     * only touches the version after that prefix. When omitted, the
     * FIRST semver substring on the marked line is replaced.
     *
     * **Strongly recommended** for any file that contains more than one
     * version-shaped substring (lockfiles, Dockerfiles with both APP
     * and base-image tags, multi-version compose files). The default
     * "first semver wins" behaviour is convenient for single-version
     * files but a footgun on lockfiles — annotating a `package-lock
     * .json` without an anchor would happily rewrite the first nested
     * dep's `version`.
     */
    anchor?: string;

    /**
     * Override the marker string. Default `"x-release-please-version"`
     * (release-please compatibility). Match is plain substring (no
     * regex), case-sensitive.
     */
    marker?: string;

    /**
     * File path. Workspace-root-relative when declared on
     * `release.publish.extraFiles`; package-directory-relative when on
     * `release.packages.&lt;name>.extraFiles`.
     */
    path: string;

    /**
     * Switch to annotation-comment mode. The substitution engine looks
     * for lines tagged with the configured marker — by default
     * `x-release-please-version` (release-please compatibility). The
     * marked line (or the line immediately following an own-line marker)
     * has its semver-shaped substring replaced with the new version.
     */
    type: "annotation";
}

/**
 * Union of every extra-files rule shape. The regex form is the historical
 * default; the annotation form was added for release-please ergonomics.
 *
 * When `type` is omitted, the rule is treated as a regex rule (preserves
 * backwards-compat for every existing vis.config.ts in the wild).
 */
export type ExtraFileRule = ExtraFileAnnotationRule | ExtraFileRegexRule;

export interface ReleaseAssetsConfig {
    /**
     * Compute SHA256 + SHA512 of the published tarball and append them to
     * the release body. Lets consumers verify the registry tarball matches
     * the audited build, defending against post-publish substitution.
     */
    stampHashes?: boolean;

    /**
     * Upload the published tarball as a release asset alongside the GH
     * release. Belt-and-suspenders alongside `stampHashes` — registry
     * tampering is detectable by hash comparison.
     */
    uploadTarball?: boolean;
}

export interface PublishConfig {
    /**
     * Semantic-release/github parity — when set, prepend ("top") or append
     * ("bottom") a "Related releases" block to the per-package GitHub release
     * body that links to the immediately previous N releases of the same
     * package. Aids navigation in the Releases UI ("what did 1.4.2 fix?" is a
     * single click from 1.5.0's release page).
     *
     * Honoured only on the GitHub adapter; GitLab logs a warning and skips
     * the block. Aggregate-release mode is skipped — there's no per-package
     * prior release to point at.
     *
     * Default `false` (no link block).
     */
    addReleases?: false | "bottom" | "top";
    /** How to resolve `catalog:` protocols. */
    catalogResolution?: CatalogResolutionMode;

    /** Strip/keep config for the published `package.json`. `false` ships unmodified. */
    cleanPackageJson?: boolean | CleanPackageJsonConfig;

    /**
     * GitHub-only: link each created release to a Discussion in the
     * named category (e.g. `"Announcements"`, `"Releases"`). The
     * category must already exist on the repository; GitHub creates the
     * discussion automatically. Ignored on GitLab.
     */
    discussionCategory?: string;

    /**
     * Create the forge release (GitHub Release / GitLab Release) as a
     * draft. A draft release is invisible to consumers until a human
     * publishes it through the UI — useful when release notes need a
     * human review before going public. Default `false`.
     *
     * Maps to GitHub's `draft: true` API field and GitLab's released_at
     * being absent (GitLab models drafts implicitly via no released_at).
     */
    draftRelease?: boolean;

    /**
     * Bump version strings in arbitrary files alongside package.json.
     * Each rule's `path` is workspace-root-relative; per-package rules
     * (under `packages.&lt;name>.extraFiles`) resolve relative to the
     * package directory.
     *
     * The `search` is a JavaScript regex source. Default `flags: "g"`
     * for global replacement. The `replace` template supports the
     * `{version}` token and standard regex backreferences (`$1`, `$2`,
     * `$&amp;`, etc.). When `replace` is absent, the entire match is
     * substituted with the new version.
     *
     * Examples — README badge, TS constant, Cargo.toml field:
     *   `{ path: "README.md", search: "v\\d+\\.\\d+\\.\\d+" }`
     *   `{ path: "src/version.ts", search: 'VERSION = "[^"]+"',
     *      replace: 'VERSION = "{version}"' }`
     *   `{ path: "Cargo.toml", search: '^version = "[^"]+"',
     *      replace: 'version = "{version}"', flags: "m" }`
     *
     * Failed matches are non-fatal — the publish carries on, but a
     * warning surfaces so misconfigured rules don't silently rot.
     */
    extraFiles?: ExtraFileRule[];
    /** Pre-publish security gates. Each gate is opt-in. */
    guards?: PublishGuardsConfig;

    /**
     * Skip creating the GitHub / GitLab Release entirely while still
     * pushing the git tag and publishing the package to the registry.
     * Useful for teams that maintain release notes elsewhere (a docs
     * site, in-product changelog, etc.) and don't want the duplicate
     * forge artifact.
     *
     * Default `false`. Release-please parity: #1295.
     */
    noRelease?: boolean;
    /** Which manager to invoke for `&lt;pm> pack`. */
    packManager?: PackManager;

    /**
     * Auth-precedence escape hatch for the multi-language actions
     * (cargo, python). Default `false`.
     *
     * Default behaviour (false): when both an OIDC env signal
     * (`ACTIONS_ID_TOKEN_REQUEST_URL`) AND a static token
     * (`CARGO_REGISTRY_TOKEN` / `TWINE_PASSWORD`) are present, OIDC
     * wins — an operator who enabled OIDC trusted publishing wants
     * OIDC by default and a leftover token in the env shouldn't
     * silently switch auth modes (M-3).
     *
     * Set `true` to flip the precedence: when both signals are
     * present, the static token wins. Useful for operators migrating
     * off OIDC, shadow-publishing during a cutover, or working around
     * a temporary trusted-publishing outage at the registry.
     */
    preferStaticToken?: boolean;
    /** How to resolve `workspace:` protocols. */
    protocolResolution?: ProtocolResolutionMode;
    /** Extra args appended to publish (`--provenance`, etc.). Skipped for managers that don't support them. */
    publishArgs?: string[];
    /** Publish strategy — see RFC §11.3. */
    publishStrategy?: PublishStrategy;
    /** Override default registry. */
    registry?: string;
    /** Post-publish asset attestation work. */
    releaseAssets?: ReleaseAssetsConfig;

    /**
     * Use npm's staged-publishing flow (`npm stage publish`) instead of
     * `npm publish`. The published version is invisible to consumers until
     * a maintainer approves it via 2FA (`vis release stage approve` or the
     * npmjs.com web UI). Requires npm CLI ≥ 11.15.0 and `registry.npmjs.org`
     * as the registry; doctor warns when those preconditions aren't met.
     *
     * Publish blocks on the human-review gate so downstream pipeline steps
     * (tags, GH release, post-hooks) only run against actually-live packages.
     * Rejection and timeout are NOT CI failures — they flow through the
     * skipped[] result so `vis release publish` exits 0; the unapproved
     * package just doesn't get its downstream side-effects.
     *
     * Pass `true` for defaults (30-min timeout, 15s poll). Pass an object
     * to override per-workspace. Snapshots always publish directly (preview
     * content shouldn't gate on review).
     */
    stage?:
        | boolean
        | {
            /**
             * Sleep between consecutive `npm stage view` checks while waiting.
             * Default: 15_000 (15 seconds).
             */
            pollIntervalMs?: number;

            /**
             * Hard deadline before the wait gives up and skips the publish.
             * Default: 1_800_000 (30 minutes).
             */
            timeoutMs?: number;
        };
}

export interface VersionPrConfig {
    /**
     * Auto-assign these users (logins) as the PR assignees on creation.
     * Existing assignees are preserved; this only adds. Defaults to
     * unassigned.
     */
    assignees?: string[];

    /**
     * Enable GitHub's auto-merge once status checks pass. Maps to
     * `gh pr merge --auto`. Requires the repo to have auto-merge
     * enabled in settings. Default `false`.
     */
    autoMerge?: boolean;

    /**
     * Merge strategy for auto-merge — defaults to `"squash"`. Honoured
     * only when `autoMerge: true`.
     */
    autoMergeMethod?: "merge" | "rebase" | "squash";

    /**
     * Periodically rebase the version-PR branch on top of `base` so
     * the PR doesn't drift behind. Default `false`. Enable when
     * the version-PR sits open for long periods and conflicts with
     * other PRs are likely. The actual rebase runs via
     * `vis release ci rebase-pr` (which the CI workflow can schedule
     * on a cron).
     */
    autoRebase?: boolean;
    branch?: string;
    /** Sentinel comment marker for sticky-update detection. */
    commentMarker?: string;

    /**
     * Labels applied to the version-PR. Defaults to `["autorelease: pending"]`.
     * Set to `[]` to disable. The label is added on every PR refresh —
     * external automation can rely on it being present until the
     * lifecycle moves on (`autorelease: tagged` post-publish, etc.).
     */
    labels?: string[];
    /** Markdown prepended to the PR body. */
    preamble?: string;

    /**
     * Auto-request reviews from these users / teams on PR creation.
     * Format: GitHub usernames or `org/team`. Existing reviewers are
     * preserved.
     */
    reviewers?: string[];
    title?: string;
}

export interface GitUserConfig {
    email: string;
    name: string;
}

/**
 * Post-release notification walk — semantic-release parity.
 *
 * **Default OFF.** Set `release.successWalk: {}` to opt in with defaults.
 * Leaving `successWalk` undefined in the workspace config is the explicit
 * "don't touch third-party PRs" stance — sticky comments and the
 * `released` label are an irreversible side effect on every PR mentioned
 * in a changelog body, so we never apply them implicitly.
 *
 * When opted in, after a successful publish wave vis walks every PR /
 * issue referenced in the rendered changelog entries and:
 *   1. Posts (or upserts) a sticky comment announcing the release version.
 *   2. Adds the configured labels (default `["released"]`).
 *
 * Failure to walk a single ref is non-fatal — the publish itself already
 * succeeded; we don't want a forge API blip rolling that back.
 */
export interface SuccessWalkConfig {
    /**
     * Comment body template posted on every referenced PR / issue. Tokens:
     *   - `{version}` — the published version (e.g. `1.2.0`)
     *   - `{name}`    — the published package name
     *   - `{tag}`     — the git tag created for this release
     *   - `{url}`     — the forge release URL when available
     *
     * Default mirrors semantic-release's `successComment`.
     */
    commentBody?: string;

    /**
     * Enable the walk. Default `true` when `successWalk` is present in
     * the config. Setting `enabled: false` is functionally equivalent to
     * omitting `successWalk` entirely (no walk runs) — the difference is
     * one of intent: an explicit `enabled: false` documents that the
     * operator has considered the walk and disabled it.
     *
     * Leaving `successWalk` undefined at the top level is the recommended
     * "off" stance — see the interface docstring.
     */
    enabled?: boolean;
    /** Labels added to every walked PR / issue. Default `["released"]`. */
    labels?: string[];

    /**
     * Skip the walk entirely on prerelease channels — the typical "don't
     * notify users their PR shipped in a beta" guardrail. Default `true`.
     */
    skipPrerelease?: boolean;
}

export interface VisReleaseConfig {
    /** Default npm `--access` flag. Default: `"public"`. */
    access?: "public" | "restricted";
    /** Suppress the unstable warning printed on first invocation (RFC §21.2). */
    acknowledgeUnstable?: boolean;
    /** Single GH release per wave vs per-package. */
    aggregateRelease?: boolean | { enabled: boolean; title?: string };

    /**
     * Pattern for the workspace-level aggregate release tag (when
     * `aggregateRelease.enabled`). Tokens: `{date}`, `{version}` (latest
     * bumped pkg's version). Default: `"release-{date}"`.
     */
    aggregateReleaseTagPattern?: string;
    /** Trust gate for per-package custom commands. */
    allowCustomCommands?: boolean | string[];
    /** Branch used for `--from` baseline in `status`/`generate`. Default: `"main"`. */
    baseBranch?: string;

    /**
     * Opt-in cascade for `devDependencies` bumps (changesets #944 parity).
     *
     * By default, when a workspace package is bumped, only its
     * `dependencies` / `peerDependencies` / `optionalDependencies`
     * consumers are considered for propagation — devDependency
     * consumers are silently ignored because consumers of the
     * dependent don't observe the devDep at runtime.
     *
     * Some teams disagree (especially for type-only packages or build
     * plugins) and want a devDep bump to still trigger a patch on its
     * consumer so the lockfile stays in sync across machines. Set this
     * to:
     *
     *   - `true` — every devDep cascade fires (patch-level on the
     *     dependent), regardless of the source package.
     *   - `string[]` — narrow allow-list of source package names. Only
     *     bumps to packages whose name appears in the list will cascade
     *     through devDependencies. Useful when only specific
     *     "infrastructure" packages should propagate via devDeps.
     *
     * Default: `false` (devDep cascades remain off — historical behaviour).
     */
    bumpDevDependencies?: boolean | string[];

    /**
     * For pre-1.0 versions, demote `major` bumps to `minor`. Common for
     * 0.x libraries that don't want their first breaking change to leap
     * to 2.0. Maps to release-please's `bump-minor-pre-major`. Default
     * `false`.
     */
    bumpMinorPreMajor?: boolean;

    /**
     * Companion to `bumpMinorPreMajor` — also demote `minor` bumps to
     * `patch` for pre-1.0 versions. Maps to release-please's
     * `bump-patch-for-minor-pre-major`. No-op without
     * `bumpMinorPreMajor`. Default `false`.
     */
    bumpPatchForMinorPreMajor?: boolean;
    /** Globs that count toward "package changed" detection. */
    changedFilePatterns?: string[];

    /**
     * Changelog formatter selection. Pass `false` to disable changelog output,
     * one of the built-in names (`"default"`, `"github"`, `"keep-a-changelog"`),
     * a path to a custom module, or a `[path, options]` tuple.
     */
    changelog?: false | string | [string, Record<string, unknown>];
    /** Directory holding change files. Default: `".vis/release"`. */
    changesDir?: string;
    /** Per-channel routing config (semantic-release-style). */
    channels?: Record<string, ChannelConfig>;

    /**
     * Source of truth for "what is the current version of this package?",
     * controlling how `oldVersion` is resolved when building the release plan.
     *
     *   `"disk"` (default) — read `package.json#version` (or the equivalent
     *       manifest field for non-npm versionActions). Preserves vis's
     *       historical behaviour and is the right choice when the manifest
     *       on disk is the canonical source.
     *   `"registry"` — query the package registry via the package's
     *       `versionActions.readPublishedVersion()`. Useful when the manifest
     *       drifts between repo and registry (e.g. teams that publish
     *       out-of-band) and you want the registry to win.
     *   `"git-tag"` — find the highest `releaseTagPattern`-matching tag in
     *       the current commit's ancestry and parse the version out of it.
     *       Matches nx's `git-tag` resolver and release-please's tag-based
     *       lookup.
     *
     * `"registry"` and `"git-tag"` fall back to the manifest version when
     * their primary source cannot produce a valid semver (e.g. registry 404
     * on a freshly-added package, no matching tag yet, etc.) and surface a
     * plan warning so the operator sees what happened.
     *
     * Overridable per-package via `packages.&lt;name>.currentVersionResolver`.
     *
     * The `--first-release` CLI flag is the bootstrap shortcut for this
     * setting — it forces `"disk"` regardless of config and additionally
     * skips remote-tag collision checks, so the very first run on a
     * greenfield monorepo can't trip over missing tags or registry 404s.
     */
    currentVersionResolver?: "disk" | "git-tag" | "registry";
    /** Default `release.managed` for unconfigured packages. Default: `false`. */
    defaultManaged?: boolean;
    /** Default dep-bump rules (overridable per-package). */
    dependencyBumpRules?: DependencyBumpRules;

    /**
     * Opt-in cascade for `pnpm-workspace.yaml` catalog version bumps
     * (changesets #1707 parity).
     *
     * pnpm's `catalog:` / `catalogs:` blocks let multiple packages
     * share a single version range. When the operator bumps a catalog
     * entry (e.g. `react: ^18.2.0` → `react: ^18.3.0`) every consumer
     * package pulls the new version on its next `pnpm install`. Without
     * detection, vis sees no change to the consumer's `package.json`
     * and skips it — so the published tarball ends up shipping a stale
     * `"react": "catalog:"` reference that resolves differently across
     * machines.
     *
     * When `true`, vis diffs `pnpm-workspace.yaml` between `HEAD~1`
     * (the previous release commit) and `HEAD` (working tree). Every
     * catalog dep that moved triggers a `patch` bump on each consumer
     * package, attributed as `BumpReason.CATALOG_CHANGED` in the
     * release plan. Set on the consumer's dep cascade rules to widen
     * the bump level via the same `dependencyBumpRules` knob used for
     * direct dependency bumps.
     *
     * Default: `false` (backwards-compat — the prior behaviour was to
     * silently ignore catalog changes during plan assembly).
     */
    detectCatalogChanges?: boolean;

    /**
     * Fixed groups: members share the same version, all bump on any change.
     *
     * Two accepted shapes (backwards-compatible — the original
     * `string[][]` keeps working):
     *
     *   - `string[]`            — bare list of package names / globs.
     *                             Implicitly `{ changelog: { mode: "per-package" } }`.
     *   - `{ packages, changelog }` — object form, lets you opt into a
     *                                 SHARED changelog file for the group
     *                                 (changesets #1059 parity). When
     *                                 `changelog.mode === "shared"`, every
     *                                 member's entry is rendered into one
     *                                 group file (default
     *                                 `&lt;first-member-dir>/GROUP-CHANGELOG.md`).
     */
    fixed?: ReleaseGroupConfig[];

    /**
     * Floating major-version tag. When `true`, every non-prerelease,
     * non-private release also force-updates a `&lt;safe-name>-v&lt;major>`
     * tag to point at the release commit. `safe-name` is the package
     * name with the leading `@` stripped and `/` replaced by `-`:
     *
     *   - `@acme/action` → `acme-action-v1`
     *   - `@vendor/cli`  → `vendor-cli-v1`
     *   - unscoped `cli` → `cli-v1`
     *
     * Useful for reusable GitHub Actions consumers who pin to
     * `acme/action@acme-action-v1` and expect automatic patch / minor
     * delivery without a tag-rev migration. The scope is included so
     * two packages with the same unscoped name from different scopes
     * (`@acme/cli` + `@vendor/cli`) don't both retarget the same
     * floating tag.
     *
     * Skipped on:
     *   - Prereleases (per-channel `prerelease` configured). The float
     *     would otherwise yank the major pointer across an unstable
     *     pre-release boundary.
     *   - Packages whose `releaseTagPattern` already includes `{major}`
     *     (the pattern is already serving the same role).
     *   - Private packages (`package.json#private === true`) and
     *     packages that set `skipNpmPublish: true` — there's no
     *     published artifact for a consumer to pin against, so a
     *     floating tag would just clutter the tag history.
     *
     * Default: `false`. Semantic-release parity: #1515.
     */
    floatingMajorTag?: boolean;

    /**
     * Run the project's Prettier over the files the version step writes
     * (package.json bumps + CHANGELOG.md entries) before committing them
     * (RFC §14 step 7). Scoped to the changed files only — never the whole
     * tree. Resolves the project's own Prettier from the workspace root;
     * soft-fails if Prettier isn't installed.
     *
     * Default: `false` (opt-in — a project that doesn't use Prettier, or
     * whose Prettier config conflicts with how vis writes JSON, leaves this
     * off).
     */
    formatChangedFiles?: boolean;

    /**
     * Self-hosted GitHub Enterprise host (e.g. `"github.acme.com"` — no
     * scheme). Translates to the `GH_HOST` env var that the `gh` CLI
     * consumes natively, so all adapter calls land on the right
     * instance. Operators can also export `GH_HOST` directly; this
     * config knob is the typed, vis.config.ts-discoverable equivalent.
     * Ignored when `provider` resolves to anything other than `github`.
     */
    githubHost?: string;

    /**
     * Self-hosted GitLab host (e.g. `"gitlab.example.com"`). Translates to
     * the `GITLAB_HOST` env var that `glab` consumes natively, so all
     * adapter calls land on the right instance. Ignored when `provider`
     * resolves to anything other than `gitlab`.
     */
    gitlabHost?: string;

    /**
     * Sign release-flow commits with `git commit -S`. Set to `true` in
     * workspaces that enforce `commit.gpgsign = true`. The active git
     * identity must have a configured signing key (gpg, ssh, x509).
     * Default `false`.
     */
    gitSignCommits?: boolean;
    /** Git committer identity used by CI workflows. */
    gitUser?: GitUserConfig;

    /**
     * Group-scoped preVersion command. Runs once before any package in the
     * group is versioned. `groupName` matches a `fixed`/`linked` array's index
     * (group-0, group-1, …) or a named entry (future).
     */
    groupPreVersionCommands?: Record<string, string>;

    /**
     * HTTPS proxy URL (e.g. `"http://proxy.acme.com:8080"`) for
     * enterprise networks that route outbound HTTPS through a proxy.
     *
     * Wired through to two surfaces:
     *
     *   1. `gh` / `glab` CLI subprocesses get `HTTPS_PROXY` and
     *      `HTTP_PROXY` set on their env so they tunnel through the
     *      proxy exactly as if the operator had exported the vars
     *      manually.
     *
     *   2. Every internal `fetch()` call (registry probes in
     *      version-actions/{cargo,python,maven,container}.ts and the
     *      shared `safeFetchVersionMetadata` helper) attaches an undici
     *      `ProxyAgent` via the `dispatcher` option, so Node's built-in
     *      fetch routes through the proxy as well.
     *
     * Node 22's bundled undici handles the proxy plumbing — no
     * `https-proxy-agent` dep needed.
     */
    httpProxy?: string;

    /** Globs of packages to exclude from release entirely. */
    ignore?: string[];
    /** Globs that override `ignore` and `private` exclusion. */
    include?: string[];

    /**
     * Linked groups: members share bump levels but only changed members
     * publish. Accepts the same dual-shape format as `fixed` — see the
     * `ReleaseGroupConfig` doc comment for details.
     */
    linked?: ReleaseGroupConfig[];

    /**
     * Notifications — post-release fan-out to chat / webhook
     * destinations. See {@link NotificationsConfig}. Each channel
     * runs in parallel; per-channel failures log a warning but do NOT
     * fail the publish.
     */
    notifications?: NotificationsConfig;

    /**
     * Emit one release commit per package (a `release(channel): pkg@version
     * [skip ci]` message) instead of a single aggregate commit for the whole
     * wave (RFC §19.5). Mirrors the per-package commit history that
     * multi-semantic-release produced — useful for projects migrating off it
     * that want to preserve `git log` shape. Only honoured when
     * `aggregateRelease` is falsy. Shared artifacts (lockfile + consumed
     * change-file deletions) ride along in the final package's commit.
     *
     * Default: `false` (one aggregate commit per wave).
     */
    oneCommitPerPackage?: boolean;
    /** Per-package overrides (matches `package.json["vis-release"]`). */
    packages?: Record<string, PerPackageReleaseConfig>;
    /** Shell command run after all publishes complete. */
    postPublishCommand?: string;
    /** Shell command run after versioning, before publish. */
    postVersionCommand?: string;
    /** Shell command run after versioning, before publish. */
    prePublishCommand?: string;
    /** Shell command run before any versioning. */
    preVersionCommand?: string;
    /** Whether to version + tag private packages. */
    privatePackages?: { tag: boolean; version: boolean };
    /** Forge provider for remote operations (PR comments, releases, version PRs). */
    provider?: "github" | "gitlab" | "auto";
    /** Publish-related config. */
    publish?: PublishConfig;

    /**
     * Wrap each per-package GitHub / GitLab release body with operator-
     * supplied header / footer text. Common use: link a migration guide
     * above the auto-generated body, or paste a sponsorship blurb below.
     *
     * Both fields are template strings supporting tokens:
     *   - `{name}` — package name
     *   - `{version}` — new version
     *   - `{previousVersion}` — previous version
     *   - `{date}` — `YYYY-MM-DD`
     *   - `{repo}` — `owner/repo` slug
     *   - `{contributors}` — bullet list of authors collected from the
     *     entire wave's change-file `author:` frontmatter (release-please
     *     #292). Wave-scoped — every per-package release in the wave
     *     sees the same set, so cascade and dependency-only bumps still
     *     credit the upstream author. Block-only — keep this token on
     *     its own line, typically under a heading; inline use like
     *     `Thanks {contributors}!` will produce broken markdown.
     *     Authors are de-duplicated case-insensitively, markdown-escaped,
     *     and filtered through the github formatter's `internalAuthors`
     *     list (when configured). Empty string when no change file in
     *     the wave declared an author.
     *
     * When set, the rendered body is composed as `header\n\n&lt;body>\n\nfooter`.
     * Empty / unset fields are skipped (no leading / trailing blank line).
     *
     * > **Aggregate-release mode (`release.aggregateRelease: true`)**: the
     * > header and footer are NOT applied. The aggregate release body is
     * > already operator-templated via `release.aggregateRelease.title`
     * > and the per-package list is auto-rendered. If you want a custom
     * > prefix/suffix on the aggregate body, override
     * > `release.aggregateRelease.title` directly.
     *
     * Release-please parity: #1274.
     */
    releaseNoteTemplate?: { footer?: string; header?: string };

    /**
     * Git tag template — overridable per-package via
     * `package.json["vis-release"]["releaseTagPattern"]`.
     * Tokens: `{name}`, `{unscopedName}`, `{version}`, `{major}`, `{minor}`,
     * `{patch}`, `{date}`, `{channel}`. Default: `"{name}@{version}"`.
     */
    releaseTagPattern?: string;

    /**
     * Sign release tags. Wraps `git tag -s` / `-u &lt;key>` and adds a
     * `gitsign`-based code path for sigstore-style keyless signing.
     *
     * Modes:
     *   - `"gpg"`      — `git tag -s` (or `-u &lt;key>` when `key` is set).
     *                    Relies on `user.signingkey` in git config.
     *   - `"ssh"`      — Same `-s` flag, but the operator must have
     *                    `gpg.format=ssh` + `user.signingkey=&lt;path-to-key>`
     *                    configured. Doctor surfaces missing config with a
     *                    warning at preflight.
     *   - `"sigstore"` — Experimental ("preview"). Uses `gitsign` when on
     *                    PATH, otherwise falls back to GPG with a warning.
     *
     * Per-package signing is not supported (release tags are a workspace-
     * wide artefact). Default: undefined (no signing).
     *
     * Release-please parity: #1738, #1314.
     */
    signing?: { key?: string; mode: "gpg" | "sigstore" | "ssh" };
    /** Snapshot config. */
    snapshot?: SnapshotConfig;

    /**
     * Post-release notification walk. Configures the
     * "🎉 This is included in version X.Y.Z" comment + `released` label
     * pass that runs after a successful publish wave.
     *
     * **Default OFF.** Leave undefined and the walk never runs — vis
     * will not touch third-party PRs referenced in changelog bodies.
     * Set to `{}` to opt in with defaults, or pass an object to override
     * the comment template / labels / prerelease behaviour.
     */
    successWalk?: SuccessWalkConfig;
    /** Dep-propagation mode. Default: `"out-of-range"`. */
    updateInternalDependencies?: UpdateInternalDependenciesMode;
    /** Version-PR config. */
    versionPr?: VersionPrConfig;

    /**
     * Workspace-level changelog config (RFC §6.1 / nx parity).
     * When set, renders one CHANGELOG.md at the workspace root in addition
     * to per-package files.
     */
    workspaceChangelog?: false | { file?: string; waveHeading?: string };
}

// ── Process-level concurrency lock (`<changesDir>/.lock`) ──────────

export interface LockInfo {
    acquiredAt: string;

    /**
     * `os.hostname()` of the process that acquired the lock. PIDs are
     * meaningless across hosts (CI runners reuse PIDs across containers),
     * so foreign-host lockfiles are treated as automatically stale.
     */
    hostname?: string;
    pid: number;
    /** `process.platform` — recorded for debugging stale lock takeovers. */
    platform?: string;
}

// ── State file (`<changesDir>/.state.json`) ─────────────────────────

export interface StateFile {
    /** Versions written to disk. */
    applied: string[];
    channel?: string;

    /**
     * Packages already notified to chat / webhook channels in a prior
     * wave. Keyed by `${name}@${version}` so a `--resume` after a
     * partial failure doesn't re-fire Slack pings for releases that
     * already shipped + notified on run 1. Empty on a fresh wave.
     */
    notified?: string[];
    plan: PlannedRelease[];
    /** Tarballs uploaded to the registry. */
    published: string[];
    /** Whether `git push --tags` succeeded. */
    pushed: boolean;
    startedAt: string;

    /** Local git tags created. */
    tagged: string[];
    version: 1;

    /**
     * Packages whose successWalk (per-PR sticky comment + label) has
     * already fired. Tracked alongside `notified` for the same reason:
     * `--resume` after a partial failure should not re-walk the PRs
     * for releases already commented on. The sticky-comment marker
     * provides idempotency at the forge level too, but skipping the
     * walk entirely saves the rate-limited API calls.
     */
    walked?: string[];
}

// ── Staged-publish registry (`<changesDir>/staged.json`) ─────────────

/**
 * One pending staged publish — a tarball uploaded to npm but not yet
 * approved by a maintainer. Tracked across runs so a follow-up wave
 * can refuse to re-version the same package, and so
 * `vis release stage approve --all` can drain everything from a single
 * file regardless of which CI run created the stage.
 */
export interface PendingStage {
    /** Stage id returned by `npm stage publish`. */
    id: string;
    /** Package name (e.g. `@scope/pkg`). */
    name: string;
    /** Reason the stage is still pending. */
    reason: "rejected" | "timeout";
    /** ISO-8601 timestamp when the stage was recorded. */
    stagedAt: string;
    /** dist-tag the stage targets (`latest`, `next`, …). */
    tag?: string;
    /** Version being staged. */
    version: string;
}

/**
 * Tracked, committed file: `.vis/release/staged.json`.
 *
 * Lives in git so pending stages survive CI runner churn and branch
 * switches. The release flow auto-commits this file after every publish
 * wave with `[skip ci]` to avoid loops.
 */
export interface StagedRegistryFile {
    pending: PendingStage[];

    /**
     * Packages already notified to chat / webhook channels — survives
     * CI runner churn (a fresh runner clones the repo and reads this
     * tracked file, instead of relying on the gitignored `.state.json`
     * which only the originating runner can see).
     *
     * Keyed by `${name}@${version}`. Pruned to the last 30 days OR last
     * 100 entries per write, whichever is smaller, so the registry
     * doesn't grow unboundedly on long-lived workspaces.
     */
    recentlyNotified?: { at: string; key: string }[];

    /**
     * Packages already walked (PR/issue sticky comment + `released`
     * label posted) — same cross-runner concern as `recentlyNotified`.
     */
    recentlyWalked?: { at: string; key: string }[];
    /** ISO-8601 timestamp of the last write. */
    updatedAt: string;
    version: 1;
}
