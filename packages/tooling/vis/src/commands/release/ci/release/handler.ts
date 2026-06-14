/**
 * `vis release ci release` — main CI release driver (RFC §16.1).
 *
 * Two modes (selectable per channel via `release.channels.&lt;name>.mode`,
 * overridable via --auto-publish flag):
 *
 *   version-pr (default for main/next):
 *     - Pending change files exist:
 *         1. Run version-apply in a temp branch
 *         2. Force-push to release.versionPr.branch (default `vis-release/
 *            version-packages`) using VIS_GH_TOKEN
 *         3. Open or update the "Versioned release" PR (sticky-comment
 *            via marker pattern)
 *     - No pending change files:
 *         1. Detect the current push as a release-PR merge
 *         2. Publish + tag + push tags + create GH releases
 *
 *   auto-publish (default for alpha/beta):
 *     - Always: version + publish inline. No PR step. Commit lands
 *       directly on the release branch.
 *
 * Token resolution:
 *   - For comments / reads: GH_TOKEN (default `${{ github.token }}`)
 *   - For force-pushing the version-PR branch: VIS_GH_TOKEN
 *     (the default token is anti-recursion-locked so it can't trigger
 *     downstream workflows on the version-PR)
 */

import type { CerebroFs, CommandExecute, Toolbox } from "@visulima/cerebro";

import { DEFAULT_CHANGES_DIR } from "../../../../release/config";
import { readChangeFiles } from "../../../../release/core/change-file-reader";
import { getCurrentBranch, hasUncommittedChanges, pushBranch, stageAndCommit } from "../../../../release/core/git";
import { applyContext, buildContext, publishContext } from "../../../../release/core/orchestrator";
import { createShellRunner } from "../../../../release/core/shell-runner";
import { stateFilePath } from "../../../../release/core/state";
import { detectRepoSlug } from "../../../../release/core/sticky-comment";
import { mergeProtectedContent } from "../../../../release/core/version-pr-merge";
import type { ReleaseCiReleaseOptions } from "./index";

/**
 * Detect whether `&lt;changesDir>/.state.json` exists — used by the C7
 * idempotency check. A present state file from a prior partial publish
 * means the next CI re-run should resume that wave instead of starting
 * a fresh publish loop (which would replay every package).
 */
const hasPriorStateFile = async (fs: CerebroFs, cwd: string, changesDir: string): Promise<boolean> => {
    try {
        await fs.access(stateFilePath(cwd, changesDir));

        return true;
    } catch {
        return false;
    }
};

const findOrCreateVersionPr = async (
    runner: ReturnType<typeof createShellRunner>,
    logger: Console,
    cwd: string,
    branch: string,
    title: string,
    body: string,
    baseBranch: string,
): Promise<{ existing: boolean; number: number } | undefined> => {
    // Check for existing PR head=<branch>
    const list = await runner.run(
        "gh",
        ["pr", "list", "--head", branch, "--state", "open", "--json", "number"],
        { cwd, silent: true },
    );

    if (list.exitCode === 0 && list.stdout.trim() !== "" && list.stdout.trim() !== "[]") {
        try {
            const parsed = JSON.parse(list.stdout) as { number: number }[];

            if (parsed[0]) {
                // Protected-edit merge (release-please #877). Read the
                // existing PR body and splice any operator-edited
                // `<!-- vis:user-content -->…<!-- /vis:user-content -->`
                // regions into the freshly-generated body before posting.
                // Best-effort: if the read fails (network, perms, etc.)
                // we proceed with the new body unmerged — losing the
                // protection is worse than not refreshing the PR.
                //
                // F7/F18: if the merger itself refuses (nested or
                // unbalanced markers — both fail-safes against silent
                // edit loss), surface the failure as a CI-tail
                // `logger.warn` so the operator sees it AND skip the
                // `gh pr edit --body` invocation entirely. Overwriting
                // with the freshly-generated body would destroy ALL
                // operator content in every previously well-formed
                // protected block — strictly worse than the pre-F18
                // behaviour. We still refresh the title/labels below.
                let mergedBody = body;
                let skipBodyUpdate = false;

                try {
                    const viewResult = await runner.run(
                        "gh",
                        ["pr", "view", String(parsed[0].number), "--json", "body", "-q", ".body"],
                        { cwd, silent: true },
                    );

                    if (viewResult.exitCode === 0) {
                        // `gh pr view -q .body` emits the raw body
                        // followed by a trailing newline.
                        try {
                            mergedBody = mergeProtectedContent(viewResult.stdout.replace(/\n$/, ""), body);
                        } catch (error) {
                            skipBodyUpdate = true;
                            logger.warn(
                                `Skipping PR body update for #${parsed[0].number} — protected-content blocks are unbalanced, refusing to overwrite operator content. Please clean up markers manually. Cause: ${(error as Error).message}`,
                            );
                        }
                    }
                } catch (error) {
                    logger.warn(
                        `Could not read existing body of PR #${parsed[0].number} for protected-edit merge: ${(error as Error).message}. Proceeding with the unmerged body.`,
                    );
                }

                // Edit existing. When the merger refused (unbalanced /
                // nested markers), drop the `--body` flag so the
                // existing PR description is left untouched — title and
                // metadata (labels/reviewers/etc.) can still refresh.
                const editArgs = skipBodyUpdate
                    ? ["pr", "edit", String(parsed[0].number), "--title", title]
                    : ["pr", "edit", String(parsed[0].number), "--title", title, "--body", mergedBody];
                const editResult = await runner.run("gh", editArgs, { cwd, silent: true });

                if (editResult.exitCode !== 0) {
                    throw new Error(`gh pr edit #${parsed[0].number} failed: ${editResult.stderr.trim()}`);
                }

                return { existing: true, number: parsed[0].number };
            }
        } catch {
            // fall through to create
        }
    }

    const create = await runner.run(
        "gh",
        ["pr", "create", "--head", branch, "--base", baseBranch, "--title", title, "--body", body],
        { cwd, silent: true },
    );

    if (create.exitCode !== 0) {
        return undefined;
    }

    // Output ends with the URL; extract the number.
    const match = /\/pull\/(\d+)/.exec(create.stdout);

    return match ? { existing: false, number: Number.parseInt(match[1] ?? "0", 10) } : undefined;
};

/**
 * Apply labels, reviewers, and assignees to the version PR. Each call
 * is best-effort — labels that already exist are no-ops, reviewers that
 * already reviewed are skipped by gh. Failures are logged but don't
 * abort the release (the PR itself is the deliverable).
 */
const applyPrMetadata = async (
    runner: ReturnType<typeof createShellRunner>,
    cwd: string,
    prNumber: number,
    metadata: { assignees?: string[]; labels?: string[]; reviewers?: string[] },
): Promise<void> => {
    const labels = metadata.labels ?? ["autorelease: pending"];

    if (labels.length > 0) {
        await runner.run(
            "gh",
            ["pr", "edit", String(prNumber), ...labels.flatMap((l) => ["--add-label", l])],
            { cwd, silent: true },
        );
    }

    if (metadata.reviewers && metadata.reviewers.length > 0) {
        // gh pr edit --add-reviewer accepts comma-separated values.
        await runner.run(
            "gh",
            ["pr", "edit", String(prNumber), "--add-reviewer", metadata.reviewers.join(",")],
            { cwd, silent: true },
        );
    }

    if (metadata.assignees && metadata.assignees.length > 0) {
        await runner.run(
            "gh",
            ["pr", "edit", String(prNumber), "--add-assignee", metadata.assignees.join(",")],
            { cwd, silent: true },
        );
    }
};

const execute = async ({ fs, logger, options, workspaceRoot }: Toolbox<Console, ReleaseCiReleaseOptions>): Promise<void> => {
    const cwd = workspaceRoot ?? process.cwd();
    const runner = createShellRunner();

    const ctx = await buildContext({ channel: options.channel, cwd });

    const { printConfigIfRequested } = await import("../../../../release/core/print-config");

    if (printConfigIfRequested(options, ctx, logger)) {
        return;
    }

    const mode: "version-pr" | "auto-publish" = options.autoPublish === true ? "auto-publish" : (ctx.channel?.mode ?? "auto-publish");

    if (await hasUncommittedChanges({ cwd, runner })) {
        logger.warn("Working tree has uncommitted changes. CI mode requires a clean tree.");
        process.exitCode = 1;

        return;
    }

    const { files: pendingFiles } = await readChangeFiles({ changesDir: ctx.config.changesDir, cwd });

    if (mode === "auto-publish") {
        if (pendingFiles.length === 0) {
            logger.info("No pending change files. Nothing to release.");

            return;
        }

        logger.info(`Auto-publish mode — versioning + publishing ${ctx.plan.releases.length} package(s).`);

        await applyContext(ctx, { commit: true });

        // C7 fix: pass `resume: true` so a partial-failure re-run picks
        // up where the prior wave left off. The version commit is
        // durable (it landed in the previous attempt's `applyContext`
        // and was pushed to the remote, or it just landed now); on
        // retry the publish should converge by skipping already-
        // published packages from `.state.json` rather than replaying
        // every package from scratch.
        const publishResult = await publishContext(ctx, { resume: true, tag: ctx.channel?.tag });

        // Push the version commit + tags
        const branch = await getCurrentBranch({ cwd, runner });

        if (branch) {
            try {
                await pushBranch({ cwd, runner }, branch);
            } catch (error) {
                logger.error(`Failed to push branch: ${(error as Error).message}`);
            }
        }

        logger.info(`Published: ${publishResult.published.length} | Skipped: ${publishResult.skipped.length} | Failed: ${publishResult.failed.length}`);

        process.exitCode = publishResult.failed.length > 0 ? 2 : 0;

        return;
    }

    // version-pr mode
    if (pendingFiles.length === 0) {
        // C7 fix: distinguish "fresh merge-detected → publish from scratch"
        // from "prior wave was mid-publish → resume". `.state.json` only
        // exists when a publish step was interrupted (we clear it on
        // success). State-file present → pass `resume: true` so we
        // don't replay every package and either crash on already-
        // published versions or create parallel stages.
        const changesDir = ctx.config.changesDir ?? DEFAULT_CHANGES_DIR;
        const resumeWave = await hasPriorStateFile(fs, cwd, changesDir);

        if (resumeWave) {
            logger.info("No pending change files but `.state.json` is present — resuming the prior wave's publish.");
        } else {
            logger.info("No pending change files — assuming this push is a merged release PR. Publishing.");
        }

        const publishResult = await publishContext(ctx, { resume: resumeWave, tag: ctx.channel?.tag });

        logger.info(`Published: ${publishResult.published.length} | Skipped: ${publishResult.skipped.length} | Failed: ${publishResult.failed.length}`);

        process.exitCode = publishResult.failed.length > 0 ? 2 : 0;

        return;
    }

    logger.info(`Version-PR mode — maintaining release PR for ${ctx.plan.releases.length} package(s).`);

    const branch = options.branch ?? ctx.config.versionPr?.branch ?? "vis-release/version-packages";
    const title = ctx.config.versionPr?.title ?? "🚀 Versioned release";
    const repo = await detectRepoSlug(runner, cwd);

    if (!repo) {
        logger.error("Could not detect repository slug via gh CLI. Cannot maintain version PR.");
        process.exitCode = 1;

        return;
    }

    // Apply versions in a temp branch
    const switchResult = await runner.run("git", ["switch", "-C", branch], { cwd, silent: true });

    if (switchResult.exitCode !== 0) {
        logger.error(`Could not switch to ${branch}: ${switchResult.stderr}`);
        process.exitCode = 1;

        return;
    }

    const applied = await applyContext(ctx, { commit: false });

    const stageList = [...applied.changedFiles, ...applied.deletedFiles];

    if (stageList.length === 0) {
        logger.warn("Apply produced no file changes. Aborting version PR.");

        return;
    }

    await stageAndCommit(
        { cwd, runner },
        stageList,
        ctx.config.gitUser
            ? `release(${ctx.channel?.tag ?? "main"}): version packages [skip ci]`
            : "release: version packages [skip ci]",
        { author: ctx.config.gitUser },
    );

    // Push (using VIS_GH_TOKEN if available — CI workflow exports it)
    try {
        await pushBranch({ cwd, runner }, branch, { force: true });
    } catch (error) {
        logger.error(`Could not push ${branch}: ${(error as Error).message}`);
        process.exitCode = 1;

        return;
    }

    // Open / update the PR
    const baseBranch = ctx.branch ?? ctx.config.baseBranch ?? "main";
    const body = `${ctx.config.versionPr?.preamble ?? ""}\n\n## Pending releases\n\n${ctx.plan.releases.map((r) => `- \`${r.name}\`: ${r.oldVersion} → **${r.newVersion}**`).join("\n")}\n`;
    const pr = await findOrCreateVersionPr(runner, logger, cwd, branch, title, body, baseBranch);

    if (pr) {
        logger.info(`${pr.existing ? "Updated" : "Opened"} version PR #${pr.number}.`);

        // Apply labels every refresh (idempotent — gh swallows duplicates),
        // reviewers / assignees only on first creation (avoid spamming
        // existing reviewers with re-request notifications).
        await applyPrMetadata(runner, cwd, pr.number, {
            assignees: pr.existing ? undefined : ctx.config.versionPr?.assignees,
            labels: ctx.config.versionPr?.labels,
            reviewers: pr.existing ? undefined : ctx.config.versionPr?.reviewers,
        });

        // Enable auto-merge once status checks pass. Idempotent: if it's
        // already on, gh exits 0; if the repo doesn't allow auto-merge,
        // gh prints a clear error and we log + carry on (the PR itself
        // is the deliverable).
        if (ctx.config.versionPr?.autoMerge && !pr.existing) {
            const method = ctx.config.versionPr.autoMergeMethod ?? "squash";
            const enable = await runner.run(
                "gh",
                ["pr", "merge", String(pr.number), "--auto", `--${method}`],
                { cwd, silent: true },
            );

            if (enable.exitCode === 0) {
                logger.info(`Auto-merge enabled (${method}).`);
            } else {
                logger.warn(`Could not enable auto-merge on PR #${pr.number}: ${enable.stderr.trim() || `exit ${enable.exitCode}`}`);
            }
        }
    } else {
        logger.error("Failed to create / update version PR.");
        process.exitCode = 1;
    }

    // Post-publish label transition. If we're in the "no pending change
    // files → assume PR-merge" branch and the publish step succeeded,
    // bump the label from "autorelease: pending" to "autorelease: tagged"
    // on the merged release PR. Skipped silently when we can't detect
    // the PR (e.g. workflow_dispatch invocation rather than push).
    // NB: this path is unreachable here — the publish-then-tag-then-label
    // transition happens in publishContext (orchestrator) since that's
    // where tagging completes. Labels for the merge PR are handled there.
};

export default execute as CommandExecute<Toolbox>;
