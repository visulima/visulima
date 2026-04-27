import { readdirSync } from "node:fs";

import type { CommandExecute, Toolbox } from "@visulima/cerebro";
import colorize from "@visulima/colorize";
import { isAccessibleSync, readJsonSync } from "@visulima/fs";
import { join } from "@visulima/path";
import { enforceProjectConstraints } from "@visulima/task-runner";

import { analyzeFlakiness } from "../../flakiness";
import { checkRuntimeVersions } from "../../runtime-check";
import { buildProjectGraph, discoverWorkspace } from "../../workspace";
import type { StatusOptions } from "./index";

const { dim, green, red, yellow } = colorize;

const icon = (ok: boolean): string => (ok ? green("✓") : red("✗"));

const execute = async ({ logger, options, visConfig, workspaceRoot: wsRoot }: Toolbox<Console, StatusOptions>): Promise<void> => {
    if (!wsRoot) {
        throw new Error("Could not determine workspace root.");
    }

    const { config, packageJsons, workspace } = discoverWorkspace(wsRoot, visConfig);
    const projectGraph = buildProjectGraph(wsRoot, workspace, packageJsons);
    const projectCount = Object.keys(workspace.projects).length;
    const targetCount = new Set(Object.values(workspace.projects).flatMap((p) => Object.keys(p.targets ?? {}))).size;

    const runtimeFindings = checkRuntimeVersions(wsRoot);

    let constraintViolations = 0;

    if (config.constraints) {
        constraintViolations = enforceProjectConstraints(projectGraph, config.constraints).length;
    }

    const flakyStats = analyzeFlakiness(wsRoot, { minRuns: 2 });

    let cacheHitRate: string | undefined;
    const runsDir = join(wsRoot, ".task-runner", "runs");

    if (isAccessibleSync(runsDir)) {
        const files = readdirSync(runsDir)
            .filter((f) => f.endsWith(".json"))
            .sort();
        let totalTasks = 0;
        let cachedTasks = 0;

        for (const file of files.slice(-20)) {
            try {
                const data = readJsonSync(join(runsDir, file)) as {
                    stats?: { cached?: number; total?: number };
                };

                if (data.stats) {
                    totalTasks += data.stats.total ?? 0;
                    cachedTasks += data.stats.cached ?? 0;
                }
            } catch {
                continue;
            }
        }

        if (totalTasks > 0) {
            cacheHitRate = `${((cachedTasks / totalTasks) * 100).toFixed(0)}%`;
        }
    }

    if (options.json) {
        logger.info(
            JSON.stringify(
                {
                    cacheHitRate: cacheHitRate ?? null,
                    constraintViolations,
                    flakyTasks: flakyStats.length,
                    projects: projectCount,
                    runtimeIssues: runtimeFindings.length,
                    targets: targetCount,
                },
                null,
                2,
            ),
        );

        return;
    }

    logger.info("");
    logger.info(`  ${dim("VIS STATUS")}`);
    logger.info("");
    logger.info(`  ${icon(true)} ${String(projectCount)} projects · ${String(targetCount)} unique targets`);
    logger.info(
        `  ${icon(runtimeFindings.length === 0)} Runtime: ${runtimeFindings.length === 0 ? green("OK") : yellow(`${String(runtimeFindings.length)} issue(s)`)}`,
    );
    logger.info(
        `  ${icon(constraintViolations === 0)} Constraints: ${constraintViolations === 0 ? green("OK") : red(`${String(constraintViolations)} violation(s)`)}`,
    );
    logger.info(`  ${icon(flakyStats.length === 0)} Flaky tasks: ${flakyStats.length === 0 ? green("none") : yellow(String(flakyStats.length))}`);

    if (cacheHitRate) {
        logger.info(`  ${icon(true)} Cache hit rate: ${cacheHitRate} (last 20 runs)`);
    }

    logger.info("");
};

export default execute as CommandExecute<Toolbox>;
