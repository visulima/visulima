/**
 * Browser URL shapes per remote provider — the `…/issues/123`, `…/pull/42`,
 * `…/commit/&lt;sha>` and `…/compare/a...b` links the changelog formatters embed.
 *
 * These live next to the provider clients rather than in `changelog/` because
 * the shapes are a property of the forge, not of a formatter: GitLab nests
 * every repo-scoped page under `/-/` and calls a pull request a merge request.
 * A changelog rendered for a GitLab remote must never link into github.com —
 * a link pointing at a *different* repository that happens to share the slug
 * is worse than no link at all.
 *
 * Everything that talks to a forge over the network lives on the
 * `RemoteReleaseClient` interface; these are pure string builders with no I/O,
 * so they stay a plain lookup keyed by the same {@link RemoteProvider} union
 * rather than another member on that interface.
 */

import type { RemoteProvider } from "./interface";

/** Public web host per provider, used when no self-hosted base is configured. */
const DEFAULT_WEB_ORIGIN: Record<RemoteProvider, string> = {
    github: "https://github.com",
    gitlab: "https://gitlab.com",
};

/** Browser URL builders for one repository on one provider. */
export interface RemoteWebUrls {
    /** Commit page for `sha`. */
    commit: (sha: string) => string;

    /** Two-dot comparison page between two refs (used with release tags). */
    compare: (fromReference: string, toReference: string) => string;

    /** Issue page. */
    issue: (issueNumber: string) => string;

    /** Pull request page — a *merge* request on GitLab. */
    pullRequest: (pullNumber: string) => string;
}

/**
 * Build the web URLs for `repo` (an `owner/name` slug, or a nested
 * `group/sub/project` path on GitLab) on `provider`.
 *
 * Self-hosted instances are not modelled here: the changelog path never learns
 * the configured `githubHost` / `gitlabHost`, and the `compareUrlPrefix`
 * formatter option is the documented escape hatch for one.
 */
export const remoteWebUrls = (provider: RemoteProvider, repo: string): RemoteWebUrls => {
    const root = `${DEFAULT_WEB_ORIGIN[provider]}/${repo}`;
    // GitLab namespaces every repo-scoped page under `/-/` so a nested group
    // path can never collide with a route name.
    const scope = provider === "gitlab" ? `${root}/-` : root;

    return {
        commit: (sha: string): string => `${scope}/commit/${sha}`,
        compare: (fromReference: string, toReference: string): string => `${scope}/compare/${fromReference}...${toReference}`,
        issue: (issueNumber: string): string => `${scope}/issues/${issueNumber}`,
        pullRequest: (pullNumber: string): string => `${scope}/${provider === "gitlab" ? "merge_requests" : "pull"}/${pullNumber}`,
    };
};
