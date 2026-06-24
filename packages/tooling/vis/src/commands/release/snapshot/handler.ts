/**
 * `vis release snapshot` — preview release publishing (RFC §13).
 *
 * Thin CLI wrapper around `core/snapshot.ts:runSnapshot`. The same logic
 * is invoked by `vis release ci snapshot` so PR-comment tooling and
 * direct-invocation produce identical output.
 */

import type { CommandExecute, Toolbox } from "@visulima/cerebro";

import { buildContext } from "../../../release/core/orchestrator";
import { runSnapshot } from "../../../release/core/snapshot";
import type { ReleaseSnapshotOptions } from "./index";

const execute = async ({ logger, options, workspaceRoot }: Toolbox<Console, ReleaseSnapshotOptions>): Promise<void> => {
    const cwd = workspaceRoot ?? process.cwd();

    if (!options.tag) {
        logger.error("--tag is required.");
        process.exitCode = 1;

        return;
    }

    const dryRun = options.dryRun === true;
    const ctx = await buildContext({ cwd });

    const { printConfigIfRequested } = await import("../../../release/core/print-config");

    if (printConfigIfRequested(options, ctx, logger)) {
        return;
    }

    let result;

    try {
        result = await runSnapshot({
            context: ctx,
            dryRun,
            filter: options.filter,
            registry: options.registry,
            tag: options.tag,
        });
    } catch (error) {
        logger.error(`Snapshot failed: ${(error as Error).message}`);
        process.exitCode = 1;

        return;
    }

    logger.info(`${dryRun ? "[dry-run] would snapshot" : "Snapshotting"} at version ${result.snapshotVersion} → tag "${result.tag}"`);

    for (const item of result.published) {
        logger.info(`  ${dryRun ? "[dry-run]  " : "[published]"} ${item.name}@${item.version}`);
    }

    for (const item of result.skipped) {
        logger.info(`  [skipped]   ${item.name} (${item.reason})`);
    }

    for (const item of result.failed) {
        logger.error(`  [failed]    ${item.name}: ${item.reason}`);
    }

    logger.info("");
    logger.info(`Published: ${result.published.length} | Skipped: ${result.skipped.length} | Failed: ${result.failed.length}`);

    process.exitCode = result.failed.length > 0 ? 2 : 0;
};

// fallow-ignore-next-line unused-export -- lazy-loaded command entry (cerebro loader/lazyNamed dynamic import)
export default execute as CommandExecute<Toolbox>;
