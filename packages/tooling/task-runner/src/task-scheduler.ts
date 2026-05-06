import type { ConcurrencyGroups, ProjectGraph, Task, TaskGraph, TaskPriority } from "./types";

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
 * Builds a Map of target-name → cap by walking the task graph and
 * taking the smallest declared `maxConcurrent` for each target name.
 * Values `<= 0` are ignored (treated as "no cap"). Multiple projects
 * declaring different caps for the same target name reduce to the min,
 * so a single project pinning `test:e2e` to 1 takes effect even if
 * other projects don't declare a cap.
 */
const buildTargetCaps = (taskGraph: TaskGraph): Map<string, number> => {
    const caps = new Map<string, number>();

    for (const task of Object.values(taskGraph.tasks)) {
        const cap = task.maxConcurrent;

        if (typeof cap !== "number" || cap <= 0 || !Number.isFinite(cap)) {
            continue;
        }

        const targetName = task.target.target;
        const previous = caps.get(targetName);

        if (previous === undefined || cap < previous) {
            caps.set(targetName, cap);
        }
    }

    return caps;
};

const buildGroupCaps = (raw: ConcurrencyGroups | undefined): Map<string, number> => {
    const caps = new Map<string, number>();

    if (raw === undefined) {
        return caps;
    }

    for (const [name, cap] of Object.entries(raw)) {
        if (typeof cap === "number" && cap > 0 && Number.isFinite(cap)) {
            caps.set(name, cap);
        }
    }

    return caps;
};

/**
 * Computes the concurrency keys a task holds, in priority-stable
 * order. Each key is `target:<name>` for the per-target cap, or
 * `group:<name>` for a workspace-level cap. Returns an empty array
 * when the task has neither cap, so the hot path stays allocation-free
 * for the common uncapped case.
 */
const computeTaskKeys = (task: Task, targetCaps: Map<string, number>, groupCaps: Map<string, number>): string[] => {
    const keys: string[] = [];

    if (targetCaps.has(task.target.target)) {
        keys.push(`target:${task.target.target}`);
    }

    if (task.concurrencyGroup !== undefined && groupCaps.has(task.concurrencyGroup)) {
        keys.push(`group:${task.concurrencyGroup}`);
    }

    return keys;
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

    /** target-name → cap (smallest declared). Empty when no caps. */
    readonly #targetCaps: Map<string, number>;

    /** group-name → cap (from workspace options). Empty when no caps. */
    readonly #groupCaps: Map<string, number>;

    /** Per-task list of capped keys; cached so the slot-fill loop is O(running) per candidate. */
    readonly #taskKeys: Map<string, string[]>;

    /** Live count of running tasks per capped key. */
    readonly #runningPerKey = new Map<string, number>();

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

    public constructor(taskGraph: TaskGraph, projectGraph: ProjectGraph, maxParallel: number = 3, concurrencyGroups?: ConcurrencyGroups) {
        this.#taskGraph = taskGraph;
        this.#maxParallel = maxParallel;
        this.#totalTasks = Object.keys(taskGraph.tasks).length;
        this.#dependentCounts = this.#calculateDependentCounts();
        this.#projectDepths = calculateProjectDepths(projectGraph);
        this.#targetCaps = buildTargetCaps(taskGraph);
        this.#groupCaps = buildGroupCaps(concurrencyGroups);
        this.#taskKeys = new Map();

        // Pre-compute every task's keys once so the slot-fill loop
        // doesn't re-derive them per tick. The common case (no caps
        // anywhere) yields an empty array via the early-out in
        // computeTaskKeys, so the loop stays effectively no-op.
        const hasAnyCap = this.#targetCaps.size > 0 || this.#groupCaps.size > 0;

        if (hasAnyCap) {
            for (const [taskId, task] of Object.entries(taskGraph.tasks)) {
                const keys = computeTaskKeys(task, this.#targetCaps, this.#groupCaps);

                if (keys.length > 0) {
                    this.#taskKeys.set(taskId, keys);
                }
            }
        }
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

        // Fast path: no caps configured, original slice behavior.
        if (this.#taskKeys.size === 0) {
            return sortedTasks.slice(0, availableSlots);
        }

        // Cap-aware fill. Walk in priority order and skip any task
        // whose start would push a per-target or per-group key over
        // its declared cap. Skipped tasks aren't dropped — they stay
        // in the ready queue for the next tick (a running task with
        // the same key will eventually complete and free the slot).
        // We also accumulate hypothetical key counts within this pass
        // so the cap holds even when the same batch contains multiple
        // candidates sharing a key.
        const batch: Task[] = [];
        const projectedPerKey = new Map<string, number>(this.#runningPerKey);

        for (const task of sortedTasks) {
            if (batch.length >= availableSlots) {
                break;
            }

            const keys = this.#taskKeys.get(task.id);

            if (keys === undefined) {
                batch.push(task);
                continue;
            }

            const wouldExceed = keys.some((key) => {
                const cap = this.#capForKey(key);
                const projected = (projectedPerKey.get(key) ?? 0) + 1;

                return cap !== undefined && projected > cap;
            });

            if (wouldExceed) {
                continue;
            }

            for (const key of keys) {
                projectedPerKey.set(key, (projectedPerKey.get(key) ?? 0) + 1);
            }

            batch.push(task);
        }

        return batch;
    }

    public startTask(taskId: string): void {
        // Idempotent: a double-start would over-count the per-key
        // running totals and the cap would never recover. Bail before
        // mutating any state.
        if (this.#runningTasks.has(taskId)) {
            return;
        }

        this.#runningTasks.add(taskId);

        const keys = this.#taskKeys.get(taskId);

        if (keys !== undefined) {
            for (const key of keys) {
                this.#runningPerKey.set(key, (this.#runningPerKey.get(key) ?? 0) + 1);
            }
        }
    }

    public completeTask(taskId: string): void {
        // Only decrement per-key counts when this id was actually
        // marked running. Without this guard a double-complete (or a
        // complete on an id that never started) would underflow and
        // delete the key, silently freeing a slot the cap was holding.
        const wasRunning = this.#runningTasks.delete(taskId);

        this.#completedTasks.add(taskId);

        if (!wasRunning) {
            return;
        }

        const keys = this.#taskKeys.get(taskId);

        if (keys !== undefined) {
            for (const key of keys) {
                const next = (this.#runningPerKey.get(key) ?? 0) - 1;

                if (next <= 0) {
                    this.#runningPerKey.delete(key);
                } else {
                    this.#runningPerKey.set(key, next);
                }
            }
        }
    }

    #capForKey(key: string): number | undefined {
        if (key.startsWith("target:")) {
            return this.#targetCaps.get(key.slice("target:".length));
        }

        if (key.startsWith("group:")) {
            return this.#groupCaps.get(key.slice("group:".length));
        }

        return undefined;
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
