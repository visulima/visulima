import { cwd } from "node:process";

import type { Command } from "@visulima/cerebro";
import { getAffectedProjects, type AffectedOptions } from "@visulima/task-runner";

import { buildProjectGraph, discoverWorkspace, findWorkspaceRoot } from "../workspace";

const affectedCommand: Command = {
    name: "affected",
    description: "Run a target only on projects affected by recent changes",
    argument: {
        name: "target",
        type: String,
        description: "The target to run (e.g., build, test, lint)",
    },
    options: [
        {
            name: "base",
            type: String,
            defaultValue: "HEAD~1",
            description: "Git base ref for comparison",
        },
        {
            name: "head",
            type: String,
            defaultValue: "HEAD",
            description: "Git head ref for comparison",
        },
        {
            name: "projects",
            alias: "p",
            type: String,
            description: "Comma-separated list of projects to filter",
        },
        {
            name: "parallel",
            type: Number,
            defaultValue: 3,
            description: "Maximum number of parallel tasks",
        },
        {
            name: "cache",
            type: Boolean,
            defaultValue: true,
            description: "Enable caching (use --no-cache to disable)",
        },
        {
            name: "dry-run",
            type: Boolean,
            defaultValue: false,
            description: "Show what would run without executing",
        },
    ],
    examples: [
        ["vis affected build", "Run build on affected projects"],
        ["vis affected test --base=main", "Run tests on projects changed since main"],
    ],
    execute: async ({ argument, logger, runtime }) => {
        const target = argument[0];

        if (!target) {
            logger.error("Missing target. Usage: vis affected <target>");
            process.exit(1);
        }

        const workspaceRoot = findWorkspaceRoot(cwd());
        const { workspace } = discoverWorkspace(workspaceRoot);
        const projectGraph = buildProjectGraph(workspaceRoot, workspace);

        const affectedOptions: AffectedOptions = {
            base: "HEAD~1",
            head: "HEAD",
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

        // Delegate to run command with affected projects as filter
        await runtime.runCommand("run", {
            argv: [target, `--projects=${result.affectedProjects.join(",")}`],
        });
    },
};

export { affectedCommand };
