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
            // Mirror task-graph.ts: peer-dep edges don't constrain
            // build ordering and would otherwise inflate scheduling
            // depths used for tie-breaking.
            if (dep.type === "peerDependency") {
                continue;
            }

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
 * Values `&lt;= 0` are ignored (treated as "no cap"). Multiple projects
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

/**
 * Resolves a task's slot weight against the global `parallel` cap.
 * Defaults to `1` for any unset, non-positive, non-finite, or
 * non-integer value — the scheduler treats those as "one slot" rather
 * than rejecting them, so a typo never wedges the graph.
 */
const resolveWeight = (task: Task): number => {
    const raw = task.concurrencyWeight;

    if (typeof raw !== "number" || !Number.isInteger(raw) || raw <= 0) {
        return 1;
    }

    return raw;
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
 * order. Each key is `target:&lt;name>` for the per-target cap, or
 * `group:&lt;name>` for a workspace-level cap. Returns an empty array
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

    /** Sum of resolved `concurrencyWeight` for every currently-running task. */
    #runningWeight = 0;

    /** task-id → resolved weight, captured at start so completion mirrors start. */
    readonly #runningWeights = new Map<string, number>();

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
     *
     * Slot accounting is weighted: a task's `concurrencyWeight` (default
     * `1`) counts against the global `parallel` cap. A heavier task may
     * still run alone — when nothing is in flight, the scheduler always
     * admits at least one ready task even if its weight exceeds the cap,
     * so a `parallel: 1` pool can't deadlock on a weight-3 task.
     */
    public getNextBatch(): Task[] {
        const availableSlots = this.#maxParallel - this.#runningWeight;

        // A weight-N task can still claim the pool when nothing's
        // running. Only return early when in-flight tasks already
        // saturate the budget.
        if (availableSlots <= 0 && this.#runningTasks.size > 0) {
            return [];
        }

        // `parallelism: false` means the task runs in isolation — no
        // siblings concurrent with it. While one is running we yield
        // the entire scheduler tick so the loop waits for it to
        // complete. Documented in vis but the field was previously
        // ignored.
        if (this.#runningTasks.size > 0) {
            for (const runningId of this.#runningTasks) {
                if (this.#taskGraph.tasks[runningId]?.parallelism === false) {
                    return [];
                }
            }
        }

        const readyTasks = this.#getReadyTasks();
        const sortedTasks = this.#sortByPriority(readyTasks);

        // Cap-aware fill. Walk in priority order and skip any task
        // whose start would exceed the weighted budget or push a
        // per-target/per-group key over its declared cap. Skipped
        // tasks stay in the ready queue for the next tick (a running
        // task with the same key will eventually complete and free
        // the slot). Hypothetical key counts accumulate within this
        // pass so caps hold when the same batch contains multiple
        // candidates sharing a key. The single unified loop subsumes
        // the old no-caps fast-path — uncapped tasks just skip the
        // key checks and pay only the weight accounting.
        const batch: Task[] = [];
        const projectedPerKey = new Map<string, number>(this.#runningPerKey);
        let projectedWeight = this.#runningWeight;
        const idle = this.#runningTasks.size === 0;

        for (const task of sortedTasks) {
            const weight = resolveWeight(task);
            const remaining = this.#maxParallel - projectedWeight;

            // Weight fit: normally the task must fit in the remaining
            // budget. The exception is the very first admit on an idle
            // pool — a single heavy task always gets to run, otherwise
            // a weight-3 task on `parallel: 1` would never start.
            const weightFits = weight <= remaining || (idle && batch.length === 0);

            if (!weightFits) {
                continue;
            }

            // `parallelism: false` means the task runs alone. If
            // anything is already queued for this tick, defer the
            // singleton to its own batch.
            if (task.parallelism === false && batch.length > 0) {
                break;
            }

            const keys = this.#taskKeys.get(task.id);
            const exceedsKeyCap = keys === undefined
                ? false
                : keys.some((key) => {
                    const cap = this.#capForKey(key);
                    const projected = (projectedPerKey.get(key) ?? 0) + 1;

                    return cap !== undefined && projected > cap;
                });

            if (exceedsKeyCap) {
                continue;
            }

            if (keys !== undefined) {
                for (const key of keys) {
                    projectedPerKey.set(key, (projectedPerKey.get(key) ?? 0) + 1);
                }
            }

            projectedWeight += weight;
            batch.push(task);

            // Once a singleton lands in the batch nothing else may
            // ride along with it. Bail so the loop returns just that
            // task.
            if (task.parallelism === false) {
                break;
            }
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

        const task = this.#taskGraph.tasks[taskId];
        const weight = task === undefined ? 1 : resolveWeight(task);

        this.#runningWeights.set(taskId, weight);
        this.#runningWeight += weight;

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

        const weight = this.#runningWeights.get(taskId);

        if (weight !== undefined) {
            this.#runningWeight -= weight;
            this.#runningWeights.delete(taskId);
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

    /**
     * Returns dep-id refs the task graph carries that don't resolve to
     * any task in `tasks`, keyed by the task that declared them. The
     * scheduler treats these as already-completed so the run can
     * proceed, but the orchestrator surfaces this map as a warning at
     * run start so the underlying input bug (vis / config emitting
     * dangling refs) doesn't go silently masked.
     */
    public getOrphanDependencies(): Map<string, string[]> {
        const orphans = new Map<string, string[]>();
        const tasks = this.#taskGraph.tasks;

        for (const [taskId, deps] of Object.entries(this.#taskGraph.dependencies)) {
            if (!(taskId in tasks)) {
                continue;
            }

            const missing = deps.filter((dep) => !(dep in tasks));

            if (missing.length > 0) {
                orphans.set(taskId, missing);
            }
        }

        return orphans;
    }

    /**
     * Returns task ids that are not in `completedTasks` and not in
     * `runningTasks`, along with their unmet deps after orphan refs
     * have been filtered out. The orchestrator's deadlock error reads
     * this so the message can name the actual stranded tasks instead
     * of a generic "may indicate a circular dependency" hint.
     */
    public describeStrandedTasks(): { id: string; unmetDeps: string[] }[] {
        const stranded: { id: string; unmetDeps: string[] }[] = [];
        const tasks = this.#taskGraph.tasks;

        for (const taskId of Object.keys(tasks)) {
            if (this.#completedTasks.has(taskId) || this.#runningTasks.has(taskId)) {
                continue;
            }

            const deps = this.#taskGraph.dependencies[taskId] ?? [];
            const unmetDeps = deps.filter((dep) => dep in tasks && !this.#completedTasks.has(dep));

            stranded.push({ id: taskId, unmetDeps });
        }

        return stranded;
    }

    #getReadyTasks(): Task[] {
        const ready: Task[] = [];
        const tasks = this.#taskGraph.tasks;

        for (const [taskId, task] of Object.entries(tasks)) {
            if (this.#completedTasks.has(taskId) || this.#runningTasks.has(taskId)) {
                continue;
            }

            const deps = this.#taskGraph.dependencies[taskId] ?? [];

            // Treat orphan dep refs — ids the graph never materialised
            // — as already completed. Without this, a task carrying a
            // dangling ref sits in the ready check forever, and the
            // orchestrator misdiagnoses the stall as a circular dep.
            if (deps.every((dep) => this.#completedTasks.has(dep) || !(dep in tasks))) {
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
