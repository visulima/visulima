/**
 * `vis release ci rebase-pr` — fetch base, rebase the version-PR branch
 * onto it, and force-push.
 *
 * Use case: the version-PR sits open for days while reviewers consider
 * a release; meanwhile other PRs land on `main`. Without periodic
 * rebases, the version-PR's diff becomes confusing (it includes
 * unrelated changes) and the eventual merge is messier than it needs
 * to be.
 *
 * CI workflows can run this on a cron (e.g. nightly) — it's idempotent
 * and a no-op when the branch is already up to date.
 *
 * Conflicts during rebase abort the operation cleanly: the rebase is
 * `git rebase --abort`'d, the working tree is restored, and the
 * command exits non-zero so the operator notices. Resolving conflicts
 * is intentionally a human task — silently dropping conflicting
 * commits would corrupt the version PR.
 */

import type { CommandExecute, Toolbox } from "@visulima/cerebro";

import { buildContext } from "../../../../release/core/orchestrator";
import { createShellRunner } from "../../../../release/core/shell-runner";
import type { ReleaseCiRebasePrOptions } from "./index";

const execute = async ({ logger, options, workspaceRoot }: Toolbox<Console, ReleaseCiRebasePrOptions>): Promise<void> => {
    const cwd = workspaceRoot ?? process.cwd();
    const runner = createShellRunner();

    const ctx = await buildContext({ cwd });

    const branch = options.branch ?? ctx.config.versionPr?.branch ?? "vis-release/version-packages";
    const baseBranch = options.base ?? ctx.config.baseBranch ?? "main";

    logger.info(`Rebasing ${branch} onto ${baseBranch}...`);

    // Verify the PR branch exists locally OR fetch it.
    const fetchResult = await runner.run("git", ["fetch", "origin", `${branch}:${branch}`, baseBranch], { cwd, silent: true });

    if (fetchResult.exitCode !== 0) {
        // Branch may not exist on the remote yet — surface and exit 0
        // (cron jobs shouldn't fail on a missing branch; there's just
        // nothing to rebase).
        logger.info(`No remote branch ${branch} to rebase (${fetchResult.stderr.trim() || "fetch failed"}). Skipping.`);

        return;
    }

    const switchResult = await runner.run("git", ["switch", branch], { cwd, silent: true });

    if (switchResult.exitCode !== 0) {
        logger.error(`Could not switch to ${branch}: ${switchResult.stderr.trim()}`);
        process.exitCode = 1;

        return;
    }

    const rebaseResult = await runner.run("git", ["rebase", `origin/${baseBranch}`], { cwd, silent: true });

    if (rebaseResult.exitCode !== 0) {
        // Abort cleanly so the worktree isn't left in a half-rebased
        // state. Operator runs vis release ci release to recompute the
        // version PR from scratch on the next push.
        await runner.run("git", ["rebase", "--abort"], { cwd, silent: true });

        logger.error(
            `Rebase produced conflicts; aborting. Resolve manually, or let the next \`vis release ci release\` recompute the version PR from scratch.`,
        );
        process.exitCode = 1;

        return;
    }

    // No-op detection: if rebase didn't change HEAD, skip the push.
    const aheadResult = await runner.run("git", ["rev-list", "--count", `origin/${branch}..${branch}`], { cwd, silent: true });

    if (aheadResult.exitCode === 0 && aheadResult.stdout.trim() === "0") {
        logger.info(`${branch} is already up to date with ${baseBranch}. Nothing to push.`);

        return;
    }

    const pushResult = await runner.run("git", ["push", "--force-with-lease", "origin", `${branch}:${branch}`], { cwd, silent: true });

    if (pushResult.exitCode !== 0) {
        logger.error(`Failed to force-push ${branch}: ${pushResult.stderr.trim()}`);
        process.exitCode = 1;

        return;
    }

    logger.info(`Force-pushed ${branch} after rebasing onto ${baseBranch}.`);
};

export default execute as CommandExecute<Toolbox>;
