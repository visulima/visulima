/**
 * `RemoteReleaseClient` — provider-agnostic remote operations.
 *
 * Why this exists: visulima's CI today is GitHub-only, but the release
 * subsystem is designed to be reusable across projects, so the bits that
 * touch a forge (PR comments, version PRs, releases) live behind this
 * interface. v1 ships complete `github` and stub `gitlab` implementations.
 *
 * Detection: vis.config.ts `release.provider` (`"github" | "gitlab" |
 * "auto"`). Auto-detection inspects the git remote URL.
 *
 * Modeled on nx release's `RemoteReleaseClient` shape so future v2
 * features (e.g. project-level releases) compose cleanly.
 */

import type { CommandRunner } from "../package-managers/interface";

export type RemoteProvider = "github" | "gitlab";

/**
 * Structured release-asset metadata. Provider adapters interpret each field
 * to the closest supported concept:
 *
 *   GitHub: `path` is uploaded; `label` and `name` are honored as the
 *           asset's display name. `linkUrl` and `type` are ignored
 *           (GitHub Releases don't model link-only assets distinctly).
 *
 *   GitLab: behavior depends on `target`:
 *           - `"project_upload"` (default): `path` uploaded via the
 *             project upload endpoint and registered as a release link.
 *           - `"generic_package"`: `path` uploaded to GitLab's Generic
 *             Package Registry under `&lt;packageName>/&lt;packageVersion>`,
 *             then registered as a release link. Requires `packageName`
 *             when the project name doesn't match the desired package
 *             slug.
 *           `linkUrl` is registered directly without an upload (useful
 *           for container/registry images). `type` maps to GitLab's
 *           `link_type` enum.
 *
 * Either `path` or `linkUrl` must be present.
 */
export interface ReleaseAsset {
    /** Display label. Falls back to filename for `path`. */
    label?: string;
    /** Pre-existing URL to register as a release link (no upload). */
    linkUrl?: string;
    /** Override the asset name. Adapters may default it from `path`/`linkUrl`. */
    name?: string;

    /**
     * Generic Package Registry: package slug. Defaults to the project name
     * (`&lt;group>/&lt;repo>` → `&lt;repo>`). Ignored unless `target` is
     * `"generic_package"`.
     */
    packageName?: string;

    /**
     * Generic Package Registry: package version. Defaults to the release
     * tag stripped of a leading `v`. Ignored unless `target` is
     * `"generic_package"`.
     */
    packageVersion?: string;
    /** Local file path to upload. Mutually exclusive with `linkUrl`. */
    path?: string;

    /**
     * GitLab-only upload target. Default `"project_upload"` registers the
     * file as a project upload + release link. `"generic_package"` uses
     * the Generic Package Registry — useful for binaries you want to pin
     * via package URLs that survive past release deletion.
     */
    target?: "generic_package" | "project_upload";
    /** GitLab `link_type`. Ignored on GitHub. */
    type?: "image" | "other" | "package" | "runbook";
}

export interface UpsertStickyCommentOptions {
    body: string;
    cwd: string;
    /** PR / MR number. */
    issueNumber: number;
    /** Sentinel marker — comments containing this string are updated; otherwise a new one is created. */
    marker: string;
    /** "owner/name" — provider-specific format. */
    repo: string;
}

export interface UpsertCommentResult {
    created: boolean;
    id: number;
}

export interface CreateReleaseOptions {
    /**
     * Release assets — accepts plain string paths (legacy) or full
     * {@link ReleaseAsset} entries with metadata. Failure to upload an asset
     * is non-fatal; the release itself succeeds first.
     */
    assets?: (ReleaseAsset | string)[];
    /** Release body / notes (Markdown). */
    body: string;
    cwd: string;

    /**
     * GitHub-only: link the release to a Discussion in the named category.
     * Ignored on GitLab.
     */
    discussionCategory?: string;
    /** Mark as draft. */
    draft?: boolean;

    /**
     * GitLab-only: associate the release with one or more milestones (by
     * title). GitLab auto-closes milestones when a release lands. Ignored on
     * GitHub.
     */
    milestones?: string[];
    /** Mark as prerelease. */
    prerelease?: boolean;
    repo: string;
    /** Git tag the release points at. */
    tag: string;
    /** Release title (display name). */
    title: string;
}

export interface CreateReleaseResult {
    /** Release URL. */
    url?: string;
}

export interface UpsertPullRequestOptions {
    /** Branch the PR targets. */
    base: string;
    body: string;
    cwd: string;
    /** Branch the PR is from. */
    head: string;
    repo: string;
    title: string;
}

export interface UpsertPullRequestResult {
    existing: boolean;
    number: number;
    url?: string;
}

export interface AddLabelsOptions {
    cwd: string;
    /** Issue or PR/MR number. */
    issueNumber: number;
    labels: string[];
    repo: string;
}

export interface UpsertIssueOptions {
    /** GitHub: array of usernames. GitLab: assigns the first entry only. */
    assignees?: string[];
    body: string;
    cwd: string;
    labels?: string[];
    /** Marker text used to find an existing issue (matched in title). */
    marker: string;
    repo: string;
    title: string;
}

export interface UpsertIssueResult {
    created: boolean;
    number: number;
    url?: string;
}

export interface CloseIssueOptions {
    /** Optional comment posted before closing. */
    closingComment?: string;
    cwd: string;
    issueNumber: number;
    repo: string;
}

/**
 * Options for {@link RemoteReleaseClient.listRecentReleases}. Used by
 * the `publish.addReleases` block to enumerate the previous releases of
 * the same package and embed links in the new release body.
 */
export interface ListRecentReleasesOptions {
    cwd: string;

    /**
     * Exclude releases whose tag equals this value. Used to skip the
     * release currently being created so it never shows up in its own
     * "Related releases" block.
     */
    excludeTag?: string;

    /**
     * Cap on how many recent releases the adapter should return after
     * filtering. Adapters may over-fetch from the forge and trim to this
     * size — callers typically pass 3-5.
     */
    limit: number;
    repo: string;

    /**
     * Filter releases to only those whose tag starts with this prefix.
     * For per-package tag patterns like `@scope/pkg@1.5.0`, callers pass
     * `@scope/pkg@` so unrelated packages' releases don't leak in.
     * Empty string disables filtering (single-package repos).
     */
    tagPrefix?: string;
}

/** One forge release returned by {@link RemoteReleaseClient.listRecentReleases}. */
export interface RecentRelease {
    name: string;
    tag: string;
    url: string;
}

export interface RemoteReleaseClient {
    /**
     * Add labels to an existing issue/PR/MR. Stable across resolved-issue
     * post-release labelling (`released`) and failure-issue triaging.
     */
    addLabels: (runner: CommandRunner, options: AddLabelsOptions) => Promise<boolean>;

    /**
     * Close an issue, optionally leaving a final comment. Used to
     * automatically close failure issues once a subsequent release succeeds.
     */
    closeIssue: (runner: CommandRunner, options: CloseIssueOptions) => Promise<boolean>;

    /** Create a release (GitHub Releases / GitLab Releases). */
    createRelease: (runner: CommandRunner, options: CreateReleaseOptions) => Promise<CreateReleaseResult | undefined>;

    /**
     * Resolve the active PR/MR number from the CI environment.
     * GitHub: `GITHUB_REF=refs/pull/N/{merge,head}` or `PR_NUMBER`.
     * GitLab: `CI_MERGE_REQUEST_IID`.
     */
    detectPullRequestNumber: (env: NodeJS.ProcessEnv) => number | undefined;

    /** Resolve the canonical "owner/name" from the cwd's git remote. */
    detectRepoSlug: (cwd: string, runner: CommandRunner) => Promise<string | undefined>;

    /**
     * Stable provider id. Built-ins use the `RemoteProvider` values
     * (`"github"`, `"gitlab"`); custom providers may use any other string.
     */
    readonly id: string;

    /**
     * Enumerate the most recent releases on the repository, optionally
     * filtered by tag prefix. Used by `publish.addReleases` to embed
     * cross-version navigation links in the new release body. Returns
     * `[]` (and may log a warning) when the adapter doesn't support the
     * operation (current GitLab behaviour).
     */
    listRecentReleases: (
        runner: CommandRunner,
        options: ListRecentReleasesOptions,
    ) => Promise<RecentRelease[]>;

    /**
     * Find-by-marker-or-create an issue, used for "release failed" reports.
     * If an open issue with `marker` in its title exists, the body is
     * updated; otherwise a new issue is opened.
     */
    upsertIssue: (runner: CommandRunner, options: UpsertIssueOptions) => Promise<UpsertIssueResult | undefined>;

    /** Find or create a pull/merge request from `head` → `base`. */
    upsertPullRequest: (runner: CommandRunner, options: UpsertPullRequestOptions) => Promise<UpsertPullRequestResult | undefined>;

    /** Post or update a sticky comment using the marker pattern (RFC §13.3). */
    upsertStickyComment: (runner: CommandRunner, options: UpsertStickyCommentOptions) => Promise<UpsertCommentResult | undefined>;
}
