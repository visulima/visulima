import { spawn } from "node:child_process";

import type { CiContext } from "./ci-context";

/**
 * Result of attempting to post a comment to a PR (GitHub) or MR
 * (GitLab). The orchestrator surfaces this to the user so a CI run
 * that produced a fix but failed to comment is still actionable —
 * the proposal is printed locally regardless of post outcome.
 */
export interface PostPrCommentResult {
    error?: string;
    method: "gh-cli" | "rest" | "skipped";
    posted: boolean;
}

export interface PostPrCommentOptions {
    body: string;
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

const postGithubComment = async (
    body: string,
    context: CiContext,
    ghBin: string,
    fetchImpl: typeof fetch,
): Promise<PostPrCommentResult> => {
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

const postGitlabComment = async (
    body: string,
    context: CiContext,
    fetchImpl: typeof fetch,
): Promise<PostPrCommentResult> => {
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
 * Post a PR/MR comment, dispatching on the resolved CI provider.
 *
 * - GitHub Actions: try `gh pr comment` first (uses the runner's bundled
 *   gh + auto-injected token), fall back to GitHub REST.
 * - GitLab CI: post via GitLab REST `merge_requests/:iid/notes`. `glab`
 *   isn't preinstalled and the auto-injected `CI_JOB_TOKEN` can't post
 *   notes, so the workflow must provide `GITLAB_TOKEN` (or `CI_TOKEN`).
 *
 * Returns `{ posted: false, method: "skipped" }` when there's no PR
 * number — push-event runs have nothing to comment on.
 */
export const postPrComment = async (options: PostPrCommentOptions): Promise<PostPrCommentResult> => {
    const { body, context, fetchImpl = globalThis.fetch, ghBin = "gh" } = options;

    if (context.provider === "github-actions") {
        return await postGithubComment(body, context, ghBin, fetchImpl);
    }

    if (context.provider === "gitlab-ci") {
        return await postGitlabComment(body, context, fetchImpl);
    }

    return { method: "skipped", posted: false };
};
