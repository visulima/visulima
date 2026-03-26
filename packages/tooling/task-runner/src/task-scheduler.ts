import type { ProjectGraph, Task, TaskGraph } from "./types";

const calculateProjectDepths = (projectGraph: ProjectGraph): Map<string, number> => {
    const depths = new Map<string, number>();
    const visited = new Set<string>();

    const calculateDepth = (projectName: string): number => {
        if (depths.has(projectName)) {
            return depths.get(projectName) as number;
        }

        if (visited.has(projectName)) {
            return 0;
        }

        visited.add(projectName);

        const deps = projectGraph.dependencies[projectName] ?? [];
        let maxDepth = 0;

        for (const dep of deps) {
            maxDepth = Math.max(maxDepth, calculateDepth(dep.target) + 1);
        }

        depths.set(projectName, maxDepth);
        visited.delete(projectName);

        return maxDepth;
    };

    for (const projectName of Object.keys(projectGraph.nodes)) {
        calculateDepth(projectName);
    }

    return depths;
};

/**
 * Manages the scheduling order of tasks based on dependencies,
 * parallelism constraints, and estimated execution times.
 */
// eslint-disable-next-line import/prefer-default-export
export class TaskScheduler {
    readonly #taskGraph: TaskGraph;

    readonly #maxParallel: number;

    readonly #completedTasks = new Set<string>();

    readonly #runningTasks = new Set<string>();

    readonly #totalTasks: number;

    readonly #dependentCounts: Map<string, number>;

    readonly #projectDepths: Map<string, number>;

    public constructor(taskGraph: TaskGraph, projectGraph: ProjectGraph, maxParallel: number = 3) {
        this.#taskGraph = taskGraph;
        this.#maxParallel = maxParallel;
        this.#totalTasks = Object.keys(taskGraph.tasks).length;
        this.#dependentCounts = this.#calculateDependentCounts();
        this.#projectDepths = calculateProjectDepths(projectGraph);
    }

    /**
     * Returns the next batch of tasks that are ready to execute.
     */
    public getNextBatch(): Task[] {
        const availableSlots = this.#maxParallel - this.#runningTasks.size;

        if (availableSlots <= 0) {
            return [];
        }

        const readyTasks = this.#getReadyTasks();
        const sortedTasks = this.#sortByPriority(readyTasks);

        return sortedTasks.slice(0, availableSlots);
    }

    public startTask(taskId: string): void {
        this.#runningTasks.add(taskId);
    }

    public completeTask(taskId: string): void {
        this.#runningTasks.delete(taskId);
        this.#completedTasks.add(taskId);
    }

    public isComplete(): boolean {
        return this.#completedTasks.size === this.#totalTasks;
    }

    public get remainingCount(): number {
        return this.#totalTasks - this.#completedTasks.size;
    }

    public get runningCount(): number {
        return this.#runningTasks.size;
    }

    #getReadyTasks(): Task[] {
        const ready: Task[] = [];

        for (const [taskId, task] of Object.entries(this.#taskGraph.tasks)) {
            if (this.#completedTasks.has(taskId) || this.#runningTasks.has(taskId)) {
                continue;
            }

            const deps = this.#taskGraph.dependencies[taskId] ?? [];

            if (deps.every((dep) => this.#completedTasks.has(dep))) {
                ready.push(task);
            }
        }

        return ready;
    }

    #sortByPriority(tasks: Task[]): Task[] {
        return [...tasks].toSorted((a, b) => {
            const aDeps = this.#dependentCounts.get(a.id) ?? 0;
            const bDeps = this.#dependentCounts.get(b.id) ?? 0;

            if (aDeps !== bDeps) {
                return bDeps - aDeps;
            }

            const aDepth = this.#projectDepths.get(a.target.project) ?? 0;
            const bDepth = this.#projectDepths.get(b.target.project) ?? 0;

            if (aDepth !== bDepth) {
                return bDepth - aDepth;
            }

            return a.id.localeCompare(b.id);
        });
    }

    #calculateDependentCounts(): Map<string, number> {
        const counts = new Map<string, number>();

        for (const taskId of Object.keys(this.#taskGraph.tasks)) {
            counts.set(taskId, 0);
        }

        for (const deps of Object.values(this.#taskGraph.dependencies)) {
            for (const dep of deps) {
                counts.set(dep, (counts.get(dep) ?? 0) + 1);
            }
        }

        return counts;
    }
}
