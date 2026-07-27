import type { CommandExecute, Toolbox } from "@visulima/cerebro";

import { buildProjectGraph, discoverWorkspace } from "../../config/workspace";
import { selectAffectedProjects } from "../../task/affected-selection";
import { filterProjectsByQuery, filterProjectsByTags } from "../../task/selectors";
import type { AffectedCommandOptions } from "./index";

const execute = async ({ argument, logger, options, runtime, visConfig, workspaceRoot: wsRoot }: Toolbox<Console, AffectedCommandOptions>): Promise<void> => {
    const target = argument[0];

    if (!target) {
        throw new Error("Missing target. Usage: vis affected <target>");
    }

    if (!wsRoot) {
        throw new Error("Could not determine workspace root. Run this command inside a monorepo.");
    }

    const workspaceRoot = wsRoot;
    const { packageJsons, workspace } = discoverWorkspace(workspaceRoot, visConfig);
    const projectGraph = buildProjectGraph(workspaceRoot, workspace, packageJsons);

    const result = await selectAffectedProjects(
        {
            base: options.base,
            downstream: options.downstream,
            head: options.head,
            uncommitted: options.uncommitted,
            upstream: options.upstream,
        },
        { projectGraph, projects: workspace.projects, workspaceRoot },
        { defaultBase: visConfig?.defaultBase },
    );

    for (const note of result.notes) {
        logger.info(`▸ ${note}`);
    }

    if (result.changedFiles.length === 0) {
        logger.info("No files changed. Nothing to run.");

        return;
    }

    if (result.affectedProjects.length === 0) {
        logger.info("No projects affected by the changes.");

        return;
    }

    let { affectedProjects } = result;

    if (options.query) {
        affectedProjects = filterProjectsByQuery(affectedProjects, workspace, options.query);

        if (affectedProjects.length === 0) {
            logger.info(`Query "${String(options.query)}" matched no affected projects.`);

            return;
        }
    }

    if (options.tag && options.tag.length > 0) {
        affectedProjects = filterProjectsByTags(affectedProjects, workspace, options.tag);

        if (affectedProjects.length === 0) {
            logger.info(`Tag filter ${options.tag.map((t: string) => `"${t}"`).join(", ")} matched no affected projects.`);

            return;
        }
    }

    if (options.sparseCheckout) {
        // Emit one project root per line, deduped and sorted, so the
        // output pipes straight into `git sparse-checkout set --stdin`.
        // Only paths go to stdout; nothing else is logged so the pipe
        // stays clean. Falls back to the project name when a project
        // declares no root (it doubles as the directory by convention).
        const roots = [...new Set(affectedProjects.map((name) => workspace.projects[name]?.root ?? name))].sort();

        process.stdout.write(`${roots.join("\n")}\n`);

        return;
    }

    logger.info(`Affected projects: ${affectedProjects.join(", ")}`);

    if (result.changedFiles.length > 0) {
        process.env["VIS_AFFECTED_FILES"] = result.changedFiles.join("\n");
    }

    const argv: string[] = [target, `--projects=${affectedProjects.join(",")}`];

    if (options.parallel !== undefined) {
        argv.push(`--parallel=${String(options.parallel)}`);
    }

    if (!options.cache) {
        argv.push("--no-cache");
    }

    if (options.dryRun) {
        argv.push("--dry-run");
    }

    if (options.partition) {
        argv.push(`--partition=${String(options.partition)}`);
    }

    if (options.reverse) {
        argv.push("--reverse");
    }

    if (typeof options.runnerTags === "string" && options.runnerTags !== "") {
        argv.push(`--runner-tags=${options.runnerTags}`);
    }

    try {
        await runtime.runCommand("run", { argv });
    } finally {
        delete process.env["VIS_AFFECTED_FILES"];
    }
};

export default execute as CommandExecute<Toolbox>;
