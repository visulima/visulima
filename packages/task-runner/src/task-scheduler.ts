import type { ProjectGraph, Task, TaskGraph } from "./types";

/**
 * Manages the scheduling order of tasks based on dependencies,
 * parallelism constraints, and estimated execution times.
 */
export class TaskScheduler {
    readonly #taskGraph: TaskGraph;
    readonly #projectGraph: ProjectGraph;
    readonly #maxParallel: number;
    readonly #completedTasks = new Set<string>();
    readonly #runningTasks = new Set<string>();

    constructor(
        taskGraph: TaskGraph,
        projectGraph: ProjectGraph,
        maxParallel: number = 3,
    ) {
        this.#taskGraph = taskGraph;
        this.#projectGraph = projectGraph;
        this.#maxParallel = maxParallel;
    }

    /**
     * Returns the next batch of tasks that are ready to execute.
     * A task is ready when all its dependencies have completed.
     */
    getNextBatch(): Task[] {
        const availableSlots = this.#maxParallel - this.#runningTasks.size;

        if (availableSlots <= 0) {
            return [];
        }

        const readyTasks = this.#getReadyTasks();
        const sortedTasks = this.#sortByPriority(readyTasks);

        return sortedTasks.slice(0, availableSlots);
    }

    /**
     * Marks a task as started.
     */
    startTask(taskId: string): void {
        this.#runningTasks.add(taskId);
    }

    /**
     * Marks a task as completed.
     */
    completeTask(taskId: string): void {
        this.#runningTasks.delete(taskId);
        this.#completedTasks.add(taskId);
    }

    /**
     * Returns true if all tasks have been completed.
     */
    isComplete(): boolean {
        return (
            this.#completedTasks.size === Object.keys(this.#taskGraph.tasks).length
        );
    }

    /**
     * Returns the number of tasks that have not yet been completed.
     */
    get remainingCount(): number {
        return (
            Object.keys(this.#taskGraph.tasks).length - this.#completedTasks.size
        );
    }

    /**
     * Returns the number of currently running tasks.
     */
    get runningCount(): number {
        return this.#runningTasks.size;
    }

    /**
     * Returns all tasks ready to execute (dependencies met, not yet started or completed).
     */
    #getReadyTasks(): Task[] {
        const ready: Task[] = [];

        for (const [taskId, task] of Object.entries(this.#taskGraph.tasks)) {
            if (this.#completedTasks.has(taskId) || this.#runningTasks.has(taskId)) {
                continue;
            }

            const deps = this.#taskGraph.dependencies[taskId] ?? [];
            const allDepsMet = deps.every((dep) => this.#completedTasks.has(dep));

            if (allDepsMet) {
                ready.push(task);
            }
        }

        return ready;
    }

    /**
     * Sorts tasks by priority for execution ordering.
     *
     * Priority factors (highest to lowest):
     * 1. Number of tasks that depend on this task (more dependents = higher priority)
     * 2. Tasks with parallelism=false go first when they're the only option
     * 3. Depth in the project dependency graph
     */
    #sortByPriority(tasks: Task[]): Task[] {
        const dependentCounts = this.#calculateDependentCounts();
        const projectDepths = this.#calculateProjectDepths();

        return [...tasks].sort((a, b) => {
            // More dependents = higher priority
            const aDeps = dependentCounts.get(a.id) ?? 0;
            const bDeps = dependentCounts.get(b.id) ?? 0;

            if (aDeps !== bDeps) {
                return bDeps - aDeps;
            }

            // Deeper in project graph = higher priority (build dependencies first)
            const aDepth = projectDepths.get(a.target.project) ?? 0;
            const bDepth = projectDepths.get(b.target.project) ?? 0;

            if (aDepth !== bDepth) {
                return bDepth - aDepth;
            }

            // Stable sort by task ID
            return a.id.localeCompare(b.id);
        });
    }

    /**
     * Calculates how many tasks depend on each task (directly or transitively).
     */
    #calculateDependentCounts(): Map<string, number> {
        const counts = new Map<string, number>();

        for (const taskId of Object.keys(this.#taskGraph.tasks)) {
            counts.set(taskId, 0);
        }

        // For each task, increment the count of all its dependencies
        for (const deps of Object.values(this.#taskGraph.dependencies)) {
            for (const dep of deps) {
                counts.set(dep, (counts.get(dep) ?? 0) + 1);
            }
        }

        return counts;
    }

    /**
     * Calculates the depth of each project in the dependency graph.
     */
    #calculateProjectDepths(): Map<string, number> {
        const depths = new Map<string, number>();
        const visited = new Set<string>();

        const calculateDepth = (projectName: string): number => {
            if (depths.has(projectName)) {
                return depths.get(projectName) as number;
            }

            if (visited.has(projectName)) {
                return 0; // Cycle detected, break it
            }

            visited.add(projectName);

            const deps = this.#projectGraph.dependencies[projectName] ?? [];
            let maxDepth = 0;

            for (const dep of deps) {
                const depDepth = calculateDepth(dep.target);

                maxDepth = Math.max(maxDepth, depDepth + 1);
            }

            depths.set(projectName, maxDepth);
            visited.delete(projectName);

            return maxDepth;
        };

        for (const projectName of Object.keys(this.#projectGraph.nodes)) {
            calculateDepth(projectName);
        }

        return depths;
    }
}
