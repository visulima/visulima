import type { CommandExecute, Toolbox } from "@visulima/cerebro";
import type { TargetConfiguration, Task, TaskTarget } from "@visulima/task-runner";
import { createTaskGraph } from "@visulima/task-runner";

import { buildProjectGraph, discoverWorkspace } from "../../config/workspace";
import { filterProjectsByQuery, resolveSelector } from "../../task/selectors";
import type { ActionGraphOptions } from "./index";

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

const execute = async ({ argument, logger, options, visConfig, workspaceRoot: wsRoot }: Toolbox<Console, ActionGraphOptions>): Promise<void> => {
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
        projectNames = filterProjectsByQuery(projectNames, workspace, options.query);
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
        targetDefaults: config.tasks as unknown as Record<string, Partial<TargetConfiguration>>,
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
};

export default execute as CommandExecute<Toolbox>;
