/**
 * `vis release ci check` — runs on every PR; posts/updates a sticky comment
 * showing which packages will be released if this PR merges (RFC §16.1).
 */

import type { CommandExecute, Toolbox } from "@visulima/cerebro";

import { buildContext } from "../../../../release/core/orchestrator";
import { escapeMarkdown } from "../../../../release/core/security";
import { createShellRunner } from "../../../../release/core/shell-runner";
import { detectPullRequestNumber, detectRepoSlug, upsertStickyComment } from "../../../../release/core/sticky-comment";
import type { ReleaseCiCheckOptions } from "./index";

const renderBody = (
    plan: ReturnType<typeof buildContext> extends Promise<infer T> ? (T extends { plan: infer P } ? P : never) : never,
    channel: string | undefined,
): string => {
    const lines: string[] = ["### 🚀 Release Plan", ""];

    if (channel) {
        lines.push(`Channel: \`${channel}\``);
        lines.push("");
    }

    if (plan.releases.length === 0) {
        lines.push("_No pending releases._ (Add a change file via `vis release add` to mark this PR as releasing.)");

        return lines.join("\n");
    }

    const groups: Record<"major" | "minor" | "patch", typeof plan.releases> = { major: [], minor: [], patch: [] };

    for (const release of plan.releases) {
        groups[release.type].push(release);
    }

    for (const type of ["major", "minor", "patch"] as const) {
        if (groups[type].length === 0) {
            continue;
        }

        lines.push(`#### ${type.charAt(0).toUpperCase()}${type.slice(1)}`);
        lines.push("");

        for (const release of groups[type]) {
            const flags: string[] = [];

            if (release.isCascadeBump) {
                flags.push("cascade");
            }

            if (release.isGroupBump) {
                flags.push("group");
            }

            if (release.isDependencyBump && !release.isCascadeBump) {
                flags.push("dep-bump");
            }

            const flagSuffix = flags.length > 0 ? ` _(${flags.join(", ")})_` : "";

            lines.push(`- \`${release.name}\`: ${release.oldVersion} → **${release.newVersion}**${flagSuffix}`);
        }

        lines.push("");
    }

    if (plan.warnings.length > 0) {
        lines.push("#### ⚠️ Warnings");
        lines.push("");

        for (const w of plan.warnings) {
            // Warnings can come from arbitrary sources (config, plan), so escape.
            lines.push(`- ${escapeMarkdown(w)}`);
        }
    }

    return lines.join("\n");
};

const execute = async ({ logger, options, workspaceRoot }: Toolbox<Console, ReleaseCiCheckOptions>): Promise<void> => {
    const cwd = workspaceRoot ?? process.cwd();
    const noFail = options.noFail === true;
    const strict = options.strict === true;

    const runner = createShellRunner();
    const repo = await detectRepoSlug(runner, cwd);
    const pr = detectPullRequestNumber(process.env);

    if (!repo || !pr) {
        logger.warn("Not running in a PR context (GITHUB_REF / PR_NUMBER missing or `gh repo view` failed). Falling back to local print.");
    }

    const ctx = await buildContext({ cwd, skipRegistryLookup: true });

    const { printConfigIfRequested } = await import("../../../../release/core/print-config");

    if (printConfigIfRequested(options, ctx, logger)) {
        return;
    }

    const marker = ctx.config.versionPr?.commentMarker ?? "<!-- vis-release-comment -->";
    const body = renderBody(ctx.plan, ctx.channel?.tag);

    if (repo && pr) {
        const result = await upsertStickyComment({
            body,
            cwd,
            issueNumber: pr,
            marker,
            repo,
            runner,
        });

        if (result) {
            logger.info(`${result.created ? "Posted" : "Updated"} release-plan comment on PR #${pr} (id: ${result.id}).`);
        } else {
            logger.error("Failed to post / update PR comment.");
            process.exitCode = noFail ? 0 : 1;

            return;
        }
    } else {
        logger.info(body);
    }

    if (strict && ctx.plan.releases.length === 0) {
        logger.error("--strict and no pending releases.");
        process.exitCode = noFail ? 0 : 1;
    }
};

export default execute as CommandExecute<Toolbox>;
