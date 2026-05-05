import type { CommandExecute, Toolbox } from "@visulima/cerebro";
import type { AffectedOptions, AffectedScope } from "@visulima/task-runner";
import { getAffectedProjects } from "@visulima/task-runner";

import { buildProjectGraph, discoverWorkspace } from "../../config/workspace";
import { filterProjectsByQuery } from "../../task/selectors";
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

    const validScopes = new Set(["deep", "direct", "none"]);
    const downstreamValue = options.downstream ?? "deep";
    const upstreamValue = options.upstream ?? "none";

    if (!validScopes.has(downstreamValue)) {
        throw new Error(`Invalid --downstream value: "${downstreamValue}". Must be "none", "direct", or "deep".`);
    }

    if (!validScopes.has(upstreamValue)) {
        throw new Error(`Invalid --upstream value: "${upstreamValue}". Must be "none", "direct", or "deep".`);
    }

    const affectedOptions: AffectedOptions = {
        base: options.base,
        downstream: downstreamValue as AffectedScope,
        head: options.head,
        projectGraph,
        projects: workspace.projects,
        upstream: upstreamValue as AffectedScope,
        workspaceRoot,
    };

    const result = await getAffectedProjects(affectedOptions);

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
