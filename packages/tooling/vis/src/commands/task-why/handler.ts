import type { Toolbox } from "@visulima/cerebro";
import type { TaskGraph } from "@visulima/task-runner";
import { createTaskGraph } from "@visulima/task-runner";

import { buildProjectGraph, discoverWorkspace } from "../../config/workspace";

/**
 * Walks a task graph from `target` upward (following reverse edges) and
 * returns the shortest explanation path to a root task — i.e. the chain
 * of tasks that caused `target` to be included in the run.
 *
 * Uses BFS so the first path found is the shortest; a task may be
 * reachable from several roots but we only print one chain per `vis
 * task-why` to keep the output scannable at 40+ packages.
 */
const findShortestPathToRoot = (graph: TaskGraph, target: string): string[] | undefined => {
    // Reverse adjacency: parent -> children means we walk parent→...→root.
    const reverse = new Map<string, string[]>();

    for (const [parent, deps] of Object.entries(graph.dependencies)) {
        for (const dep of deps) {
            const list = reverse.get(dep) ?? [];

            list.push(parent);
            reverse.set(dep, list);
        }
    }

    if (!graph.tasks[target]) {
        return undefined;
    }

    const visited = new Set<string>([target]);
    const queue: { node: string; path: string[] }[] = [{ node: target, path: [target] }];

    while (queue.length > 0) {
        const current = queue.shift()!;

        // Root = no one depends on it.
        if (graph.roots.includes(current.node)) {
            return current.path;
        }

        for (const parent of reverse.get(current.node) ?? []) {
            if (visited.has(parent)) {
                continue;
            }

            visited.add(parent);
            queue.push({ node: parent, path: [parent, ...current.path] });
        }
    }

    // Task exists but isn't connected to any root (self-contained / orphan).
    return [target];
};

/**
 * Builds the reverse dependency list: tasks that directly depend on
 * `target`. Shown after the root chain so the user can see upstream
 * triggers at a glance, not just one example path.
 */
const collectParents = (graph: TaskGraph, target: string): string[] => {
    const parents: string[] = [];

    for (const [parent, deps] of Object.entries(graph.dependencies)) {
        if (deps.includes(target)) {
            parents.push(parent);
        }
    }

    return parents.sort();
};

const execute = async ({ argument, logger, visConfig, workspaceRoot: wsRoot }: Toolbox): Promise<void> => {
    if (!wsRoot) {
        throw new Error("Could not determine workspace root.");
    }

    const taskId = argument[0];

    if (!taskId) {
        throw new Error("No task ID specified. Usage: vis task-why <project>:<target>");
    }

    if (!taskId.includes(":")) {
        throw new Error(`Invalid task ID "${taskId}" — expected format "project:target".`);
    }

    const { packageJsons, workspace } = discoverWorkspace(wsRoot, visConfig);
    const projectGraph = buildProjectGraph(wsRoot, workspace, packageJsons);

    const [projectName, targetName] = taskId.split(":", 2) as [string, string];
    const project = workspace.projects[projectName];

    if (!project) {
        throw new Error(`Unknown project "${projectName}".`);
    }

    if (!project.targets?.[targetName]) {
        throw new Error(`Project "${projectName}" has no target "${targetName}".`);
    }

    // Seed the graph with the queried task as the root so we can
    // enumerate its downstream dependencies AND walk upward from
    // every other project that depends on it.
    const allInitialTasks = Object.entries(workspace.projects).flatMap(([name, proj]) =>
        Object.keys(proj.targets ?? {}).map((t) => {
            return {
                id: `${name}:${t}`,
                outputs: [],
                overrides: {},
                target: { project: name, target: t },
            };
        }),
    );

    const graph = createTaskGraph(allInitialTasks, { projectGraph, workspace });

    if (!graph.tasks[taskId]) {
        throw new Error(`Task "${taskId}" is not reachable in the graph.`);
    }

    const path = findShortestPathToRoot(graph, taskId);
    const parents = collectParents(graph, taskId);

    logger.info("");
    logger.info(`Why ${taskId}?`);
    logger.info("");

    if (path && path.length > 1) {
        logger.info("Shortest path from a root to this task:");

        for (const [index, node] of path.entries()) {
            const prefix = index === 0 ? "  " : `${"  ".repeat(index + 1)}└─ `;

            logger.info(`${prefix}${node}`);
        }

        logger.info("");
    } else {
        logger.info("  This task is itself a root — nothing upstream depends on it.");
        logger.info("");
    }

    if (parents.length > 0) {
        logger.info(`Directly depended on by ${parents.length} task(s):`);

        for (const parent of parents) {
            logger.info(`  - ${parent}`);
        }

        logger.info("");
    }

    const directDeps = graph.dependencies[taskId] ?? [];

    if (directDeps.length > 0) {
        logger.info(`This task depends on ${directDeps.length} task(s):`);

        for (const dep of [...directDeps].sort()) {
            logger.info(`  - ${dep}`);
        }

        logger.info("");
    }
};

export default execute;
