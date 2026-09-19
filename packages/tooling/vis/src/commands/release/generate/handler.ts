/**
 * `vis release generate` — auto-derive a change file from branch commits.
 *
 * Thin cerebro wrapper around {@link runGenerate}; the derivation itself
 * lives in `release/core/generate/run.ts` so `vis release ci release
 * --generate` can reuse it in-process (issue #864).
 *
 * Range resolution, in precedence order:
 *   1. `--from &lt;ref>`
 *   2. `--since-last-release` — the most recent `releaseTagPattern` tag
 *      reachable from HEAD (workspace-wide). No matching tag is an
 *      error unless `--allow-full-history` says the whole history is
 *      really what you want.
 *   3. the merge-base with `baseBranch`.
 */

import { relative } from "node:path";

import type { CommandExecute, Toolbox } from "@visulima/cerebro";

import { runGenerate } from "../../../release/core/generate/run";
import { buildContext } from "../../../release/core/orchestrator";
import { createShellRunner } from "../../../release/core/shell-runner";
import type { ReleaseGenerateOptions } from "./index";

const execute = async ({ fs, logger, options, workspaceRoot }: Toolbox<Console, ReleaseGenerateOptions>): Promise<void> => {
    const cwd = workspaceRoot ?? process.cwd();
    const ctx = await buildContext({ cwd, skipRegistryLookup: true });

    const { printConfigIfRequested } = await import("../../../release/core/print-config");

    if (printConfigIfRequested(options, ctx, logger)) {
        return;
    }

    const result = await runGenerate({
        allowFullHistory: options.allowFullHistory === true,
        config: ctx.config,
        cwd,
        dryRun: options.dryRun === true,
        from: options.from,
        fs,
        name: options.name,
        packages: ctx.packages,
        perPackageConfig: ctx.perPackageConfig,
        runner: createShellRunner(),
        sinceLastRelease: options.sinceLastRelease === true,
    });

    // `runGenerate` is pure core — it returns what happened, this layer
    // prints it. Notes/warnings first so they read as context for the
    // outcome that follows.
    for (const note of result.notes) {
        logger.info(note);
    }

    for (const warning of result.warnings) {
        logger.warn(warning);
    }

    if (result.status === "failed") {
        logger.error(result.error);
        process.exitCode = 1;

        return;
    }

    if (result.status === "no-changes") {
        return;
    }

    if (result.status === "dry-run") {
        logger.info("[dry-run] would write:");
        logger.info(result.content);

        return;
    }

    logger.info(`Created ${relative(cwd, result.createdFile)}`);

    for (const [name, level] of result.bumps) {
        logger.info(`  ${name}: ${level}`);
    }
};

// fallow-ignore-next-line unused-export -- lazy-loaded command entry (cerebro loader/lazyNamed dynamic import)
export default execute as CommandExecute<Toolbox>;
