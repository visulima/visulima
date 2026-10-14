import { splitCompoundCommand } from "./command-parser/split-compound";
import type { Task, TaskGraph } from "./types";

export interface SplitCompoundOptions {
    /** Resolves the shell command a task runs. `undefined` leaves the task whole. */
    commandOf: (task: Task) => string | undefined;

    /** Receives a note whenever a requested split is refused or ignored. */
    onDiagnostic?: (taskId: string, message: string) => void;
}

/**
 * Returns the tasks that replace `task` in the graph. Declared and traced
 * targets split alike: a traced segment is tracked on its own command, and the
 * trace key of each segment folds in the one before it. The result is either
 * the segment chain or a single copy of the task with `splitCompound`
 * cleared, so running the split again finds nothing to do and emits no
 * second diagnostic.
 */
const expandTask = (task: Task, options: SplitCompoundOptions): Task[] => {
    const whole = { ...task, splitCompound: undefined };
    const refuse = (reason: string): Task[] => {
        options.onDiagnostic?.(task.id, `splitCompound ignored for ${task.id}: ${reason}. Running the command as one unit.`);

        return [whole];
    };

    if (task.always) {
        return refuse("an always-run target is not split");
    }

    if (task.when !== undefined) {
        return refuse("a when condition would skip segments independently");
    }

    // `{ auto: true }` outputs come from write tracking for the whole target, so
    // they cannot be attributed to one segment. Declared paths attach to the last.
    if (task.outputs.some((output) => typeof output !== "string")) {
        return refuse("`{ auto: true }` outputs are tracked per target, not per segment");
    }

    const command = options.commandOf(task);

    if (command === undefined) {
        return [whole];
    }

    const { refusedReason, segments } = splitCompoundCommand(command);

    if (refusedReason !== undefined) {
        return refuse(`the command uses ${refusedReason}`);
    }

    if (segments.length < 2) {
        return [whole];
    }

    return segments.map((segment, offset) => {
        return {
            ...whole,
            id: `${task.id}#${String(offset + 1)}`,
            // A cache hit restores outputs from the entry of the segment that
            // owns them, so the declared paths live on the last segment.
            outputs: offset === segments.length - 1 ? task.outputs : [],
            overrides: { ...task.overrides, command: segment },
            segment: { count: segments.length, index: offset + 1 },
        };
    });
};

/**
 * Rewrites every task with `splitCompound` set into a chain of segment
 * tasks (`app:build#1`, `app:build#2`, …). Returns a new graph; the input is
 * not mutated.
 *
 * Chaining uses ordinary dependencies, so the existing machinery applies:
 * segment _n_ folds in the hash of segment _n−1_ (see
 * `TaskOrchestrator`'s dependency folding), a failing segment skips the rest
 * of the chain, and results replay in segment order. Dependents of the
 * original task are rewired to the last segment, and the original task's
 * own dependencies feed the first segment.
 */
export const splitCompoundTasks = (graph: TaskGraph, options: SplitCompoundOptions): TaskGraph => {
    const expansions = new Map<string, Task[]>();

    for (const [id, task] of Object.entries(graph.tasks)) {
        if (task.splitCompound) {
            expansions.set(id, expandTask(task, options));
        }
    }

    if (expansions.size === 0) {
        return graph;
    }

    // A dependent of an expanded task waits on the last segment, which
    // only finishes once every earlier segment has succeeded.
    const resolve = (id: string): string => {
        const replacement = expansions.get(id);

        return replacement ? replacement[replacement.length - 1]!.id : id;
    };

    const tasks: Record<string, Task> = {};
    const dependencies: Record<string, string[]> = {};

    for (const [id, task] of Object.entries(graph.tasks)) {
        const replacement = expansions.get(id);
        const ownDependencies = (graph.dependencies[id] ?? []).map(resolve);

        if (replacement === undefined) {
            tasks[id] = task;
            dependencies[id] = ownDependencies;

            continue;
        }

        replacement.forEach((segment, offset) => {
            tasks[segment.id] = segment;
            dependencies[segment.id] = offset === 0 ? ownDependencies : [replacement[offset - 1]!.id];
        });
    }

    return {
        dependencies,
        roots: [...new Set(graph.roots.map(resolve))],
        tasks,
    };
};
