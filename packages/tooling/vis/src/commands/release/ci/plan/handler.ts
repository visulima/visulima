/**
 * `vis release ci plan` — emit machine-readable plan for workflow gating.
 *
 * Sets $GITHUB_OUTPUT keys: `mode` (publish | version-pr | nothing),
 * `packages` (CSV of names), `json` (full plan).
 *
 * Matches bumpy's ci plan contract so downstream workflow steps can
 * conditionally skip expensive build steps.
 */

import { appendFileSync } from "node:fs";

import type { CommandExecute, Toolbox } from "@visulima/cerebro";

import { buildContext } from "../../../../release/core/orchestrator";
import type { ReleaseCiPlanOptions } from "./index";

const execute = async ({ logger, options, workspaceRoot }: Toolbox<Console, ReleaseCiPlanOptions>): Promise<void> => {
    const cwd = workspaceRoot ?? process.cwd();
    const ctx = await buildContext({ cwd, skipRegistryLookup: true });

    const { printConfigIfRequested } = await import("../../../../release/core/print-config");

    if (printConfigIfRequested(options, ctx, logger)) {
        return;
    }

    const mode = ctx.plan.releases.length === 0 ? "nothing" : ctx.channel?.mode === "version-pr" ? "version-pr" : "publish";
    const packageNames = ctx.plan.releases.map((r) => r.name);

    const out = {
        channel: ctx.channel?.tag,
        mode,
        packages: packageNames,
        plan: ctx.plan.releases.map((r) => {
            return {
                isCascadeBump: r.isCascadeBump,
                isDependencyBump: r.isDependencyBump,
                isGroupBump: r.isGroupBump,
                name: r.name,
                newVersion: r.newVersion,
                oldVersion: r.oldVersion,
                type: r.type,
            };
        }),
        prerelease: ctx.channel?.prerelease,
        warnings: ctx.plan.warnings,
    };

    process.stdout.write(`${JSON.stringify(out, null, 2)}\n`);

    const githubOutput = process.env["GITHUB_OUTPUT"];

    if (githubOutput) {
        const lines: string[] = [
            `mode=${mode}`,
            `packages=${packageNames.join(",")}`,
            `json<<__VIS_RELEASE_EOF__\n${JSON.stringify(out)}\n__VIS_RELEASE_EOF__`,
        ];

        try {
            appendFileSync(githubOutput, `${lines.join("\n")}\n`);
        } catch (error) {
            logger.warn(`Could not write $GITHUB_OUTPUT: ${(error as Error).message}`);
        }
    }
};

export default execute as CommandExecute<Toolbox>;
