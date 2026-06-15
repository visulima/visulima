/**
 * `vis release ci snapshot` — runs on PRs; publishes snapshots and posts a
 * sticky comment with install instructions for each preview package.
 *
 * Defaults dist-tag to `pr-&lt;number>` resolved from $GITHUB_REF when --tag
 * is not given. Replaces visulima's `scripts/publish-preview-release.js`.
 */

import type { CommandExecute, Toolbox } from "@visulima/cerebro";

import { buildContext } from "../../../../release/core/orchestrator";
import { createRemoteClient, detectRemoteProvider } from "../../../../release/core/remote/detect";
import { createShellRunner } from "../../../../release/core/shell-runner";
import { runSnapshot } from "../../../../release/core/snapshot";
import type { ReleaseCiSnapshotOptions } from "./index";

const renderInstallSnippet = (
    packages: { name: string; version: string }[],
    registry: string | undefined,
): string => {
    if (packages.length === 0) {
        return "_No packages were affected by this PR._";
    }

    const lines: string[] = ["### 📦 Preview Packages", ""];

    for (const pkg of packages) {
        const installSpec = `${pkg.name}@${pkg.version}`;

        lines.push(`- \`${pkg.name}\` → \`${pkg.version}\``);

        if (registry) {
            lines.push(`  \`\`\`sh\n  npm i ${installSpec} --registry ${registry}\n  \`\`\``);
        } else {
            lines.push(`  \`\`\`sh\n  npm i ${installSpec}\n  \`\`\``);
        }
    }

    return lines.join("\n");
};

const execute = async ({ logger, options, workspaceRoot }: Toolbox<Console, ReleaseCiSnapshotOptions>): Promise<void> => {
    const cwd = workspaceRoot ?? process.cwd();
    const runner = createShellRunner();

    const provider = await detectRemoteProvider(cwd, runner, undefined);
    const client = createRemoteClient(provider);
    const pr = client.detectPullRequestNumber(process.env);
    const tag = options.tag ?? (pr ? `pr-${pr}` : undefined);

    if (!tag) {
        logger.error("Could not determine snapshot tag. Pass --tag or run in a PR context (GITHUB_REF=refs/pull/<n>/merge).");
        process.exitCode = 1;

        return;
    }

    // PR-close cleanup mode (RFC §13.4)
    if (options.onClose) {
        await handlePrCloseCleanup(cwd, runner, client, pr, logger);

        return;
    }

    let ctx;
    let result;

    try {
        ctx = await buildContext({ cwd });

        const { printConfigIfRequested } = await import("../../../../release/core/print-config");

        if (printConfigIfRequested(options, ctx, logger)) {
            return;
        }

        result = await runSnapshot({ context: ctx, runner, tag });
    } catch (error) {
        logger.error(`Snapshot failed: ${(error as Error).message}`);
        process.exitCode = 1;

        return;
    }

    logger.info(`Snapshotted ${result.published.length} package(s) at version ${result.snapshotVersion} → tag "${result.tag}"`);

    if (!pr) {
        return;
    }

    const repo = await client.detectRepoSlug(cwd, runner);

    if (!repo) {
        logger.warn("Could not detect repo slug — skipping sticky PR comment.");

        return;
    }

    const marker = "<!-- vis-release-snapshot-comment -->";
    const body = `${marker}\n\n${renderInstallSnippet(result.published, ctx.config.snapshot?.registry)}`;

    // Soft-fail: the snapshot is already published. A transient API failure
    // here shouldn't fail the whole CI job — log a warning and continue.
    try {
        const commentResult = await client.upsertStickyComment(runner, {
            body,
            cwd,
            issueNumber: pr,
            marker,
            repo,
        });

        if (commentResult) {
            logger.info(`${commentResult.created ? "Posted" : "Updated"} snapshot comment on PR #${pr}.`);
        }
    } catch (error) {
        logger.warn(`upsertStickyComment failed (publish already succeeded): ${(error as Error).message}`);
    }
};

/**
 * PR-close cleanup (RFC §13.4): enumerate every commit SHA in the closed
 * PR via `gh api repos/.../pulls/N/commits`, compute the cross product
 * with `snapshot.tags`, and emit deletion intents.
 *
 * Default behavior with `pkg-pr-new` is no-op (pkg-pr-new GCs automatically).
 * For custom backends with a delete API, this is where they'd hook in.
 */
const handlePrCloseCleanup = async (
    cwd: string,
    runner: ReturnType<typeof createShellRunner>,
    client: ReturnType<typeof createRemoteClient>,
    pr: number | undefined,
    logger: Toolbox<Console, ReleaseCiSnapshotOptions>["logger"],
): Promise<void> => {
    if (!pr) {
        logger.error("PR-close cleanup requires a PR context.");
        process.exitCode = 1;

        return;
    }

    const repo = await client.detectRepoSlug(cwd, runner);

    if (!repo) {
        logger.warn("Could not detect repo slug — skipping cleanup.");

        return;
    }

    const result = await runner.run("gh", ["api", `repos/${repo}/pulls/${pr}/commits`, "--paginate"], { cwd, silent: true });

    if (result.exitCode !== 0) {
        logger.warn(`gh api failed: ${result.stderr}`);

        return;
    }

    let commits: { sha: string }[];

    try {
        commits = JSON.parse(result.stdout) as { sha: string }[];
    } catch {
        logger.warn("Could not parse gh api output.");

        return;
    }

    const tagPatterns: string[] = [`pr-${pr}`];

    for (const commit of commits) {
        tagPatterns.push(commit.sha, commit.sha.slice(0, 7));
    }

    logger.info(`Cleanup intent for PR #${pr}: ${tagPatterns.length} tag pattern(s) across ${commits.length} commit(s)`);

    // No-op for the default pkg-pr-new backend — it GCs automatically by TTL.
    // Custom backends (e.g. self-hosted alchemy pr-package Worker) can extend
    // this to issue DELETE requests against their tag indexes.
    logger.info("Default backend (pkg-pr-new) auto-cleans by TTL — no DELETE issued. Implement a custom backend's delete endpoint to enable real cleanup.");
};

export default execute as CommandExecute<Toolbox>;
