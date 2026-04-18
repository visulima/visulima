import type { Command } from "@visulima/cerebro";
import type { TargetConfiguration, Task, TaskTarget } from "@visulima/task-runner";
import { createTaskGraph } from "@visulima/task-runner";

import { filterProjectsByQuery, resolveSelector } from "../selectors";
import { buildProjectGraph, discoverWorkspace } from "../workspace";

/**
 * Renders a task graph as an ASCII execution plan. Each task is
 * printed on its own line, indented by its depth in the graph so
 * dependencies are visually ordered above their dependents.
 *
 * Topological order is computed from the roots.
 */
const renderPlan = (roots: string[], dependencies: Record<string, string[]>, tasks: Record<string, Task>): string[] => {
    const lines: string[] = [];
    const visited = new Set<string>();

    const walk = (id: string, depth: number): void => {
        if (visited.has(id)) {
            return;
        }

        visited.add(id);

        const deps = dependencies[id] ?? [];

        for (const dep of deps) {
            walk(dep, depth + 1);
        }

        const task = tasks[id];
        const indent = "  ".repeat(depth);

        lines.push(`${indent}${id}${task?.cache === false ? " (no-cache)" : ""}`);
    };

    for (const root of roots) {
        walk(root, 0);
    }

    return lines;
};

/**
 * Serialises a task graph to a JSON-compatible structure suitable
 * for machine consumption (e.g., CI dashboards).
 */
const toJson = (roots: string[], dependencies: Record<string, string[]>, tasks: Record<string, Task>) => {
    return {
        roots,
        tasks: Object.fromEntries(
            Object.entries(tasks).map(([id, task]) => [
                id,
                {
                    cache: task.cache,
                    dependsOn: dependencies[id] ?? [],
                    outputs: task.outputs,
                    parallelism: task.parallelism,
                    projectRoot: task.projectRoot,
                    target: task.target,
                },
            ]),
        ),
    };
};

/**
 * `vis action-graph &lt;selector>` — shows the execution plan that would
 * be produced by `vis run &lt;selector>` without running anything. Matches
 * moon's `moon action-graph`.
 */
const actionGraph: Command = {
    argument: {
        description: "Target selector (same syntax as `vis run`): `build`, `:build`, `~:test`, `#tag:lint`, …",
        name: "selector",
        type: String,
    },
    description: "Show the execution plan for a target without running it",
    examples: [
        ["vis action-graph build", "Print the task plan for `build` on every project"],
        ["vis action-graph :test", "Moon-style selector"],
        ["vis action-graph build --json", "Emit a JSON description of the plan"],
        ['vis action-graph lint --query "tag=frontend"', "Filter projects by query"],
    ],
    execute: async ({ argument, logger, options, visConfig, workspaceRoot: wsRoot }) => {
        const rawSelector = argument[0];

        if (!rawSelector) {
            throw new Error("Missing selector. Usage: vis action-graph <selector>");
        }

        if (!wsRoot) {
            throw new Error("Could not determine workspace root. Run inside a monorepo.");
        }

        const { config, packageJsons, workspace } = discoverWorkspace(wsRoot, visConfig);
        const projectGraph = buildProjectGraph(wsRoot, workspace, packageJsons);

        const selectorResult = await resolveSelector(rawSelector, workspace, process.cwd(), wsRoot);
        const { target } = selectorResult;
        let projectNames = selectorResult.projects;

        if (options.query) {
            projectNames = filterProjectsByQuery(projectNames, workspace, options.query as string);
        }

        const candidates = projectNames.filter((name) => {
            const project = workspace.projects[name];

            return project?.targets?.[target] !== undefined;
        });

        if (candidates.length === 0) {
            logger.info(`No projects have a "${target}" target.`);

            return;
        }

        const initialTasks: Task[] = candidates.map((projectName) => {
            const project = workspace.projects[projectName]!;
            const targetConfig = project.targets?.[target];
            const taskTarget: TaskTarget = { project: projectName, target };

            return {
                cache: targetConfig?.cache,
                id: `${projectName}:${target}`,
                outputs: targetConfig?.outputs ?? [],
                overrides: { command: targetConfig?.command },
                parallelism: targetConfig?.parallelism,
                projectRoot: project.root,
                target: taskTarget,
            };
        });

        const taskGraph = createTaskGraph(initialTasks, {
            projectGraph,
            targetDefaults: config.targetDefaults as unknown as Record<string, Partial<TargetConfiguration>>,
            workspace,
        });

        if (options.json) {
            logger.info(JSON.stringify(toJson(taskGraph.roots, taskGraph.dependencies, taskGraph.tasks), null, 2));

            return;
        }

        const lines = renderPlan(taskGraph.roots, taskGraph.dependencies, taskGraph.tasks);

        logger.info(`Execution plan (${Object.keys(taskGraph.tasks).length} task(s), ${taskGraph.roots.length} root(s)):`);
        logger.info("");

        for (const line of lines) {
            logger.info(line);
        }
    },
    group: "Workspace",
    name: "action-graph",
    options: [
        {
            defaultValue: false,
            description: "Emit JSON instead of ASCII",
            name: "json",
            type: Boolean,
        },
        {
            description: "Filter matched projects by a query",
            name: "query",
            type: String,
        },
    ],
};

export default actionGraph;
