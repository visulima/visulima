import { cwd } from "node:process";

import type { Command } from "@visulima/cerebro";
import type { AffectedOptions } from "@visulima/task-runner";
import { getAffectedProjects } from "@visulima/task-runner";

import { buildProjectGraph, discoverWorkspace, findWorkspaceRoot } from "../workspace";

const affected: Command = {
    argument: {
        description: "The target to run (e.g., build, test, lint)",
        name: "target",
        type: String,
    },
    description: "Run a target only on projects affected by recent changes",
    examples: [
        ["vis affected build", "Run build on affected projects"],
        ["vis affected test --base=main", "Run tests on projects changed since main"],
    ],
    execute: async ({ argument, logger, options, runtime }) => {
        const target = argument[0];

        if (!target) {
            throw new Error("Missing target. Usage: vis affected <target>");
        }

        const workspaceRoot = findWorkspaceRoot(cwd());
        const { workspace } = discoverWorkspace(workspaceRoot);
        const projectGraph = buildProjectGraph(workspaceRoot, workspace);

        const affectedOptions: AffectedOptions = {
            base: options.base as string,
            head: options.head as string,
            projectGraph,
            projects: workspace.projects,
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

        logger.info(`Affected projects: ${result.affectedProjects.join(", ")}`);

        // Forward relevant options to the run command
        const argv: string[] = [target, `--projects=${result.affectedProjects.join(",")}`];

        if (options.parallel !== undefined) {
            argv.push(`--parallel=${String(options.parallel)}`);
        }

        if (!options.cache) {
            argv.push("--no-cache");
        }

        if (options.dryRun) {
            argv.push("--dry-run");
        }

        await runtime.runCommand("run", { argv });
    },
    name: "affected",
    options: [
        {
            defaultValue: "HEAD~1",
            description: "Git base ref for comparison",
            name: "base",
            type: String,
        },
        {
            defaultValue: "HEAD",
            description: "Git head ref for comparison",
            name: "head",
            type: String,
        },
        {
            defaultValue: 3,
            description: "Maximum number of parallel tasks",
            name: "parallel",
            type: Number,
        },
        {
            defaultValue: true,
            description: "Enable caching (use --no-cache to disable)",
            name: "cache",
            type: Boolean,
        },
        {
            defaultValue: false,
            description: "Show what would run without executing",
            name: "dry-run",
            type: Boolean,
        },
    ],
};

export default affected;
