import type { CommandExecute, Toolbox } from "@visulima/cerebro";

import { applyContext, buildContext } from "../../../release/core/orchestrator";
import { VisReleaseError } from "../../../release/errors";
import type { ReleaseVersionOptions } from "./index";

const execute = async ({ logger, options, workspaceRoot }: Toolbox<Console, ReleaseVersionOptions>): Promise<void> => {
    const cwd = workspaceRoot ?? process.cwd();
    const dryRun = options.dryRun === true;

    const ctx = await buildContext({
        channel: options.channel,
        cwd,
        firstRelease: options.firstRelease === true,
        projects: options.filter ? options.filter.split(",").map((s) => s.trim()).filter(Boolean) : undefined,
    });

    const { printConfigIfRequested } = await import("../../../release/core/print-config");

    if (printConfigIfRequested(options, ctx, logger)) {
        return;
    }

    if (options.checkOnly === true) {
        logger.info(`Preflight: ${ctx.plan.releases.length} pending release(s)${ctx.channel ? ` on channel "${ctx.channel.tag}"` : ""}.`);

        if (ctx.plan.warnings.length > 0) {
            for (const w of ctx.plan.warnings) {
                logger.warn(`  - ${w}`);
            }
        }

        process.exitCode = ctx.plan.releases.length === 0 ? 1 : 0;

        return;
    }

    if (ctx.plan.releases.length === 0) {
        logger.info("No pending releases — nothing to version.");
        process.exitCode = 0;

        return;
    }

    if (ctx.channel) {
        logger.info(`Channel: ${ctx.channel.tag}${ctx.channel.prerelease ? ` (preid: ${ctx.channel.prerelease})` : ""}`);
    }

    logger.info(`${dryRun ? "[dry-run] would version" : "Versioning"} ${ctx.plan.releases.length} package(s)...`);

    for (const release of ctx.plan.releases) {
        logger.info(`  ${release.name}: ${release.oldVersion} → ${release.newVersion}`);
    }

    let result;

    try {
        result = await applyContext(ctx, { commit: options.commit === true, dryRun });
    } catch (error) {
        if (error instanceof VisReleaseError && error.code === "STAGE_PENDING") {
            logger.error(error.message);

            if (error.hint) {
                logger.info("");
                logger.info(`Next steps: ${error.hint}`);
            }

            process.exitCode = 1;

            return;
        }

        throw error;
    }

    if (dryRun) {
        logger.info("");
        logger.info(`[dry-run] would write ${result.changedFiles.length} file(s):`);

        for (const path of result.changedFiles) {
            logger.info(`  ${path}`);
        }

        if (result.deletedFiles.length > 0) {
            logger.info(`[dry-run] would delete ${result.deletedFiles.length} change file(s):`);

            for (const path of result.deletedFiles) {
                logger.info(`  ${path}`);
            }
        }

        logger.info("");
        logger.info("Dry run complete. No changes made.");
    } else {
        logger.info("");
        logger.info(`Wrote ${result.changedFiles.length} file(s); deleted ${result.deletedFiles.length} consumed change file(s).`);

        if (result.commitSha) {
            logger.info(`Committed as ${result.commitSha.slice(0, 7)}.`);
        } else if (options.commit) {
            logger.warn("--commit was requested but no commit was made (likely no changes to commit).");
        }
    }

    if (ctx.plan.warnings.length > 0) {
        logger.info("");
        logger.warn(`${ctx.plan.warnings.length} warning(s):`);

        for (const w of ctx.plan.warnings) {
            logger.warn(`  - ${w}`);
        }
    }
};

export default execute as CommandExecute<Toolbox>;
