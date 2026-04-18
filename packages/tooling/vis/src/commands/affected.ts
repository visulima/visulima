import type { Command } from "@visulima/cerebro";
import type { AffectedOptions, AffectedScope } from "@visulima/task-runner";
import { getAffectedProjects } from "@visulima/task-runner";

import { filterProjectsByQuery } from "../selectors";
import { buildProjectGraph, discoverWorkspace } from "../workspace";

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
    execute: async ({ argument, logger, options, runtime, visConfig, workspaceRoot: wsRoot }) => {
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
        const downstreamValue = (options.downstream as string) ?? "deep";
        const upstreamValue = (options.upstream as string) ?? "none";

        if (!validScopes.has(downstreamValue)) {
            throw new Error(`Invalid --downstream value: "${downstreamValue}". Must be "none", "direct", or "deep".`);
        }

        if (!validScopes.has(upstreamValue)) {
            throw new Error(`Invalid --upstream value: "${upstreamValue}". Must be "none", "direct", or "deep".`);
        }

        const affectedOptions: AffectedOptions = {
            base: options.base as string,
            downstream: downstreamValue as AffectedScope,
            head: options.head as string,
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
            affectedProjects = filterProjectsByQuery(affectedProjects, workspace, options.query as string);

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

        try {
            await runtime.runCommand("run", { argv });
        } finally {
            delete process.env["VIS_AFFECTED_FILES"];
        }
    },
    group: "Run & Execute",
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
            defaultValue: "deep",
            description: 'Downstream scope: "none", "direct", or "deep" — controls how far to include dependents of changed projects',
            name: "downstream",
            type: String,
        },
        {
            defaultValue: "none",
            description: 'Upstream scope: "none", "direct", or "deep" — controls how far to include dependencies of changed projects',
            name: "upstream",
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
        {
            description: 'Partition tasks for distributed CI (e.g., "1/4" for first of four runners). Falls back to VIS_PARTITION env var.',
            name: "partition",
            type: String,
        },
        {
            description: "Filter affected projects by a query (e.g. 'language=typescript && tag=lib')",
            name: "query",
            type: String,
        },
    ],
};

export default affected;
