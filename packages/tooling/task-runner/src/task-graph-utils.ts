import type { TaskGraph } from "./types";

/**
 * Finds a single cycle in the task graph, if one exists.
 * Returns the cycle as an array of task IDs, or null if no cycle exists.
 */

export const findCycle = (taskGraph: TaskGraph): string[] | undefined => {
    const visited = new Set<string>();
    const inStack = new Set<string>();
    const parent = new Map<string, string>();

    for (const taskId of Object.keys(taskGraph.tasks)) {
        if (visited.has(taskId)) {
            continue;
        }

        const stack = [taskId];

        while (stack.length > 0) {
            const current = stack.at(-1) as string;

            if (!visited.has(current)) {
                visited.add(current);
                inStack.add(current);
            }

            const deps = taskGraph.dependencies[current] ?? [];
            let foundUnvisited = false;

            for (const dep of deps) {
                if (inStack.has(dep)) {
                    // Found a cycle - reconstruct it
                    const cycle: string[] = [dep];
                    let node = current;

                    while (node !== dep) {
                        cycle.push(node);
                        node = parent.get(node) ?? dep;
                    }

                    cycle.push(dep);
                    cycle.reverse();

                    return cycle;
                }

                if (!visited.has(dep)) {
                    parent.set(dep, current);
                    stack.push(dep);
                    foundUnvisited = true;
                    break;
                }
            }

            if (!foundUnvisited) {
                stack.pop();
                inStack.delete(current);
            }
        }
    }

    return undefined;
};

/**
 * Finds all cycles in the task graph.
 */
export const findCycles = (taskGraph: TaskGraph): string[][] => {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const inStack = new Set<string>();
    const stack: string[] = [];

    const dfs = (taskId: string): void => {
        visited.add(taskId);
        inStack.add(taskId);
        stack.push(taskId);

        const deps = taskGraph.dependencies[taskId] ?? [];

        for (const dep of deps) {
            if (inStack.has(dep)) {
                const cycleStart = stack.indexOf(dep);
                const cycle = [...stack.slice(cycleStart), dep];

                cycles.push(cycle);
            } else if (!visited.has(dep)) {
                dfs(dep);
            }
        }

        stack.pop();
        inStack.delete(taskId);
    };

    for (const taskId of Object.keys(taskGraph.tasks)) {
        if (!visited.has(taskId)) {
            dfs(taskId);
        }
    }

    return cycles;
};

/**
 * Walks the task graph in topological order (dependencies before dependents),
 * calling the callback for each task.
 *
 * Note: If the graph contains cycles, tasks involved in cycles will not be visited.
 * Use `findCycle` to detect cycles before walking if complete traversal is required.
 */

export const walkTaskGraph = (taskGraph: TaskGraph, callback: (taskId: string) => void): void => {
    // Build a reverse map: for each task, count how many dependencies it has
    const dependencyCount = new Map<string, number>();

    for (const taskId of Object.keys(taskGraph.tasks)) {
        dependencyCount.set(taskId, (taskGraph.dependencies[taskId] ?? []).length);
    }

    // Build reverse dependency map: dep → tasks that depend on dep
    const dependents = new Map<string, string[]>();

    for (const [taskId, deps] of Object.entries(taskGraph.dependencies)) {
        for (const dep of deps) {
            let list = dependents.get(dep);

            if (!list) {
                list = [];
                dependents.set(dep, list);
            }

            list.push(taskId);
        }
    }

    // Start with tasks that have no dependencies (leaf tasks)
    const queue: string[] = [];

    for (const [taskId, count] of dependencyCount) {
        if (count === 0) {
            queue.push(taskId);
        }
    }

    while (queue.length > 0) {
        const taskId = queue.shift() as string;

        callback(taskId);

        // Decrement dependency count for tasks that depend on this one
        const taskDependents = dependents.get(taskId) ?? [];

        for (const dependent of taskDependents) {
            const newCount = (dependencyCount.get(dependent) ?? 1) - 1;

            dependencyCount.set(dependent, newCount);

            if (newCount === 0) {
                queue.push(dependent);
            }
        }
    }
};

/**
 * Returns a reversed copy of the task graph (edges point in the opposite direction).
 */
export const reverseTaskGraph = (taskGraph: TaskGraph): TaskGraph => {
    const reversedDependencies: Record<string, string[]> = {};

    for (const taskId of Object.keys(taskGraph.tasks)) {
        reversedDependencies[taskId] = [];
    }

    for (const [taskId, deps] of Object.entries(taskGraph.dependencies)) {
        for (const dep of deps) {
            reversedDependencies[dep]?.push(taskId);
        }
    }

    const roots = Object.keys(taskGraph.tasks).filter((taskId) => (reversedDependencies[taskId]?.length ?? 0) === 0);

    return {
        dependencies: reversedDependencies,
        roots,
        tasks: { ...taskGraph.tasks },
    };
};

/**
 * Returns the leaf tasks (tasks with no dependencies of their own).
 */
export const getLeafTasks = (taskGraph: TaskGraph): string[] =>
    Object.keys(taskGraph.tasks).filter((taskId) => (taskGraph.dependencies[taskId]?.length ?? 0) === 0);

/**
 * Removes edges that form cycles, making the graph acyclic.
 * Returns a new task graph without the cycle-forming edges.
 */
export const makeAcyclic = (taskGraph: TaskGraph): TaskGraph => {
    const visited = new Set<string>();
    const inStack = new Set<string>();
    const edgesToRemove: { from: string; to: string }[] = [];

    const dfs = (taskId: string): void => {
        visited.add(taskId);
        inStack.add(taskId);

        const deps = taskGraph.dependencies[taskId] ?? [];

        for (const dep of deps) {
            if (inStack.has(dep)) {
                edgesToRemove.push({ from: taskId, to: dep });
            } else if (!visited.has(dep)) {
                dfs(dep);
            }
        }

        inStack.delete(taskId);
    };

    for (const taskId of Object.keys(taskGraph.tasks)) {
        if (!visited.has(taskId)) {
            dfs(taskId);
        }
    }

    const newDependencies: Record<string, string[]> = {};

    for (const [taskId, deps] of Object.entries(taskGraph.dependencies)) {
        newDependencies[taskId] = deps.filter((dep) => !edgesToRemove.some((edge) => edge.from === taskId && edge.to === dep));
    }

    const allDeps = new Set<string>();

    for (const deps of Object.values(newDependencies)) {
        for (const dep of deps) {
            allDeps.add(dep);
        }
    }

    const roots = Object.keys(taskGraph.tasks).filter((taskId) => !allDeps.has(taskId));

    return {
        dependencies: newDependencies,
        roots,
        tasks: { ...taskGraph.tasks },
    };
};

/**
 * Gets all tasks that depend on the given task (directly or transitively).
 */
export const getDependentTasks = (taskGraph: TaskGraph, taskId: string): string[] => {
    const reversed = reverseTaskGraph(taskGraph);
    const result: string[] = [];
    const visited = new Set<string>();
    const queue = [taskId];

    while (queue.length > 0) {
        const current = queue.shift() as string;

        if (visited.has(current)) {
            continue;
        }

        visited.add(current);

        if (current !== taskId) {
            result.push(current);
        }

        const deps = reversed.dependencies[current] ?? [];

        for (const dep of deps) {
            if (!visited.has(dep)) {
                queue.push(dep);
            }
        }
    }

    return result;
};

/**
 * Gets all tasks that the given task depends on (directly or transitively).
 */
export const getTransitiveDependencies = (taskGraph: TaskGraph, taskId: string): string[] => {
    const result: string[] = [];
    const visited = new Set<string>();
    const queue = [taskId];

    while (queue.length > 0) {
        const current = queue.shift() as string;

        if (visited.has(current)) {
            continue;
        }

        visited.add(current);

        if (current !== taskId) {
            result.push(current);
        }

        const deps = taskGraph.dependencies[current] ?? [];

        for (const dep of deps) {
            if (!visited.has(dep)) {
                queue.push(dep);
            }
        }
    }

    return result;
};
