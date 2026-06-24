import type { CommandExecute, Toolbox } from "@visulima/cerebro";

import { buildContext, publishContext } from "../../../release/core/orchestrator";
import { VisReleaseError } from "../../../release/errors";
import type { ReleasePublishOptions } from "./index";

const execute = async ({ logger, options, workspaceRoot }: Toolbox<Console, ReleasePublishOptions>): Promise<void> => {
    const cwd = workspaceRoot ?? process.cwd();
    const dryRun = options.dryRun === true;

    let ctx;

    try {
        ctx = await buildContext({
            channel: options.channel,
            cwd,
            firstRelease: options.firstRelease === true,
            projects: options.filter
                ? options.filter
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean)
                : undefined,
        });
    } catch (error) {
        logger.error(`Failed to load release context: ${error instanceof Error ? error.message : String(error)}`);
        process.exitCode = 1;

        return;
    }

    const { printConfigIfRequested } = await import("../../../release/core/print-config");

    if (printConfigIfRequested(options, ctx, logger)) {
        return;
    }

    if (options.checkOnly === true) {
        logger.info(`Preflight: ${ctx.plan.releases.length} pending publish(es)${ctx.channel ? ` to dist-tag "${ctx.channel.tag}"` : ""}.`);

        if (ctx.plan.warnings.length > 0) {
            for (const w of ctx.plan.warnings) {
                logger.warn(`  - ${w}`);
            }
        }

        process.exitCode = ctx.plan.releases.length === 0 ? 1 : 0;

        return;
    }

    if (ctx.plan.releases.length === 0) {
        logger.info("No pending releases — nothing to publish.");

        return;
    }

    const tag = options.tag ?? ctx.channel?.tag;

    if (!tag) {
        logger.warn(
            "No --tag provided and no channel matched the current branch. Defaulting to dist-tag 'latest'. Set channels in vis.config.ts to control this.",
        );
    }

    logger.info(
        `${dryRun ? "[dry-run] would publish" : "Publishing"} ${ctx.plan.releases.length} package(s) to dist-tag "${tag ?? "latest"}"${dryRun ? "" : "..."}`,
    );

    let result;

    try {
        result = await publishContext(ctx, {
            dryRun,
            noPush: options.noPush === true,
            otp: options.otp,
            resume: options.resume === true,
            tag,
        });
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

        logger.error(`Publish failed: ${error instanceof Error ? error.message : String(error)}`);
        process.exitCode = 1;

        return;
    }

    logger.info("");

    for (const item of result.published) {
        logger.info(`  [published] ${item.name}@${item.version}`);
    }

    for (const item of result.skipped) {
        // stage-rejected / stage-timeout are surfaced as warnings (not info)
        // so reviewers spot them in CI tails. They're still skipped, not
        // failed — the release pipeline exits 0.
        if (item.reason.startsWith("stage-")) {
            logger.warn(`  [stage]     ${item.name} (${item.reason} — re-run \`vis release publish\` once approved)`);
        } else {
            logger.info(`  [skipped]   ${item.name} (${item.reason})`);
        }
    }

    for (const item of result.failed) {
        logger.error(`  [failed]    ${item.name}: ${item.reason}`);
    }

    logger.info("");
    logger.info(`Published: ${result.published.length} | Skipped: ${result.skipped.length} | Failed: ${result.failed.length}`);

    if (result.tags.length > 0) {
        logger.info(`Tags created: ${result.tags.length}${result.tagsPushed ? " (pushed)" : " (NOT pushed — re-run with --resume to retry)"}`);
    }

    // Exit-code semantics per RFC §19.1:
    //   0 — every package published
    //   2 — partial publish (some succeeded, some failed)
    //   3 — all failed
    if (result.failed.length === 0) {
        process.exitCode = 0;
    } else if (result.published.length === 0 && result.skipped.length === 0) {
        process.exitCode = 3;
    } else {
        process.exitCode = 2;
    }

    // EOTP detection: when a publish failed because the registry asked for
    // a 2FA OTP, surface a copy-paste retry command with
    // `--otp=REPLACE_WITH_NEW_OTP` so the user can rerun without
    // re-typing every flag.
    const eotpFailures = result.failed.filter((f) => /\bEOTP\b|one[- ]time password|otp/i.test(f.reason));

    if (eotpFailures.length > 0) {
        logger.info("");
        logger.warn("Publish failed because the registry required a 2FA OTP. Rerun with:");

        const failedNames = eotpFailures.map((f) => f.name).join(",");
        const channelArg = options.channel ? ` --channel=${options.channel}` : "";
        const tagArg = options.tag ? ` --tag=${options.tag}` : "";
        const filterArg = ` --filter='${failedNames}'`;

        logger.info(`  vis release publish --otp=REPLACE_WITH_NEW_OTP --resume${tagArg}${channelArg}${filterArg}`);
    }
};

export default execute as CommandExecute<Toolbox>;
