import { readFile } from "node:fs/promises";

import type { CommandExecute, Toolbox } from "@visulima/cerebro";
import { relative } from "@visulima/path";

import type { AiConfig } from "../../ai/ai-analysis";
import type { CiContext } from "../../ai/ci-context";
import { detectCiContext } from "../../ai/ci-context";
import type { CommitFilesOptions, CommitFilesResult } from "../../ai/git-commit";
import { commitFiles } from "../../ai/git-commit";
import { postPrComment } from "../../ai/pr-comment";
import { pail } from "../../io/logger";
import { findHealCandidate, proposeAndApply, validateAppliedFix } from "./heal";
import type { AiHealAcceptOptions } from "./index";

const TRIGGER_PHRASE = "/vis heal accept";

interface AcceptTrigger {
    actor: string;
    body: string;
    /** Branch the commit will land on — head of the PR / source of the MR. */
    headRef: string | undefined;
    /** Whether the source repo differs from the base repo (GitHub forks). */
    isFork: boolean;
}

interface GithubIssueCommentEvent {
    action?: string;
    comment?: { body?: string; user?: { login?: string } };
    issue?: { number?: number; pull_request?: unknown };
    pull_request?: { base?: { repo?: { full_name?: string } }; head?: { ref?: string; repo?: { full_name?: string } }; number?: number };
    repository?: { full_name?: string };
}

const loadGithubTrigger = async (eventPath: string | undefined): Promise<AcceptTrigger | undefined> => {
    if (!eventPath) {
        return undefined;
    }

    let raw: string;

    try {
        raw = await readFile(eventPath, "utf8");
    } catch {
        return undefined;
    }

    const payload = JSON.parse(raw) as GithubIssueCommentEvent;

    // We accept two payload shapes: an `issue_comment` on a PR (the
    // canonical /vis heal accept flow) and a `pull_request` event (e.g.
    // when re-running with an injected payload during local testing).
    // The "comment" path is the only one a maintainer can drive, so it's
    // the primary case; pull_request is a debugging convenience.
    const body = payload.comment?.body ?? "";
    const actor = payload.comment?.user?.login ?? "";

    // Fork detection: head.repo and base.repo full_name differ. Without a
    // pull_request payload we conservatively assume same-repo (the
    // commit will fail later if the assumption is wrong, with a clear
    // 403 from the API).
    const headRepo = payload.pull_request?.head?.repo?.full_name;
    const baseRepo = payload.pull_request?.base?.repo?.full_name ?? payload.repository?.full_name;
    const isFork = headRepo !== undefined && baseRepo !== undefined && headRepo !== baseRepo;

    return {
        actor,
        body,
        headRef: payload.pull_request?.head?.ref,
        isFork,
    };
};

const loadGitlabTrigger = (env: NodeJS.ProcessEnv): AcceptTrigger | undefined => {
    // GitLab note hooks don't run pipelines natively — users wire a
    // webhook → CI bridge that re-emits the comment as env vars.
    // Document the contract: VIS_HEAL_TRIGGER_BODY (the comment text),
    // VIS_HEAL_TRIGGER_ACTOR (the username), VIS_HEAL_HEAD_REF (the MR
    // source branch). All three are required.
    const body = env.VIS_HEAL_TRIGGER_BODY;
    const actor = env.VIS_HEAL_TRIGGER_ACTOR;

    if (!body || !actor) {
        return undefined;
    }

    return {
        actor,
        body,
        // GitLab forks (called "subgroups" in the public docs) are
        // detected at the host level — the bridge should refuse to
        // forward note events from forks. We don't have visibility from
        // here, so default to false and rely on the API auth scope.
        headRef: env.VIS_HEAL_HEAD_REF,
        isFork: false,
    };
};

const loadBuildkiteTrigger = (env: NodeJS.ProcessEnv): AcceptTrigger | undefined => {
    // Buildkite has no PR-comment surface — the canonical accept
    // signal is a block step that a maintainer manually unblocks.
    // Buildkite then sets BUILDKITE_UNBLOCKER_* on every dependent
    // step. The presence of the email (or username fallback) is the
    // implicit acceptance: there's no comment body to scan, so we
    // synthesize one containing the trigger phrase to keep the rest
    // of the accept flow uniform.
    const actor = env.BUILDKITE_UNBLOCKER_EMAIL ?? env.BUILDKITE_UNBLOCKER;

    if (!actor) {
        return undefined;
    }

    return {
        actor,
        body: TRIGGER_PHRASE,
        // BUILDKITE_BRANCH is the source branch in the upstream remote
        // namespace. Unlike GitHub Actions (which exposes a synthetic
        // `refs/pull/<n>/merge` ref via GITHUB_REF on PR builds),
        // Buildkite always reports the underlying branch — exactly what
        // the heal commit needs to land on. For non-PR builds it's the
        // pushed branch, same target either way.
        headRef: env.BUILDKITE_BRANCH,
        // Buildkite doesn't model forks at this layer; whether the
        // upstream PR is from a fork is a property of the originating
        // VCS (GitHub/GitLab), checked when we derive the commit context.
        isFork: false,
    };
};

const loadTrigger = async (ciContext: CiContext, env: NodeJS.ProcessEnv): Promise<AcceptTrigger | undefined> => {
    if (ciContext.provider === "github-actions") {
        return await loadGithubTrigger(env.GITHUB_EVENT_PATH);
    }

    if (ciContext.provider === "gitlab-ci") {
        return loadGitlabTrigger(env);
    }

    if (ciContext.provider === "buildkite") {
        return loadBuildkiteTrigger(env);
    }

    return undefined;
};

/**
 * Buildkite is a CI host, not a VCS — accepting a heal commit means
 * routing it back to whatever git host triggered the build (GitHub or
 * GitLab today). This parses `BUILDKITE_REPO` and synthesises the
 * matching VCS `CiContext` that `commitFiles` expects.
 *
 * Returns `undefined` when the repo URL doesn't match a supported VCS
 * or the corresponding token isn't set; the caller surfaces a clear
 * error so users know exactly which env var to plumb.
 */
const deriveBuildkiteCommitContext = (buildkite: CiContext, env: NodeJS.ProcessEnv): CiContext | undefined => {
    const repoUrl = env.BUILDKITE_REPO;

    if (!repoUrl) {
        return undefined;
    }

    // Match git@github.com:owner/repo(.git) and https://github.com/owner/repo(.git).
    // Also tolerate ssh://git@github.com/owner/repo URLs which some
    // mirrors emit. The trailing .git is optional.
    const githubMatch = /(?:^|@|\/\/)github\.com[:/]([^/]+)\/([^/]+?)(?:\.git)?\/?$/i.exec(repoUrl);

    if (githubMatch && env.GITHUB_TOKEN) {
        return {
            apiBaseUrl: undefined,
            buildId: undefined,
            buildNumber: undefined,
            prNumber: buildkite.prNumber,
            provider: "github-actions",
            repo: `${githubMatch[1]!}/${githubMatch[2]!}`,
            sha: buildkite.sha,
            token: env.GITHUB_TOKEN,
        };
    }

    // GitLab URLs come in two shapes — keep them split so the HTTPS form
    // can carry a `:port` in the host while the SSH form treats `:` as
    // the host/path separator. We honour an explicit CI_API_V4_URL when
    // set (some self-hosted GitLabs proxy the API on a sibling host),
    // otherwise we synthesise the API base from the matched host so a
    // non-default port survives into REST calls.
    //
    // HTTPS:  https://gitlab.example.com[:port]/group/sub/proj(.git)
    const gitlabHttpsMatch = /\/\/([^/]*gitlab[^/]*)\/([^/]+)\/(.+?)(?:\.git)?\/?$/i.exec(repoUrl);
    // SSH:    git@gitlab.example.com:group/sub/proj(.git) — `@` is mandatory
    // here so we don't swallow the username segment into the host capture.
    const gitlabSshMatch = gitlabHttpsMatch ? null : /@([^/:]*gitlab[^/:]*):([^/]+)\/(.+?)(?:\.git)?\/?$/i.exec(repoUrl);
    const gitlabMatch = gitlabHttpsMatch ?? gitlabSshMatch;

    if (gitlabMatch && env.GITLAB_TOKEN) {
        const host = gitlabMatch[1]!;
        const apiBaseUrl = env.CI_API_V4_URL ?? `https://${host}/api/v4`;

        return {
            apiBaseUrl,
            buildId: undefined,
            buildNumber: undefined,
            prNumber: buildkite.prNumber,
            provider: "gitlab-ci",
            repo: `${gitlabMatch[2]!}/${gitlabMatch[3]!}`,
            sha: buildkite.sha,
            token: env.GITLAB_TOKEN,
        };
    }

    return undefined;
};

interface FetchGithubHeadRefOptions {
    apiBaseUrl?: string;
    fetchImpl?: typeof fetch;
    prNumber: number;
    repo: string;
    token: string;
}

const fetchGithubHeadRef = async (options: FetchGithubHeadRefOptions): Promise<string | undefined> => {
    const fetchImpl = options.fetchImpl ?? globalThis.fetch;
    const base = options.apiBaseUrl ?? "https://api.github.com";
    const url = `${base.replace(/\/+$/, "")}/repos/${options.repo}/pulls/${String(options.prNumber)}`;

    try {
        const response = await fetchImpl(url, {
            headers: {
                Accept: "application/vnd.github+json",
                Authorization: `Bearer ${options.token}`,
                "X-GitHub-Api-Version": "2022-11-28",
            },
        });

        if (!response.ok) {
            return undefined;
        }

        const json = (await response.json()) as { head?: { ref?: string } };

        return json.head?.ref;
    } catch {
        return undefined;
    }
};

const summariseDetail = (commit: CommitFilesResult, files: string[], failingTaskId: string, actor: string): string => {
    const fileLines = files.map((file) => `- \`${file}\``).join("\n");

    return [
        "## vis ai heal — committed",
        "",
        `Accepted by @${actor}.`,
        "",
        `Failing task: \`${failingTaskId}\``,
        commit.url ? `Commit: [\`${commit.sha.slice(0, 7)}\`](${commit.url})` : `Commit: \`${commit.sha.slice(0, 7)}\``,
        "",
        "### Files changed",
        fileLines,
        "",
        "_Re-run the failing job to confirm the fix landed._",
    ].join("\n");
};

export interface HealAcceptDeps {
    /** Inject pre-built commit clients for tests. */
    commitOverrides?: Pick<CommitFilesOptions, "githubClient" | "gitlabClient" | "loadSdk" | "readFile">;
    /** Inject a fake CI context for tests. */
    detectCi?: () => Promise<CiContext>;
    /** Inject a fake env for trigger parsing. Defaults to `process.env`. */
    env?: NodeJS.ProcessEnv;
    /** Inject a fake fetch for GitHub head-ref resolution. */
    fetchImpl?: typeof fetch;
    /** Inject a fake comment poster for the confirmation comment. */
    postComment?: (body: string, context: CiContext) => Promise<{ error?: string; method: string; posted: boolean }>;
    /** Inject a fake validator for the apply re-run. */
    validate?: (project: string, target: string) => Promise<{ exitCode: number; stderr: string; stdout: string }>;
}

const acceptHeal = async (toolbox: Toolbox<Console, AiHealAcceptOptions>, deps: HealAcceptDeps = {}): Promise<void> => {
    const { logger, visConfig, workspaceRoot: wsRoot } = toolbox;
    const workspaceRoot = wsRoot ?? process.cwd();
    const env = deps.env ?? process.env;

    const ciContext = await (deps.detectCi ?? (() => detectCiContext(env)))();

    if (ciContext.provider === "unknown") {
        pail.error("`vis ai heal accept` must run inside a recognised CI provider (GitHub Actions, GitLab CI, or Buildkite).");
        process.exitCode = 1;

        return;
    }

    const trigger = await loadTrigger(ciContext, env);

    if (!trigger) {
        const message
            = ciContext.provider === "github-actions"
                ? "No issue_comment payload found. Trigger this command from a workflow listening for `issue_comment.created`."
                : ciContext.provider === "gitlab-ci"
                    ? "No GitLab trigger payload found. Set VIS_HEAL_TRIGGER_BODY, VIS_HEAL_TRIGGER_ACTOR, and VIS_HEAL_HEAD_REF in the bridge that re-emits note hooks as pipeline runs."
                    : "No Buildkite unblock signal found. Wire this command to run after a manually-unblocked block step so BUILDKITE_UNBLOCKER_EMAIL is set.";

        pail.error(message);
        process.exitCode = 1;

        return;
    }

    // On Buildkite, the block-step unblock IS the acceptance signal —
    // there's no comment body to scan. Skip the trigger phrase check.
    if (ciContext.provider !== "buildkite" && !trigger.body.includes(TRIGGER_PHRASE)) {
        pail.notice(`Trigger comment does not contain \`${TRIGGER_PHRASE}\`; nothing to do.`);

        return;
    }

    const aiConfig: AiConfig | undefined = visConfig?.ai;
    const allowedActors = aiConfig?.heal?.allowedActors ?? [];

    if (allowedActors.length === 0) {
        pail.error("`ai.heal.allowedActors` is empty. Configure the allow-list in `vis.config.*` before enabling auto-commit.");
        process.exitCode = 1;

        return;
    }

    if (!trigger.actor || !allowedActors.includes(trigger.actor)) {
        // Allow-list semantics differ per provider — surface the
        // expected entry shape so the user knows what to add. GitHub /
        // GitLab use platform usernames; Buildkite uses the unblocker
        // email (or Buildkite username when the email isn't exposed).
        const hint
            = ciContext.provider === "buildkite"
                ? "Buildkite entries are emails (BUILDKITE_UNBLOCKER_EMAIL) or Buildkite usernames (BUILDKITE_UNBLOCKER), not the upstream GitHub/GitLab username."
                : ciContext.provider === "gitlab-ci"
                    ? "GitLab entries are platform usernames (without the leading `@`)."
                    : "GitHub entries are platform usernames (without the leading `@`).";

        pail.error(`Actor \`${trigger.actor || "(unknown)"}\` is not in \`ai.heal.allowedActors\`. Refusing to commit. ${hint}`);
        process.exitCode = 1;

        return;
    }

    if (trigger.isFork) {
        // `isFork` is only set by the GitHub trigger today (fork PRs).
        // GitLab MRs from forks would surface here too if/when we
        // populate it. Buildkite leaves it false and defers the
        // fork check to the derived upstream context.
        pail.error("Refusing to accept: the change is from a forked repository. The CI token does not have write access to the fork.");
        process.exitCode = 1;

        return;
    }

    let branch = trigger.headRef;

    if (!branch && ciContext.provider === "github-actions" && ciContext.prNumber !== undefined && ciContext.repo && ciContext.token) {
        // issue_comment payloads don't include the PR head ref. Fetch
        // it via the REST API so the commit knows where to land.
        branch = await fetchGithubHeadRef({
            fetchImpl: deps.fetchImpl,
            prNumber: ciContext.prNumber,
            repo: ciContext.repo,
            token: ciContext.token,
        });
    }

    if (!branch) {
        pail.error("Could not resolve the PR / MR head branch. Ensure the trigger payload includes head.ref or set VIS_HEAL_HEAD_REF.");
        process.exitCode = 1;

        return;
    }

    pail.info(`Accepting fix on \`${branch}\` for actor \`${trigger.actor}\`.`);

    const candidateResult = await findHealCandidate(workspaceRoot, toolbox.options.run);

    if (candidateResult.outcome === "no-failed-task") {
        pail.error("No failed tasks found in the run summary. The accept command should run on the same workspace as the original failure.");
        process.exitCode = 1;

        return;
    }

    if (candidateResult.outcome === "missing-metadata") {
        pail.error(`Failed task ${candidateResult.failedTask.taskId} is missing project/target metadata; cannot validate the fix.`);
        process.exitCode = 1;

        return;
    }

    if (candidateResult.outcome === "no-failure-context") {
        pail.error(`No failure log or run summary found for ${candidateResult.failedTask.taskId}.`);
        process.exitCode = 1;

        return;
    }

    const candidate = candidateResult;
    const proposeResult = await proposeAndApply(toolbox, candidate);

    if (proposeResult.outcome === "no-proposal") {
        pail.error("AI fix proposal failed; cannot commit.");
        process.exitCode = 1;

        return;
    }

    if (proposeResult.outcome === "cannot-fix") {
        pail.warn(`AI declined to fix: ${proposeResult.detail ?? "(no reason)"}. Nothing to commit.`);
        process.exitCode = 1;

        return;
    }

    if (proposeResult.outcome === "empty-patches") {
        pail.warn("AI returned an empty patch set. Nothing to commit.");
        process.exitCode = 1;

        return;
    }

    if (proposeResult.outcome === "no-patches-applied") {
        pail.error("Patches could not be applied to the workspace. Refusing to commit.");
        process.exitCode = 1;

        return;
    }

    pail.info(`Re-running ${candidate.failedTask.taskId} to validate the fix before committing...`);

    const validation = await validateAppliedFix(toolbox, candidate, { validate: deps.validate });

    if (validation.exitCode !== 0) {
        pail.error(`Validation failed (exit ${String(validation.exitCode)}). Refusing to commit.`);

        if (validation.stderr.trim().length > 0) {
            logger.info("--- validation stderr (tail) ---");
            logger.info(validation.stderr.split("\n").slice(-20).join("\n"));
        }

        process.exitCode = 1;

        return;
    }

    pail.success("Validation passed. Committing.");

    // Build the file list from the actually-applied patches. AI
    // proposals can include patches the applier rejected (no-match,
    // ambiguous, etc.) — those don't end up in the commit.
    const appliedFiles = (proposeResult.applyResults ?? [])
        .filter((result) => result.status === "applied")
        .map((result) => {
            // Prefer absolutePath (always set when the patch applied)
            // and re-derive the workspace-relative path for git.
            const absolute = result.absolutePath ?? result.patch.file;
            const rel = relative(workspaceRoot, absolute);

            return rel === "" || rel.startsWith("..") ? result.patch.file : rel;
        });

    if (appliedFiles.length === 0) {
        pail.error("No applied files to commit. Aborting.");
        process.exitCode = 1;

        return;
    }

    const message = [
        `fix: vis ai heal accepted by @${trigger.actor}`,
        "",
        `Failing task: ${candidate.failedTask.taskId}`,
        proposeResult.proposal?.explanation ? `\n${proposeResult.proposal.explanation}` : "",
        "",
        "Auto-committed by `vis ai heal accept`.",
    ].join("\n");

    // Buildkite is a CI host, not a VCS — route the commit through the
    // upstream git provider derived from BUILDKITE_REPO + the relevant
    // VCS token. The original Buildkite ciContext is still used below
    // to post the confirmation as an annotation.
    let commitContext = ciContext;

    if (ciContext.provider === "buildkite") {
        const derived = deriveBuildkiteCommitContext(ciContext, env);

        if (!derived) {
            pail.error(
                "Cannot determine the upstream VCS to commit to. Buildkite jobs need GITHUB_TOKEN or GITLAB_TOKEN set (matching the host parsed from BUILDKITE_REPO) for `vis ai heal accept` to land the commit.",
            );
            process.exitCode = 1;

            return;
        }

        commitContext = derived;
    }

    let commit: CommitFilesResult;

    try {
        commit = await commitFiles({
            branch,
            ciContext: commitContext,
            files: appliedFiles,
            message,
            workspaceRoot,
            ...deps.commitOverrides,
        });
    } catch (error) {
        pail.error(`Commit failed: ${error instanceof Error ? error.message : String(error)}`);
        process.exitCode = 1;

        return;
    }

    pail.success(`Committed as ${commit.sha.slice(0, 7)}${commit.url ? ` — ${commit.url}` : ""}.`);

    const confirmationBody = summariseDetail(commit, appliedFiles, candidate.failedTask.taskId, trigger.actor);
    const postCommentImpl = deps.postComment ?? (async (body: string, context: CiContext) => postPrComment({ body, context }));
    const postResult = await postCommentImpl(confirmationBody, ciContext);

    if (!postResult.posted && postResult.method !== "skipped") {
        pail.warn(`Commit landed but the confirmation comment failed: ${postResult.error ?? "unknown"}`);
    }
};

// fallow-ignore-next-line unused-export -- lazy-loaded command entry (cerebro loader/lazyNamed dynamic import)
export const aiHealAccept: CommandExecute<Toolbox<Console, AiHealAcceptOptions>> = async (toolbox) => {
    await acceptHeal(toolbox);
};

export {
    deriveBuildkiteCommitContext as deriveBuildkiteCommitContextForTesting,
    fetchGithubHeadRef as fetchGithubHeadRefForTesting,
    loadBuildkiteTrigger as loadBuildkiteTriggerForTesting,
    loadGithubTrigger as loadGithubTriggerForTesting,
    loadGitlabTrigger as loadGitlabTriggerForTesting,
    acceptHeal as runHealAcceptForTesting,
    summariseDetail as summariseDetailForTesting,
    TRIGGER_PHRASE,
};
