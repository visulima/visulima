import { cwd, stderr, stdout } from "node:process";

import { getAffectedProjects, type AffectedOptions } from "@visulima/task-runner";

import { buildProjectGraph, discoverWorkspace, findWorkspaceRoot } from "../workspace";
import { runCommand } from "./run";

/**
 * Implements the `vis affected <target>` command.
 *
 * Detects which projects are affected by recent changes and runs
 * the specified target only on those projects.
 */
const affectedCommand = async (positionals: string[], flags: Record<string, string | boolean>): Promise<void> => {
    const target = positionals[0];

    if (!target) {
        stderr.write("Error: Missing target. Usage: vis affected <target>\n");
        process.exit(1);
    }

    const workspaceRoot = findWorkspaceRoot(cwd());
    const { workspace } = discoverWorkspace(workspaceRoot);
    const projectGraph = buildProjectGraph(workspaceRoot, workspace);

    const affectedOptions: AffectedOptions = {
        base: typeof flags["base"] === "string" ? flags["base"] : "HEAD~1",
        head: typeof flags["head"] === "string" ? flags["head"] : "HEAD",
        projectGraph,
        projects: workspace.projects,
        workspaceRoot,
    };

    // Get affected projects
    const result = await getAffectedProjects(affectedOptions);

    if (result.changedFiles.length === 0) {
        stdout.write("No files changed. Nothing to run.\n");

        return;
    }

    if (result.affectedProjects.length === 0) {
        stdout.write("No projects affected by the changes.\n");

        return;
    }

    stdout.write(`Affected projects: ${result.affectedProjects.join(", ")}\n\n`);

    // Run with --projects filter set to affected projects
    const newFlags = {
        ...flags,
        projects: result.affectedProjects.join(","),
    };

    await runCommand([target], newFlags);
};

export { affectedCommand };
