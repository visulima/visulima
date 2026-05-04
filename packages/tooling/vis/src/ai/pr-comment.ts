import { spawn } from "node:child_process";

import type { CiContext } from "./ci-context";

/**
 * Result of attempting to post a comment to a PR (GitHub) or MR
 * (GitLab), or an annotation to a Buildkite build. The orchestrator
 * surfaces this to the user so a CI run that produced a fix but failed
 * to comment is still actionable — the proposal is printed locally
 * regardless of post outcome.
 */
export interface PostPrCommentResult {
    error?: string;
    method: "buildkite-cli" | "gh-cli" | "rest" | "skipped";
    posted: boolean;
}

export interface PostPrCommentOptions {
    body: string;
    /**
     * Override the `buildkite-agent` lookup for tests. Defaults to
     * whichever `buildkite-agent` binary is on PATH. Pass `"/bin/false"`
     * to force the REST fallback path in tests.
     */
    buildkiteAgentBin?: string;
    context: CiContext;
    /** Override `fetch` for tests. Defaults to globalThis.fetch. */
    fetchImpl?: typeof fetch;
    /** Override `gh` lookup for tests. Defaults to whichever `gh` is on PATH. */
    ghBin?: string;
}

const runGhComment = (ghBin: string, prNumber: number, body: string, repo: string | undefined): Promise<{ exitCode: number; stderr: string }> =>
    new Promise((resolve) => {
        const args = ["pr", "comment", String(prNumber), "--body-file", "-"];

        // gh defaults the repo to the local clone's origin, but on a CI
        // runner a fresh checkout may not have origin set the way `gh`
        // expects (or the runner may operate against a fork). Passing
        // --repo explicitly when we have it avoids that whole class of
        // failure.
        if (repo) {
            args.push("--repo", repo);
        }

        // argv form, no shell — `body` and `repo` are not interpolated
        // into a command string, so shell metacharacters are inert.
        const child = spawn(ghBin, args, { stdio: ["pipe", "ignore", "pipe"] });
        let stderr = "";

        child.stderr?.setEncoding("utf8");
        child.stderr?.on("data", (chunk: string) => {
            stderr += chunk;
        });

        child.once("error", () => {
            // ENOENT etc. — surface as exit 127 so the caller falls back to REST.
            resolve({ exitCode: 127, stderr });
        });

        child.once("close", (code) => {
            resolve({ exitCode: code ?? -1, stderr });
        });

        // If gh exits before we finish writing the body, the kernel
        // returns EPIPE on stdin. Swallow it — `close` will still fire
        // with the real exit code, which is what the caller cares about.
        child.stdin?.on("error", () => {});
        child.stdin?.end(body);
    });

const postViaGithubRest = async (
    fetchImpl: typeof fetch,
    repo: string,
    prNumber: number,
    body: string,
    token: string,
): Promise<{ error?: string; ok: boolean }> => {
    // PR comments use the *issues* endpoint — pull-request comments are
    // file/line-anchored; what we want is a top-level conversation comment.
    const url = `https://api.github.com/repos/${repo}/issues/${String(prNumber)}/comments`;

    try {
        const response = await fetchImpl(url, {
            body: JSON.stringify({ body }),
            headers: {
                Accept: "application/vnd.github+json",
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
                "X-GitHub-Api-Version": "2022-11-28",
            },
            method: "POST",
        });

        if (!response.ok) {
            const text = await response.text().catch(() => "");

            return { error: `GitHub REST returned ${String(response.status)}: ${text.slice(0, 500)}`, ok: false };
        }

        return { ok: true };
    } catch (error) {
        return { error: error instanceof Error ? error.message : String(error), ok: false };
    }
};

const postViaGitlabRest = async (
    fetchImpl: typeof fetch,
    apiBaseUrl: string,
    repo: string,
    mrIid: number,
    body: string,
    token: string,
): Promise<{ error?: string; ok: boolean }> => {
    // GitLab's `notes` endpoint is the equivalent of GitHub's `issues
    // comments`. The project ID can be numeric or URL-encoded
    // namespace/project — encode unconditionally so a path-style repo
    // ("owner/group") survives the URL.
    const projectId = encodeURIComponent(repo);
    const url = `${apiBaseUrl.replace(/\/+$/, "")}/projects/${projectId}/merge_requests/${String(mrIid)}/notes`;

    try {
        const response = await fetchImpl(url, {
            body: JSON.stringify({ body }),
            headers: {
                "Content-Type": "application/json",
                // GitLab's `PRIVATE-TOKEN` header is its native auth shape;
                // `Authorization: Bearer` also works for OAuth tokens but
                // we route to PRIVATE-TOKEN to support both PAT and project
                // tokens uniformly.
                "PRIVATE-TOKEN": token,
            },
            method: "POST",
        });

        if (!response.ok) {
            const text = await response.text().catch(() => "");

            return { error: `GitLab REST returned ${String(response.status)}: ${text.slice(0, 500)}`, ok: false };
        }

        return { ok: true };
    } catch (error) {
        return { error: error instanceof Error ? error.message : String(error), ok: false };
    }
};

const runBuildkiteAnnotate = (
    binary: string,
    body: string,
    style: "error" | "info" | "warning",
    contextName: string,
): Promise<{ exitCode: number; stderr: string }> =>
    new Promise((resolve) => {
        const args = ["annotate", "--style", style, "--context", contextName];

        // argv form, no shell — `body` reaches the agent over stdin so
        // shell metacharacters in the heal proposal are inert.
        const child = spawn(binary, args, { stdio: ["pipe", "ignore", "pipe"] });
        let stderr = "";

        child.stderr?.setEncoding("utf8");
        child.stderr?.on("data", (chunk: string) => {
            stderr += chunk;
        });

        child.once("error", () => {
            // ENOENT etc. — surface as 127 so the caller falls back to REST.
            resolve({ exitCode: 127, stderr });
        });

        child.once("close", (code) => {
            resolve({ exitCode: code ?? -1, stderr });
        });

        child.stdin?.on("error", () => {});
        child.stdin?.end(body);
    });

const postViaBuildkiteRest = async (
    fetchImpl: typeof fetch,
    apiBaseUrl: string,
    repo: string,
    buildNumber: number,
    body: string,
    style: "error" | "info" | "warning",
    contextName: string,
    token: string,
): Promise<{ error?: string; ok: boolean }> => {
    // `repo` is `{org-slug}/{pipeline-slug}` — both segments are URL-safe
    // slugs in Buildkite's data model, but encode anyway in case a future
    // version loosens that. The annotations API takes the build number,
    // not the build UUID, in the path.
    const [organization, pipeline] = repo.split("/", 2);

    if (!organization || !pipeline) {
        return { error: `Buildkite repo identifier \`${repo}\` is not in {org}/{pipeline} form.`, ok: false };
    }

    // `apiBaseUrl` is already trimmed of trailing slashes in `detectBuildkite`.
    const url = `${apiBaseUrl}/v2/organizations/${encodeURIComponent(organization)}/pipelines/${encodeURIComponent(pipeline)}/builds/${String(buildNumber)}/annotations`;

    try {
        const response = await fetchImpl(url, {
            body: JSON.stringify({ body, context: contextName, style }),
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
            },
            method: "POST",
        });

        if (!response.ok) {
            const text = await response.text().catch(() => "");

            return { error: `Buildkite REST returned ${String(response.status)}: ${text.slice(0, 500)}`, ok: false };
        }

        return { ok: true };
    } catch (error) {
        return { error: error instanceof Error ? error.message : String(error), ok: false };
    }
};

const postBuildkiteAnnotation = async (body: string, context: CiContext, buildkiteAgentBin: string, fetchImpl: typeof fetch): Promise<PostPrCommentResult> => {
    // The annotation `--context` uniquely identifies an annotation
    // *within a build*. Reusing the same context on rerun causes
    // Buildkite to update the existing annotation in place instead of
    // stacking a new one — which is exactly what we want when a heal
    // proposal is regenerated. Falls back to a static slug if buildId
    // is missing (e.g. when called from a non-build context).
    const contextName = context.buildId ? `vis-ai-heal-${context.buildId}` : "vis-ai-heal";

    // The heal flow only posts on success. If a future caller wants the
    // red "error" bar, surface it through this function's signature at
    // that point — no need for an unused option today.
    const style = "info";

    // Prefer the bundled CLI: it auto-uses BUILDKITE_AGENT_ACCESS_TOKEN
    // (always present on agents) and needs no extra plumbing. REST is
    // the escape hatch for stripped-down runners and self-hosted
    // setups where the agent binary isn't on PATH.
    const cliResult = await runBuildkiteAnnotate(buildkiteAgentBin, body, style, contextName);

    if (cliResult.exitCode === 0) {
        return { method: "buildkite-cli", posted: true };
    }

    if (!context.apiBaseUrl || !context.repo || context.buildNumber === undefined || !context.token) {
        const missing: string[] = [];

        if (!context.repo) missing.push("BUILDKITE_ORGANIZATION_SLUG / BUILDKITE_PIPELINE_SLUG");
        if (context.buildNumber === undefined) missing.push("BUILDKITE_BUILD_NUMBER");
        if (!context.token) missing.push("BUILDKITE_API_TOKEN (with `write_build_annotations` scope)");

        return {
            error: `buildkite-agent annotate exited ${String(cliResult.exitCode)} (${cliResult.stderr.trim().slice(0, 200)}); cannot fall back to REST without ${missing.join(", ")}`,
            method: "buildkite-cli",
            posted: false,
        };
    }

    const restResult = await postViaBuildkiteRest(fetchImpl, context.apiBaseUrl, context.repo, context.buildNumber, body, style, contextName, context.token);

    if (restResult.ok) {
        return { method: "rest", posted: true };
    }

    return {
        error: `buildkite-agent annotate exited ${String(cliResult.exitCode)}; REST fallback also failed: ${restResult.error ?? "unknown"}`,
        method: "rest",
        posted: false,
    };
};

const postGithubComment = async (body: string, context: CiContext, ghBin: string, fetchImpl: typeof fetch): Promise<PostPrCommentResult> => {
    if (context.prNumber === undefined) {
        return { method: "skipped", posted: false };
    }

    // gh ships on every GH-Actions hosted runner; try it first to avoid
    // requiring the workflow to plumb a token. Fall back to REST when
    // the runner is missing gh (e.g. self-hosted) or gh fails.
    const ghResult = await runGhComment(ghBin, context.prNumber, body, context.repo);

    if (ghResult.exitCode === 0) {
        return { method: "gh-cli", posted: true };
    }

    if (!context.repo || !context.token) {
        return {
            error: `gh exited ${String(ghResult.exitCode)} (${ghResult.stderr.trim().slice(0, 200)}); cannot fall back to REST without GITHUB_REPOSITORY + GITHUB_TOKEN`,
            method: "gh-cli",
            posted: false,
        };
    }

    const restResult = await postViaGithubRest(fetchImpl, context.repo, context.prNumber, body, context.token);

    if (restResult.ok) {
        return { method: "rest", posted: true };
    }

    return {
        error: `gh exited ${String(ghResult.exitCode)}; REST fallback also failed: ${restResult.error ?? "unknown"}`,
        method: "rest",
        posted: false,
    };
};

const postGitlabComment = async (body: string, context: CiContext, fetchImpl: typeof fetch): Promise<PostPrCommentResult> => {
    if (context.prNumber === undefined) {
        return { method: "skipped", posted: false };
    }

    if (!context.apiBaseUrl || !context.repo) {
        return {
            error: "GitLab CI context is missing CI_API_V4_URL or CI_PROJECT_ID; cannot post note.",
            method: "rest",
            posted: false,
        };
    }

    if (!context.token) {
        return {
            error: "GitLab CI context has no token. CI_JOB_TOKEN cannot post MR notes — set GITLAB_TOKEN to a personal/project access token with `api` scope.",
            method: "rest",
            posted: false,
        };
    }

    // glab is not preinstalled on GitLab's shared runners and project
    // tokens are the standard auth shape, so go straight to REST. If
    // glab support becomes a need later, mirror the gh-CLI path.
    const restResult = await postViaGitlabRest(fetchImpl, context.apiBaseUrl, context.repo, context.prNumber, body, context.token);

    if (restResult.ok) {
        return { method: "rest", posted: true };
    }

    return { error: restResult.error, method: "rest", posted: false };
};

/**
 * Post a PR/MR comment or build annotation, dispatching on the
 * resolved CI provider.
 *
 * - GitHub Actions: try `gh pr comment` first (uses the runner's bundled
 *   gh + auto-injected token), fall back to GitHub REST.
 * - GitLab CI: post via GitLab REST `merge_requests/:iid/notes`. `glab`
 *   isn't preinstalled and the auto-injected `CI_JOB_TOKEN` can't post
 *   notes, so the workflow must provide `GITLAB_TOKEN` (or `CI_TOKEN`).
 * - Buildkite: try `buildkite-agent annotate` first (uses the bundled
 *   `BUILDKITE_AGENT_ACCESS_TOKEN`), fall back to Buildkite REST when
 *   the agent binary is missing or fails. The REST fallback requires
 *   `BUILDKITE_API_TOKEN` with `write_build_annotations` scope. The
 *   annotation `--context` is keyed off `BUILDKITE_BUILD_ID` so reruns
 *   update the existing annotation rather than stacking new ones.
 *
 * Returns `{ posted: false, method: "skipped" }` when there's no PR
 * number on GitHub/GitLab — push-event runs have nothing to comment
 * on. Buildkite always has a build to annotate, even on push events.
 */
export const postPrComment = async (options: PostPrCommentOptions): Promise<PostPrCommentResult> => {
    const { body, buildkiteAgentBin = "buildkite-agent", context, fetchImpl = globalThis.fetch, ghBin = "gh" } = options;

    if (context.provider === "github-actions") {
        return await postGithubComment(body, context, ghBin, fetchImpl);
    }

    if (context.provider === "gitlab-ci") {
        return await postGitlabComment(body, context, fetchImpl);
    }

    if (context.provider === "buildkite") {
        return await postBuildkiteAnnotation(body, context, buildkiteAgentBin, fetchImpl);
    }

    return { method: "skipped", posted: false };
};
