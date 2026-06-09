import type { CommandExecute, Toolbox } from "@visulima/cerebro";

import { buildContext } from "../../../release/core/orchestrator";
import type { BumpLevel } from "../../../release/types";
import type { ReleaseStatusOptions } from "./index";

const isBumpLevel = (value: string): value is BumpLevel =>
    value === "major" || value === "minor" || value === "patch" || value === "none";

const execute = async ({ logger, options, workspaceRoot }: Toolbox<Console, ReleaseStatusOptions>): Promise<void> => {
    const cwd = workspaceRoot ?? process.cwd();

    let ctx;

    try {
        ctx = await buildContext({
            channel: options.channel,
            cwd,
            skipRegistryLookup: true,
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

    let { releases } = ctx.plan;

    // Filter by bump level
    if (options.bump) {
        const wanted = options.bump.split(",").map((s) => s.trim()).filter(isBumpLevel);

        if (wanted.length > 0) {
            releases = releases.filter((r) => wanted.includes(r.type));
        }
    }

    // Filter by name glob
    if (options.filter) {
        const zeptomatch = await import("zeptomatch");
        const z = zeptomatch.default;

        releases = releases.filter((r) => z(options.filter!, r.name));
    }

    if (options.json) {
        const out = {
            branch: ctx.branch,
            channel: ctx.channel,
            consumedChangeFiles: ctx.plan.consumedChangeFiles.map((f) => f.path),
            releases: releases.map((r) => {
                return {
                    isCascadeBump: r.isCascadeBump,
                    isDependencyBump: r.isDependencyBump,
                    isGroupBump: r.isGroupBump,
                    name: r.name,
                    newVersion: r.newVersion,
                    oldVersion: r.oldVersion,
                    reasons: r.reasons,
                    type: r.type,
                };
            }),
            warnings: ctx.plan.warnings,
        };

        process.stdout.write(`${JSON.stringify(out, null, 2)}\n`);

        // status exits non-zero when nothing pending — useful as a CI gate.
        if (releases.length === 0) {
            process.exitCode = 1;
        }

        return;
    }

    // Human format
    if (releases.length === 0) {
        logger.info("No pending releases.");

        if (ctx.plan.warnings.length > 0) {
            logger.warn(`${ctx.plan.warnings.length} warning(s):`);

            for (const w of ctx.plan.warnings) {
                logger.warn(`  - ${w}`);
            }
        }

        process.exitCode = 1;

        return;
    }

    if (ctx.channel) {
        logger.info(`Channel: ${ctx.channel.tag}${ctx.channel.prerelease ? ` (preid: ${ctx.channel.prerelease})` : ""} | mode: ${ctx.channel.mode}`);
    }

    logger.info(`${releases.length} package(s) pending release:`);
    logger.info("");

    // Group by bump type for readability
    const byType: Record<BumpLevel, typeof releases> = {
        major: [],
        minor: [],
        none: [],
        patch: [],
    };

    for (const release of releases) {
        byType[release.type].push(release);
    }

    for (const type of ["major", "minor", "patch"] as const) {
        if (byType[type].length === 0) {
            continue;
        }

        logger.info(`  ${type.toUpperCase()}:`);

        for (const release of byType[type]) {
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

            const flagStr = flags.length > 0 ? ` [${flags.join(", ")}]` : "";

            logger.info(`    ${release.name}: ${release.oldVersion} → ${release.newVersion}${flagStr}`);
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
