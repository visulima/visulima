import type { ProjectGraph, Task, TaskGraph, TaskPriority } from "./types";

/**
 * Numeric weight for a `TaskPriority` value. `"normal"` is the anchor;
 * `"high"` outranks it and `"low"` is ranked below. Used as the
 * primary sort key in the scheduler's ready-queue ordering.
 */
const taskPriorityWeight = (priority: TaskPriority | undefined): number => {
    switch (priority) {
        case "high": {
            return 2;
        }
        case "low": {
            return 0;
        }
        default: {
            return 1;
        }
    }
};

/**
 * Options for partitioning tasks across CI runners.
 */
export interface PartitionOptions {
    /** 1-based partition index (e.g., 1 for the first partition) */
    index: number;
    /** Total number of partitions */
    total: number;
}

/**
 * Parses a partition string like "1/4" into PartitionOptions.
 * Also supports the VIS_PARTITION environment variable as fallback.
 */
export const parsePartition = (value?: string): PartitionOptions | undefined => {
    const raw = value ?? process.env.VIS_PARTITION;

    if (!raw) {
        return undefined;
    }

    const parts = raw.split("/");

    if (parts.length !== 2) {
        throw new Error(`Invalid partition format: "${raw}". Expected format: "index/total" (e.g., "1/4").`);
    }

    const index = Number(parts[0]);
    const total = Number(parts[1]);

    if (!Number.isInteger(index) || !Number.isInteger(total) || index < 1 || total < 1) {
        throw new Error(`Invalid partition values: "${raw}". Both index and total must be positive integers.`);
    }

    if (index > total) {
        throw new Error(`Invalid partition index: ${index} exceeds total ${total}.`);
    }

    return { index, total };
};

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

export class TaskScheduler {
    readonly #taskGraph: TaskGraph;

    readonly #maxParallel: number;

    readonly #completedTasks = new Set<string>();

    readonly #runningTasks = new Set<string>();

    readonly #totalTasks: number;

    readonly #dependentCounts: Map<string, number>;

    readonly #projectDepths: Map<string, number>;

    /**
     * Partitions a list of tasks for distributed CI execution.
     * Tasks are sorted by ID for deterministic distribution, then split
     * using ceiling division so partitions differ by at most one task.
     * @param tasks The full list of tasks to partition
     * @param partition The partition configuration (1-based index and total)
     * @returns The subset of tasks assigned to this partition
     */
    public static partitionTasks(tasks: Task[], partition: PartitionOptions): Task[] {
        if (partition.total < 1) {
            throw new Error(`Invalid partition total: ${partition.total}. Must be at least 1.`);
        }

        if (partition.index < 1 || partition.index > partition.total) {
            throw new Error(`Invalid partition index: ${partition.index}. Must be between 1 and ${partition.total}.`);
        }

        if (tasks.length === 0) {
            return [];
        }

        // Sort by ID for deterministic partitioning across CI runners
        const sorted = [...tasks].toSorted((a, b) => a.id.localeCompare(b.id));

        const size = Math.ceil(sorted.length / partition.total);
        const start = size * (partition.index - 1);
        const end = partition.index === partition.total ? sorted.length : size * partition.index;

        return sorted.slice(start, end);
    }

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
            // Explicit priority hints outrank graph-derived signals —
            // `"high"` tasks fire first, then `"normal"`, then `"low"`.
            const aPriority = taskPriorityWeight(a.priority);
            const bPriority = taskPriorityWeight(b.priority);

            if (aPriority !== bPriority) {
                return bPriority - aPriority;
            }

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
