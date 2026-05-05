import { readFile } from "node:fs/promises";

/**
 * Resolved CI environment context for the self-healing-CI flow.
 *
 * Three providers are supported: GitHub Actions, GitLab CI, and
 * Buildkite. The shape is generic enough to cover all three — `repo`
 * carries the provider-native project identifier (`owner/repo` on GH,
 * numeric or `namespace/project` on GL, `{org}/{pipeline}` on
 * Buildkite) and `apiBaseUrl` lets self-hosted GitLab / Buildkite
 * Enterprise route to the correct API host. Adding more providers
 * (Bitbucket, Azure DevOps) is additive: extend `detectCiContext`
 * with a new branch and let the comment poster dispatch on `provider`.
 */
export interface CiContext {
    /**
     * Provider-specific API base.
     * - GitHub Actions: `undefined` (always `https://api.github.com`).
     * - GitLab CI: `https://gitlab.example.com/api/v4` (from `CI_API_V4_URL`).
     * - Buildkite: `https://api.buildkite.com` by default; honours
     *   `BUILDKITE_API_BASE_URL` when set (Buildkite Enterprise self-hosted).
     */
    apiBaseUrl: string | undefined;

    /**
     * Buildkite-only: build UUID (`BUILDKITE_BUILD_ID`). Used as the
     * `buildkite-agent annotate --context` value so reruns of the same
     * build update the existing annotation instead of stacking a new one.
     * `undefined` for non-Buildkite providers.
     */
    buildId: string | undefined;

    /**
     * Buildkite-only: build number (`BUILDKITE_BUILD_NUMBER`). Used in
     * the annotations REST endpoint URL. `undefined` for non-Buildkite
     * providers.
     */
    buildNumber: number | undefined;

    /** Best-effort PR / MR number; `undefined` for push-event runs. */
    prNumber: number | undefined;
    provider: "buildkite" | "github-actions" | "gitlab-ci" | "unknown";

    /**
     * Provider-native project identifier:
     * - GitHub: `owner/repo` (consumed verbatim by `gh --repo`).
     * - GitLab: URL-encoded `namespace/project` *or* numeric project ID
     *   (the GitLab REST API accepts both).
     * - Buildkite: `{organization-slug}/{pipeline-slug}` — used to build
     *   the REST annotations endpoint, not for `gh`-style CLI calls.
     */
    repo: string | undefined;
    /** Commit SHA the run is anchored to (head SHA in PRs, push SHA otherwise). */
    sha: string | undefined;

    /**
     * Token used to post comments / annotations.
     * - GitHub: `GITHUB_TOKEN` (auto-injected on hosted runners).
     * - GitLab: `GITLAB_TOKEN` or `CI_TOKEN` — explicitly NOT `CI_JOB_TOKEN`.
     * - Buildkite: `BUILDKITE_API_TOKEN` (user-provided, with
     *   `write_build_annotations` scope) — only needed for the REST
     *   fallback. The `buildkite-agent annotate` CLI path uses the
     *   auto-injected `BUILDKITE_AGENT_ACCESS_TOKEN` directly and
     *   needs no explicit token plumbing.
     */
    token: string | undefined;
}

interface GithubEventPayload {
    issue?: { number?: number };
    number?: number;
    pull_request?: { head?: { sha?: string }; number?: number };
}

const parsePrNumberFromGithubRef = (ref: string | undefined): number | undefined => {
    if (!ref) {
        return undefined;
    }

    // GitHub sets GITHUB_REF to "refs/pull/<n>/merge" or "refs/pull/<n>/head"
    // for pull_request events. Other event types use "refs/heads/<branch>"
    // and won't match this pattern.
    const match = /^refs\/pull\/(\d+)\//.exec(ref);

    return match ? Number.parseInt(match[1]!, 10) : undefined;
};

const readPrNumberFromGithubEvent = async (eventPath: string | undefined): Promise<{ prNumber: number | undefined; sha: string | undefined }> => {
    if (!eventPath) {
        return { prNumber: undefined, sha: undefined };
    }

    try {
        const raw = await readFile(eventPath, "utf8");
        const payload = JSON.parse(raw) as GithubEventPayload;

        // pull_request events nest under .pull_request.number; issue_comment
        // events on a PR use .issue.number; the bare .number field exists on
        // some webhook shapes too. Try in that order so we land on the most
        // PR-specific value first.
        const prNumber = payload.pull_request?.number ?? payload.issue?.number ?? payload.number;
        const sha = payload.pull_request?.head?.sha;

        return { prNumber, sha };
    } catch {
        return { prNumber: undefined, sha: undefined };
    }
};

const detectGithubActions = async (env: NodeJS.ProcessEnv): Promise<CiContext> => {
    const refPrNumber = parsePrNumberFromGithubRef(env.GITHUB_REF);
    const { prNumber: payloadPrNumber, sha: payloadSha } =
        refPrNumber === undefined ? await readPrNumberFromGithubEvent(env.GITHUB_EVENT_PATH) : { prNumber: refPrNumber, sha: undefined };

    return {
        apiBaseUrl: undefined,
        buildId: undefined,
        buildNumber: undefined,
        prNumber: refPrNumber ?? payloadPrNumber,
        provider: "github-actions",
        repo: env.GITHUB_REPOSITORY,
        // Prefer the PR head SHA from the event payload over GITHUB_SHA — for
        // pull_request events GITHUB_SHA is the synthetic merge commit, which
        // is not what reviewers see in the PR diff.
        sha: payloadSha ?? env.GITHUB_SHA,
        token: env.GITHUB_TOKEN,
    };
};

const detectGitlabCi = (env: NodeJS.ProcessEnv): CiContext => {
    const mrIid = env.CI_MERGE_REQUEST_IID;
    const prNumber = mrIid !== undefined && mrIid !== "" ? Number.parseInt(mrIid, 10) : undefined;

    // GitLab provides CI_API_V4_URL even on gitlab.com runs (set to
    // https://gitlab.com/api/v4) — so we don't need to special-case
    // self-hosted vs SaaS, the env var carries it for both.
    const apiBaseUrl = env.CI_API_V4_URL;

    // Comments require a personal/project access token with `api` scope.
    // The auto-injected CI_JOB_TOKEN cannot post MR notes, so we look
    // for explicitly-provided tokens (in order: GITLAB_TOKEN → CI_TOKEN).
    // CI_JOB_TOKEN is intentionally NOT included as a fallback because
    // POSTing notes with it returns 401, and a clearer error from the
    // REST layer is more helpful than an opaque auth failure.
    const token = env.GITLAB_TOKEN ?? env.CI_TOKEN;

    return {
        apiBaseUrl,
        buildId: undefined,
        buildNumber: undefined,
        prNumber: Number.isFinite(prNumber) ? prNumber : undefined,
        provider: "gitlab-ci",
        // GitLab accepts URL-encoded namespace/project or numeric ID.
        // CI_PROJECT_ID is more reliable when the project has been
        // renamed; CI_PROJECT_PATH is more readable. Prefer the ID.
        repo: env.CI_PROJECT_ID ?? env.CI_PROJECT_PATH,
        sha: env.CI_COMMIT_SHA,
        token,
    };
};

const detectBuildkite = (env: NodeJS.ProcessEnv): CiContext => {
    // Buildkite stores the originating PR number as a string in
    // BUILDKITE_PULL_REQUEST. The literal "false" appears for non-PR
    // builds (push events, scheduled builds, manual triggers). Anything
    // else parses as a numeric PR ID from the upstream VCS.
    const rawPr = env.BUILDKITE_PULL_REQUEST;
    const prNumber = rawPr !== undefined && rawPr !== "" && rawPr !== "false" ? Number.parseInt(rawPr, 10) : undefined;

    const rawBuildNumber = env.BUILDKITE_BUILD_NUMBER;
    const buildNumber = rawBuildNumber !== undefined && rawBuildNumber !== "" ? Number.parseInt(rawBuildNumber, 10) : undefined;

    // The annotations REST endpoint takes {org-slug}/{pipeline-slug}/{build-number}.
    // Compose the org+pipeline pair into `repo` so the comment poster
    // can build the URL without a Buildkite-only field.
    const org = env.BUILDKITE_ORGANIZATION_SLUG;
    const pipeline = env.BUILDKITE_PIPELINE_SLUG;
    const repo = org !== undefined && org !== "" && pipeline !== undefined && pipeline !== "" ? `${org}/${pipeline}` : undefined;

    // Buildkite Enterprise self-hosted instances proxy api.buildkite.com
    // through a customer-controlled host. There's no canonical env var,
    // so we honour BUILDKITE_API_BASE_URL when set and fall back to the
    // SaaS URL. Trim any trailing slash so callers can append paths cleanly.
    const apiBaseUrl = (env.BUILDKITE_API_BASE_URL ?? "https://api.buildkite.com").replace(/\/+$/, "");

    return {
        apiBaseUrl,
        buildId: env.BUILDKITE_BUILD_ID,
        buildNumber: Number.isFinite(buildNumber) ? buildNumber : undefined,
        prNumber: Number.isFinite(prNumber) ? prNumber : undefined,
        provider: "buildkite",
        repo,
        sha: env.BUILDKITE_COMMIT,
        // Only the REST fallback needs an explicit token; the
        // `buildkite-agent annotate` CLI uses the auto-injected
        // BUILDKITE_AGENT_ACCESS_TOKEN, which we don't surface here
        // because callers don't speak that protocol directly.
        token: env.BUILDKITE_API_TOKEN,
    };
};

/**
 * Reads the surrounding CI environment to populate {@link CiContext}.
 *
 * Pass an env override to make this testable without polluting the real
 * `process.env`. The function only reads env vars and (when present)
 * the `GITHUB_EVENT_PATH` JSON file — no subprocesses, no network.
 */
export const detectCiContext = async (env: NodeJS.ProcessEnv = process.env): Promise<CiContext> => {
    if (env.GITHUB_ACTIONS === "true") {
        return await detectGithubActions(env);
    }

    if (env.GITLAB_CI === "true") {
        return detectGitlabCi(env);
    }

    if (env.BUILDKITE === "true") {
        return detectBuildkite(env);
    }

    return {
        apiBaseUrl: undefined,
        buildId: undefined,
        buildNumber: undefined,
        prNumber: undefined,
        provider: "unknown",
        repo: undefined,
        sha: undefined,
        token: undefined,
    };
};
