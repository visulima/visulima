/**
 * `vis release pretrust` — bootstrap npm Trusted Publishing (OIDC).
 *
 * Thin CLI wrapper around `core/pretrust.ts:runPretrust`. Publishes a
 * non-functional placeholder for every managed package missing from the
 * registry so a Trusted Publisher can be configured before the first release.
 */

import type { CommandExecute, Toolbox } from "@visulima/cerebro";

import { buildContext } from "../../../release/core/orchestrator";
import type { TrustProvider } from "../../../release/core/pretrust";
import { runPretrust } from "../../../release/core/pretrust";
import type { ReleasePretrustOptions } from "./index";

const execute = async ({ logger, options, workspaceRoot }: Toolbox<Console, ReleasePretrustOptions>): Promise<void> => {
    const cwd = workspaceRoot ?? process.cwd();
    const dryRun = options.dryRun === true;
    const access = options.access === "restricted" ? "restricted" : "public";
    const provider: TrustProvider | undefined = options.provider === "github" || options.provider === "gitlab" ? options.provider : undefined;

    const ctx = await buildContext({ cwd });

    const { printConfigIfRequested } = await import("../../../release/core/print-config");

    if (printConfigIfRequested(options, ctx, logger)) {
        return;
    }

    let result;

    try {
        result = await runPretrust({
            access,
            allowStagePublish: options.allowStagePublish === true,
            context: ctx,
            dryRun,
            env: options.env,
            filter: options.filter,
            force: options.force === true,
            provider,
            registry: options.registry,
            repo: options.repo,
            tag: options.tag,
            trust: options.noTrust !== true,
            version: options.version,
            workflow: options.workflow,
        });
    } catch (error) {
        logger.error(`Pretrust failed: ${(error as Error).message}`);
        process.exitCode = 1;

        return;
    }

    for (const item of result.published) {
        logger.info(`  ${dryRun ? "[dry-run]   " : "[published]"} ${item.name}@${item.version}`);

        if (dryRun) {
            continue;
        }

        if (item.trusted === true) {
            logger.info("              ✓ trusted publisher configured (npm trust)");
        } else if (item.trustReason) {
            logger.warn(`              ⚠ trust not configured: ${item.trustReason}`);

            if (item.accessUrl) {
                logger.info(`                finish manually → ${item.accessUrl}`);
            }
        } else if (item.accessUrl) {
            logger.info(`              configure trusted publishing → ${item.accessUrl}`);
        }
    }

    for (const item of result.skipped) {
        logger.info(`  [skipped]   ${item.name} (${item.reason})`);
    }

    for (const item of result.failed) {
        logger.error(`  [failed]    ${item.name}: ${item.reason}`);
    }

    const trustedCount = result.published.filter((p) => p.trusted === true).length;
    const trustPending = result.published.filter((p) => p.trusted === false).length;

    logger.info("");
    logger.info(`Placeholders: ${result.published.length} | Trusted: ${trustedCount} | Skipped: ${result.skipped.length} | Failed: ${result.failed.length}`);

    if (result.published.length > 0 && !dryRun) {
        logger.info("");

        if (trustPending > 0) {
            logger.info(
                "Next: finish trusted-publisher setup for the packages above (the first `npm trust` call may need a 2FA OTP), then run `vis release publish`.",
            );
        } else {
            logger.info("Next: run `vis release publish` — trusted publishing is configured.");
        }
    }

    process.exitCode = result.failed.length > 0 ? 2 : 0;
};

// fallow-ignore-next-line unused-export -- lazy-loaded command entry (cerebro loader/lazyNamed dynamic import)
export default execute as CommandExecute<Toolbox>;
