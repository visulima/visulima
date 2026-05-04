import { spawn } from "node:child_process";

import type { CommandExecute, Toolbox } from "@visulima/cerebro";
import { bold, dim, green, red, yellow } from "@visulima/colorize";
import { relative } from "@visulima/path";
import { readLastRunSummary } from "@visulima/task-runner";

import type { AiConfig } from "../../ai/ai-analysis";
import type { FailureContext } from "../../ai/ai-failure-context";
import { aggregateFailureContext } from "../../ai/ai-failure-context";
import type { FixProposal, PatchResult } from "../../ai/ai-fix";
import { applyFixProposal, resolvePatchPath, runFixAnalysis } from "../../ai/ai-fix";
import type { CiContext } from "../../ai/ci-context";
import { detectCiContext } from "../../ai/ci-context";
import { postPrComment } from "../../ai/pr-comment";
import { pail } from "../../io/logger";
import { readRunSummaryById } from "../../report/run-summary-utils";
import type { AiHealOptions } from "./index";

interface ValidationResult {
    exitCode: number;
    stderr: string;
    stdout: string;
}

const summarizeApply = (results: PatchResult[]): { applied: number; failed: number } => {
    let applied = 0;
    let failed = 0;

    for (const result of results) {
        if (result.status === "applied") {
            applied += 1;
        } else {
            failed += 1;
        }
    }

    return { applied, failed };
};

const formatDisplayPath = (workspaceRoot: string, cwd: string | undefined, file: string): string => {
    const absolute = resolvePatchPath(workspaceRoot, cwd, file);
    const rel = relative(workspaceRoot, absolute);

    return rel === "" || rel.startsWith("..") ? absolute : rel;
};

const validateFixByRerun = (workspaceRoot: string, project: string, target: string, timeoutMs: number): Promise<ValidationResult> =>
    new Promise((resolve) => {
        const visBin = process.argv[1];

        if (!visBin) {
            // process.argv[1] is the entry point that started this run. It's
            // `undefined` only in `-e` / REPL contexts, neither of which is
            // a sensible place for `vis ai heal`.
            resolve({ exitCode: -1, stderr: "Cannot locate vis bin (process.argv[1] missing).", stdout: "" });

            return;
        }

        // Re-run with --no-cache so the just-patched files actually go
        // through the task; --summarize so a fresh run summary is written
        // (a follow-up heal would otherwise re-read the failed run); and
        // scoped to one project so we don't re-run the entire workspace.
        const args = [visBin, "run", target, "--projects", project, "--no-cache", "--summarize", "--fail-fast"];
        const child = spawn(process.execPath, args, {
            cwd: workspaceRoot,
            env: { ...process.env, NO_COLOR: "1" },
            stdio: ["ignore", "pipe", "pipe"],
        });

        let stdout = "";
        let stderr = "";

        const timer = setTimeout(() => {
            child.kill("SIGTERM");
            // Hard kill 2s later if SIGTERM is ignored (e.g. a hung child
            // process group). Same escalation pattern as vis-mcp/exec.ts.
            setTimeout(() => child.kill("SIGKILL"), 2000).unref();
        }, timeoutMs);

        child.stdout?.setEncoding("utf8");
        child.stdout?.on("data", (chunk: string) => {
            stdout += chunk;
        });

        child.stderr?.setEncoding("utf8");
        child.stderr?.on("data", (chunk: string) => {
            stderr += chunk;
        });

        child.once("error", (error) => {
            clearTimeout(timer);
            resolve({ exitCode: -1, stderr: error.message, stdout });
        });

        child.once("close", (code) => {
            clearTimeout(timer);
            resolve({ exitCode: code ?? -1, stderr, stdout });
        });
    });

// GitHub's hard cap on PR/issue comment bodies. GitLab is more generous
// (1 MB) but using the smaller bound for both keeps the truncation
// behavior provider-agnostic. We render the comment, and if it exceeds
// this we drop the per-file diffs and leave a pointer to `vis ai fix`.
const MAX_COMMENT_BYTES = 60_000;

// Patch contents may legitimately contain triple backticks (markdown
// docs, fenced code in TS strings). Pick a fence that's long enough to
// survive the worst case in this patch set so the comment renders
// correctly on GitHub/GitLab.
const pickFence = (content: string): string => {
    let longest = 0;
    const matches = content.match(/`{3,}/g);

    if (matches) {
        for (const m of matches) {
            longest = Math.max(longest, m.length);
        }
    }

    return "`".repeat(Math.max(3, longest + 1));
};

const renderProposalDiff = (proposal: FixProposal, workspaceRoot: string, cwd: string | undefined): string => {
    if (proposal.patches.length === 0) {
        return "_No patches proposed._";
    }

    const blocks: string[] = [];

    for (const [index, patch] of proposal.patches.entries()) {
        const displayPath = formatDisplayPath(workspaceRoot, cwd, patch.file);
        const lines: string[] = [];

        lines.push(`**[${String(index + 1)}] \`${displayPath}\`**`);

        if (patch.reason) {
            lines.push(`_${patch.reason}_`);
        }

        const fence = pickFence(`${patch.oldString}\n${patch.newString}`);

        lines.push(`${fence}diff`);

        for (const line of patch.oldString.split("\n")) {
            lines.push(`- ${line}`);
        }

        for (const line of patch.newString.split("\n")) {
            lines.push(`+ ${line}`);
        }

        lines.push(fence);
        blocks.push(lines.join("\n"));
    }

    return blocks.join("\n\n");
};

const renderCommentBody = (
    proposal: FixProposal,
    failureContext: FailureContext,
    workspaceRoot: string,
    sha: string | undefined,
): string => {
    const header: string[] = [];

    header.push("## vis ai heal — proposed fix");
    header.push("");
    header.push(`Failing task: \`${failureContext.taskId}\` (provider: \`${proposal.provider}\`, confidence: \`${proposal.confidence}\`)`);

    if (sha) {
        header.push(`Run anchored at \`${sha.slice(0, 7)}\`.`);
    }

    header.push("");
    header.push("### Root cause");
    header.push(proposal.explanation || "_(no explanation)_");
    header.push("");

    const diffSection: string[] = [];

    diffSection.push("### Proposed patch");
    diffSection.push(renderProposalDiff(proposal, workspaceRoot, failureContext.cwd));
    diffSection.push("");

    const footer: string[] = [];

    footer.push("### Validation");
    footer.push(`Re-ran \`${failureContext.taskId}\` after applying the patch on the CI runner — task **passed**.`);
    footer.push("");
    footer.push("### Apply locally");
    footer.push("```sh");
    footer.push(`vis ai fix ${failureContext.taskId} --apply`);
    footer.push("```");
    footer.push("");
    footer.push("---");
    footer.push("");
    footer.push("_Auto-generated by `vis ai heal`. Auto-commit is on the roadmap; for now the patch lives in this comment and is yours to accept or reject._");

    const full = [...header, ...diffSection, ...footer].join("\n");

    if (Buffer.byteLength(full, "utf8") <= MAX_COMMENT_BYTES) {
        return full;
    }

    // Patch set blew past GitHub's 65 KB comment ceiling. Drop the diff
    // body and leave a pointer to `vis ai fix` so the dev can pull the
    // full proposal locally — better than a 422 from the API.
    const truncatedDiff = [
        "### Proposed patch",
        `_Patch set is too large for a comment (${String(proposal.patches.length)} files). Run \`vis ai fix ${failureContext.taskId} --apply\` locally to inspect and apply it._`,
        "",
    ];

    return [...header, ...truncatedDiff, ...footer].join("\n");
};

const renderProposalForLog = (proposal: FixProposal, workspaceRoot: string, cwd: string | undefined): string => {
    const lines: string[] = [];

    lines.push(bold(`Proposal (${proposal.provider}, confidence: ${proposal.confidence})`));
    lines.push(proposal.explanation || dim("<no explanation>"));

    for (const [index, patch] of proposal.patches.entries()) {
        lines.push("");
        lines.push(`[${String(index + 1)}] ${formatDisplayPath(workspaceRoot, cwd, patch.file)}`);

        if (patch.reason) {
            lines.push(dim(`    reason: ${patch.reason}`));
        }

        for (const line of patch.oldString.split("\n")) {
            lines.push(red(`  - ${line}`));
        }

        for (const line of patch.newString.split("\n")) {
            lines.push(green(`  + ${line}`));
        }
    }

    return lines.join("\n");
};

const findFirstFailedTask = async (
    workspaceRoot: string,
    runId: string | undefined,
): Promise<{ project: string | undefined; runId: string | undefined; target: string | undefined; taskId: string } | undefined> => {
    const summary = runId === undefined ? await readLastRunSummary(workspaceRoot) : await readRunSummaryById(workspaceRoot, runId);

    if (!summary) {
        return undefined;
    }

    for (const task of summary.tasks) {
        const failed = task.exitCode !== undefined && task.exitCode !== 0;

        if (failed) {
            return {
                project: task.target?.project,
                runId: summary.id,
                target: task.target?.target,
                taskId: task.taskId,
            };
        }
    }

    return undefined;
};

const DEFAULT_VALIDATION_TIMEOUT_MS = 30 * 60 * 1000;

// ----------------------------------------------------------------------
// Phase 1: discover what to heal
//
// Pulled out of `heal()` so `vis ai heal accept` (which receives a
// trigger comment from a webhook payload) can run the same precondition
// checks before re-deriving the proposal.
// ----------------------------------------------------------------------

/** Failed task with the metadata required to validate a fix. */
export interface HealCandidate {
    failedTask: { project: string; runId: string | undefined; target: string; taskId: string };
    failureContext: FailureContext;
}

export type FindHealCandidateResult =
    | ({ outcome: "ready" } & HealCandidate)
    | { failedTask: { project: string | undefined; runId: string | undefined; target: string | undefined; taskId: string }; outcome: "missing-metadata" }
    | { failedTask: { project: string; runId: string | undefined; target: string; taskId: string }; outcome: "no-failure-context" }
    | { outcome: "no-failed-task" };

const findHealCandidate = async (workspaceRoot: string, runId: string | undefined): Promise<FindHealCandidateResult> => {
    const failed = await findFirstFailedTask(workspaceRoot, runId);

    if (!failed) {
        return { outcome: "no-failed-task" };
    }

    if (!failed.project || !failed.target) {
        return { failedTask: failed, outcome: "missing-metadata" };
    }

    const failureContext = await aggregateFailureContext(workspaceRoot, failed.taskId, { runId: failed.runId });

    if (!failureContext) {
        return { failedTask: { project: failed.project, runId: failed.runId, target: failed.target, taskId: failed.taskId }, outcome: "no-failure-context" };
    }

    return {
        failedTask: { project: failed.project, runId: failed.runId, target: failed.target, taskId: failed.taskId },
        failureContext,
        outcome: "ready",
    };
};

// ----------------------------------------------------------------------
// Phase 2: AI proposes a fix and we apply it to disk
//
// `accept` reuses this verbatim — same options, same proposal flow —
// so a comment posted by `heal` and a commit landed by `accept` both
// derive from the same prompt + same patcher.
// ----------------------------------------------------------------------

export type ProposeAndApplyOutcome =
    | "applied"
    | "cannot-fix"
    | "dry-run"
    | "empty-patches"
    | "no-patches-applied"
    | "no-proposal";

export interface ProposeAndApplyResult {
    applyResults?: PatchResult[];
    /** Set when `outcome === "cannot-fix"` — the AI's stated reason. */
    detail?: string;
    outcome: ProposeAndApplyOutcome;
    proposal?: FixProposal;
}

/**
 * Slim toolbox-shape used by {@link proposeAndApply} and
 * {@link validateAppliedFix}. Accepts both `AiHealOptions` (heal) and
 * `AiHealAcceptOptions` (accept) without requiring the latter to carry
 * `dryRun` / `noCache` it doesn't expose.
 */
export interface ProposeAndApplyToolbox {
    logger: Console;
    options: {
        dryRun?: boolean | undefined;
        noCache?: boolean | undefined;
        run?: string | undefined;
        validationTimeout?: number | undefined;
    };
    visConfig?: { ai?: AiConfig | undefined } | undefined;
    workspaceRoot?: string | undefined;
}

const proposeAndApply = async (toolbox: ProposeAndApplyToolbox, candidate: HealCandidate): Promise<ProposeAndApplyResult> => {
    const { logger, options, visConfig, workspaceRoot: wsRoot } = toolbox;
    const workspaceRoot = wsRoot ?? process.cwd();
    const dryRun = options.dryRun === true;

    const aiConfig: AiConfig | undefined = visConfig?.ai;
    const proposal = await runFixAnalysis(candidate.failureContext, logger, {
        cache: options.noCache !== true,
        config: aiConfig,
    });

    if (!proposal) {
        return { outcome: "no-proposal" };
    }

    if (proposal.cannotFix) {
        return { detail: proposal.cannotFix, outcome: "cannot-fix", proposal };
    }

    if (proposal.patches.length === 0) {
        return { outcome: "empty-patches", proposal };
    }

    if (dryRun) {
        return { outcome: "dry-run", proposal };
    }

    const applyResults = await applyFixProposal(workspaceRoot, candidate.failureContext.cwd, proposal);
    const applySummary = summarizeApply(applyResults);

    if (applySummary.applied === 0) {
        return { applyResults, outcome: "no-patches-applied", proposal };
    }

    return { applyResults, outcome: "applied", proposal };
};

// ----------------------------------------------------------------------
// Phase 3: re-run the failing task to confirm the patch fixed it
// ----------------------------------------------------------------------

export interface ValidateAppliedFixDeps {
    /** Inject a fake validator for tests. Defaults to spawning `vis run`. */
    validate?: (project: string, target: string) => Promise<ValidationResult>;
}

const validateAppliedFix = async (
    toolbox: ProposeAndApplyToolbox,
    candidate: HealCandidate,
    deps: ValidateAppliedFixDeps = {},
): Promise<ValidationResult> => {
    const workspaceRoot = toolbox.workspaceRoot ?? process.cwd();
    const validationTimeoutMs
        = toolbox.options.validationTimeout === undefined ? DEFAULT_VALIDATION_TIMEOUT_MS : toolbox.options.validationTimeout * 1000;

    const validate = deps.validate ?? ((project: string, target: string) => validateFixByRerun(workspaceRoot, project, target, validationTimeoutMs));

    return await validate(candidate.failedTask.project, candidate.failedTask.target);
};

// ----------------------------------------------------------------------
// Phase 4: post the proposal as a PR/MR comment
//
// Heal-specific: `accept` does NOT call this — it commits via the SDK
// and posts a different "committed at <sha>" confirmation comment.
// ----------------------------------------------------------------------

export type PostHealCommentOutcome = "no-ci" | "no-pr" | "post-failed" | "posted";

export interface PostHealCommentResult {
    ciContext: CiContext;
    error?: string;
    method?: string;
    outcome: PostHealCommentOutcome;
    /** "PR" for GitHub, "MR" for GitLab — used by callers to phrase log messages. */
    surface: "MR" | "PR";
}

export interface PostHealCommentDeps {
    /** Inject a fake CI context for tests. Defaults to env-based detection. */
    detectCi?: () => Promise<CiContext>;
    /** Inject a fake comment poster for tests. Defaults to gh/REST. */
    postComment?: (body: string, context: CiContext) => Promise<{ error?: string; method: string; posted: boolean }>;
}

const postHealComment = async (
    workspaceRoot: string,
    proposal: FixProposal,
    failureContext: FailureContext,
    deps: PostHealCommentDeps = {},
): Promise<PostHealCommentResult> => {
    const detectCi = deps.detectCi ?? detectCiContext;
    const ciContext = await detectCi();
    const surface = ciContext.provider === "gitlab-ci" ? "MR" : "PR";

    if (ciContext.provider === "unknown") {
        return { ciContext, outcome: "no-ci", surface };
    }

    const commentBody = renderCommentBody(proposal, failureContext, workspaceRoot, ciContext.sha);
    const postCommentImpl = deps.postComment ?? (async (body: string, context: CiContext) => postPrComment({ body, context }));
    const postResult = await postCommentImpl(commentBody, ciContext);

    if (postResult.posted) {
        return { ciContext, method: postResult.method, outcome: "posted", surface };
    }

    if (postResult.method === "skipped") {
        return { ciContext, outcome: "no-pr", surface };
    }

    return { ciContext, error: postResult.error, method: postResult.method, outcome: "post-failed", surface };
};

// ----------------------------------------------------------------------
// Orchestrator: ties the four phases together with user-facing logging
// ----------------------------------------------------------------------

interface HealRunDeps extends ValidateAppliedFixDeps, PostHealCommentDeps {}

const heal = async (toolbox: Toolbox<Console, AiHealOptions>, deps: HealRunDeps = {}): Promise<void> => {
    const { logger, workspaceRoot: wsRoot } = toolbox;
    const workspaceRoot = wsRoot ?? process.cwd();

    const candidateResult = await findHealCandidate(workspaceRoot, toolbox.options.run);

    if (candidateResult.outcome === "no-failed-task") {
        pail.info("No failed tasks found in the latest run summary. Nothing to heal.");

        return;
    }

    if (candidateResult.outcome === "missing-metadata") {
        pail.error(
            `Failed task ${candidateResult.failedTask.taskId} is missing project/target metadata in the run summary; cannot validate a fix.`,
        );
        process.exitCode = 1;

        return;
    }

    if (candidateResult.outcome === "no-failure-context") {
        pail.error(`No failure log or run summary found for ${candidateResult.failedTask.taskId}.`);
        process.exitCode = 1;

        return;
    }

    const candidate: HealCandidate = { failedTask: candidateResult.failedTask, failureContext: candidateResult.failureContext };

    pail.info(`Healing ${candidate.failedTask.taskId} (run ${candidate.failedTask.runId ?? "unknown"})`);

    if (!candidate.failureContext.terminalOutputCaptured) {
        pail.warn(`No captured terminal output for ${candidate.failedTask.taskId}; the AI proposal will be weaker without it.`);
    }

    const proposeResult = await proposeAndApply(toolbox, candidate);

    if (proposeResult.outcome === "no-proposal") {
        pail.error("AI fix proposal failed or no provider available.");
        process.exitCode = 1;

        return;
    }

    if (proposeResult.outcome === "cannot-fix") {
        pail.warn(`AI declined to fix: ${proposeResult.detail ?? "(no reason)"}`);

        return;
    }

    if (proposeResult.outcome === "empty-patches") {
        pail.warn("AI returned an empty patch set.");

        return;
    }

    // proposal is defined for the remaining outcomes (dry-run, no-patches-applied, applied)
    const proposal = proposeResult.proposal as FixProposal;

    logger.info(renderProposalForLog(proposal, workspaceRoot, candidate.failureContext.cwd));

    if (proposeResult.outcome === "dry-run") {
        pail.info("Dry run: skipping apply, validation, and PR comment.");

        return;
    }

    const applyResults = proposeResult.applyResults ?? [];
    const applySummary = summarizeApply(applyResults);

    pail.info(`Applied ${String(applySummary.applied)}/${String(applyResults.length)} patches.`);

    if (proposeResult.outcome === "no-patches-applied") {
        pail.error("No patches could be applied (all failed validation).");
        process.exitCode = 1;

        return;
    }

    pail.info(`Re-running ${candidate.failedTask.taskId} to validate the fix...`);

    const validation = await validateAppliedFix(toolbox, candidate, { validate: deps.validate });

    if (validation.exitCode !== 0) {
        pail.error(`Validation failed (exit ${String(validation.exitCode)}). Patch is not posted.`);

        if (validation.stderr.trim().length > 0) {
            logger.info(yellow("--- validation stderr (tail) ---"));
            logger.info(validation.stderr.split("\n").slice(-20).join("\n"));
        }

        process.exitCode = 1;

        return;
    }

    pail.success(`Validation passed.`);

    const postResult = await postHealComment(workspaceRoot, proposal, candidate.failureContext, {
        detectCi: deps.detectCi,
        postComment: deps.postComment,
    });

    if (postResult.outcome === "no-ci") {
        pail.notice("Not running in a recognised CI provider; skipping PR comment. Patch was applied + validated locally.");

        return;
    }

    if (postResult.outcome === "posted") {
        pail.success(`Posted fix proposal to ${postResult.surface} #${String(postResult.ciContext.prNumber)} via ${postResult.method ?? "unknown"}.`);

        return;
    }

    if (postResult.outcome === "no-pr") {
        pail.notice(`No ${postResult.surface} number detected (push-event run); skipping comment.`);

        return;
    }

    pail.error(`Failed to post ${postResult.surface} comment: ${postResult.error ?? "unknown error"}`);
};

export const aiHeal: CommandExecute<Toolbox<Console, AiHealOptions>> = async (toolbox) => {
    await heal(toolbox);
};

export {
    findHealCandidate,
    pickFence as pickFenceForTesting,
    postHealComment,
    proposeAndApply,
    renderCommentBody as renderCommentBodyForTesting,
    renderProposalDiff as renderProposalDiffForTesting,
    heal as runHealForTesting,
    validateAppliedFix,
};
