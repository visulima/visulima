import type { Task, TaskGraph } from "@visulima/task-runner";

import { isAlive } from "../../services/registry";
import type { ServiceEntry } from "../../services/types";
import type { VisTargetOptions } from "../../task/target-options";

const getVisOptions = (task: Task): VisTargetOptions | undefined => {
    const options = task.overrides["visOptions"];

    return options && typeof options === "object" ? (options) : undefined;
};

export interface ServiceRegistryDiagnostic {
    /** Always actionable — explains how to satisfy the dep. */
    message: string;
    targetId: string;
}

/**
 * Optional probe applied to each alive registry entry before it is
 * accepted as "satisfied". Returning `false` (or throwing) demotes the
 * entry as if it were missing — the caller will emit a diagnostic.
 *
 * Useful for `vis run` to re-verify TCP reachability before relying on
 * a stale entry the OS still reports as alive.
 */
export type ServiceProbe = (entry: ServiceEntry) => Promise<boolean>;

export interface ApplyServiceRegistryInput {
    /** Tasks the user invoked directly via `vis run` (post persistent-split). */
    initialTasks: Task[];
    /** Optional liveness/health probe; runs on each alive registry entry. */
    probe?: ServiceProbe;
    /** Service entries already on disk in the workspace registry. */
    registeredEntries: ServiceEntry[];
    taskGraph: TaskGraph;
    /** Current vis version — entries from a different vis are treated as stale. */
    visVersion: string;
}

export interface ApplyServiceRegistryResult {
    /** Errors collected during pruning. Caller should print + abort the run if non-empty. */
    diagnostics: ServiceRegistryDiagnostic[];
    initialTasks: Task[];
    /** Entries actually attached (alive + version-matched + present in graph). */
    satisfiedServices: ServiceEntry[];

    /**
     * Pre-computed env to merge per dependent task id. Keyed by *dependent* —
     * not by service — because the post-prune graph no longer carries the
     * `:test → :db` edge for the executor to walk.
     *
     * Includes transitive contributions: if `chain → middle → db (service)`,
     * then both `middle` and `chain` receive `db.env` (chain via the
     * original `middle → db` edge that pruning erases).
     */
    serviceEnvByTaskId: Map<string, Record<string, string>>;
    taskGraph: TaskGraph;
}

/**
 * Reshape the task graph in light of the service registry.
 *
 * For each task that declares `options.service`:
 *
 * 1. **Alive registry entry, version match, probe ok** — drop the task
 *    from `initialTasks`, from `taskGraph.tasks`, and from every other
 *    task's `dependencies` list. Roots are recomputed accordingly. The
 *    service's env is recorded against every transitive dependent so
 *    the executor can merge it without re-walking the (pruned) graph.
 *
 * 2. **No registry entry, but the task is a dep of another task** —
 *    record an actionable diagnostic. The caller decides whether to
 *    abort the run; we never half-apply.
 *
 * 3. **No registry entry, user invoked it directly** — leave it in
 *    place. The existing in-process persistent-task path handles
 *    one-run-only services unchanged.
 *
 * 4. **Stale entry (vis version mismatch)** — treated identically to
 *    "no entry" in the diagnostic path. Operators get a clear hint
 *    to restart the service against the current vis.
 *
 * Pure-ish: returns a new graph and a new task list, never mutates
 * input. Async to accommodate the optional health probe.
 */
export const applyServiceRegistry = async (input: ApplyServiceRegistryInput): Promise<ApplyServiceRegistryResult> => {
    const { initialTasks, probe, registeredEntries, taskGraph, visVersion } = input;

    const aliveById = new Map<string, ServiceEntry>();
    const staleById = new Map<string, ServiceEntry>();

    /**
     * Entries the OS still reports as alive but whose readiness probe
     * failed. Tracked separately from `staleById` so we can emit a
     * "restart" diagnostic rather than "start" — the operator's mental
     * model is "this thing was running, something broke it" not "I
     * forgot to start it".
     */
    const probeFailedById = new Map<string, ServiceEntry>();

    for (const entry of registeredEntries) {
        if (!isAlive(entry.pid)) {
            continue;
        }

        if (entry.visVersion !== visVersion) {
            staleById.set(entry.id, entry);
            continue;
        }

        aliveById.set(entry.id, entry);
    }

    // Run the optional probe in parallel — a failed probe demotes the
    // entry into `probeFailedById` so the diagnostic can suggest
    // `vis service restart` instead of `vis service start`.
    if (probe) {
        const aliveEntries = [...aliveById.values()];
        const probeResults = await Promise.all(
            aliveEntries.map(async (entry) => {
                try {
                    return [entry.id, await probe(entry)] as const;
                } catch {
                    return [entry.id, false] as const;
                }
            }),
        );

        for (const [id, ok] of probeResults) {
            if (!ok) {
                const entry = aliveById.get(id);

                aliveById.delete(id);

                if (entry) {
                    probeFailedById.set(id, entry);
                }
            }
        }
    }

    const initialTaskIds = new Set(initialTasks.map((task) => task.id));
    const satisfied = new Set<string>();
    const diagnostics: ServiceRegistryDiagnostic[] = [];
    const satisfiedServices: ServiceEntry[] = [];

    // Build reverse-edge index from the *original* graph so we can ask
    // "is task X a dep of anything?" without walking dependencies again
    // for every iteration.
    const hasDependent = new Set<string>();

    for (const deps of Object.values(taskGraph.dependencies)) {
        for (const depId of deps) {
            hasDependent.add(depId);
        }
    }

    for (const [taskId, task] of Object.entries(taskGraph.tasks)) {
        const options = getVisOptions(task);

        if (!options?.service) {
            continue;
        }

        if (aliveById.has(taskId)) {
            satisfied.add(taskId);
            satisfiedServices.push(aliveById.get(taskId)!);
            continue;
        }

        const isUserInvoked = initialTaskIds.has(taskId);

        if (isUserInvoked) {
            // User asked to run the service directly — the existing
            // persistent-task path will boot it for this run.
            continue;
        }

        if (!hasDependent.has(taskId)) {
            // Orphan: nothing depends on it and the user didn't invoke
            // it. Emitting a diagnostic would be noise — just skip.
            continue;
        }

        const stale = staleById.get(taskId);
        const probeFailed = probeFailedById.get(taskId);

        let reason: string;

        if (stale) {
            reason = `Service ${taskId} is registered with vis ${stale.visVersion}, but this invocation is vis ${visVersion}. Restart with \`vis service restart ${taskId}\` to pick up the new version.`;
        } else if (probeFailed) {
            reason = `Service ${taskId} is registered (PID ${String(probeFailed.pid)}) but failed its readiness probe — the wrapper process is alive but the underlying server is not responding. Run \`vis service restart ${taskId}\` to recover.`;
        } else {
            reason = `Target depends on the service ${taskId}, which is not running. Run \`vis service start ${taskId}\` first, or invoke \`${taskId}\` directly.`;
        }

        diagnostics.push({ message: reason, targetId: taskId });
    }

    if (satisfied.size === 0) {
        return {
            diagnostics,
            initialTasks,
            satisfiedServices,
            serviceEnvByTaskId: new Map(),
            taskGraph,
        };
    }

    // Capture the dependent → service-env contribution BEFORE pruning
    // edges. Walk the *original* graph transitively so a task that only
    // reaches a satisfied service via intermediate (pruned or kept)
    // tasks still inherits its env.
    const serviceEnvByTaskId = new Map<string, Record<string, string>>();

    const collectTransitiveServices = (start: string): string[] => {
        const found = new Set<string>();
        const stack = [...(taskGraph.dependencies[start] ?? [])];
        const seen = new Set<string>();

        while (stack.length > 0) {
            const next = stack.pop()!;

            if (seen.has(next)) {
                continue;
            }

            seen.add(next);

            if (satisfied.has(next)) {
                found.add(next);
            }

            for (const depOfNext of taskGraph.dependencies[next] ?? []) {
                if (!seen.has(depOfNext)) {
                    stack.push(depOfNext);
                }
            }
        }

        // Sort for deterministic merge order — without this, env-key
        // collisions resolve in graph-traversal order, which is stable
        // per-input but indistinguishable across refactors.
        return [...found].sort();
    };

    for (const dependentId of Object.keys(taskGraph.dependencies)) {
        if (satisfied.has(dependentId)) {
            continue;
        }

        const services = collectTransitiveServices(dependentId);

        if (services.length === 0) {
            continue;
        }

        const merged: Record<string, string> = {};

        for (const serviceId of services) {
            const entry = aliveById.get(serviceId);

            if (!entry) {
                continue;
            }

            // Multiple satisfied service deps: later (alphabetically)
            // wins on key collision. Stable across runs, so a downstream
            // task can rely on which env it sees.
            Object.assign(merged, entry.env);
        }

        if (Object.keys(merged).length > 0) {
            serviceEnvByTaskId.set(dependentId, merged);
        }
    }

    const filteredTasks: Record<string, Task> = {};

    for (const [id, task] of Object.entries(taskGraph.tasks)) {
        if (!satisfied.has(id)) {
            filteredTasks[id] = task;
        }
    }

    const filteredDependencies: Record<string, string[]> = {};

    for (const [id, deps] of Object.entries(taskGraph.dependencies)) {
        if (satisfied.has(id)) {
            continue;
        }

        filteredDependencies[id] = deps.filter((depId) => !satisfied.has(depId));
    }

    // Roots = tasks no other task depends on. Once the satisfied
    // services are gone, recompute from scratch instead of patching the
    // old roots list — entries that were *only* roots because they fed
    // a satisfied service stay correct, and former leaves promoted to
    // roots get included.
    const reverseEdgeCount = new Map<string, number>();

    for (const id of Object.keys(filteredTasks)) {
        reverseEdgeCount.set(id, 0);
    }

    for (const deps of Object.values(filteredDependencies)) {
        for (const depId of deps) {
            if (reverseEdgeCount.has(depId)) {
                reverseEdgeCount.set(depId, (reverseEdgeCount.get(depId) ?? 0) + 1);
            }
        }
    }

    const filteredRoots: string[] = [];

    for (const root of taskGraph.roots) {
        if (!satisfied.has(root) && filteredTasks[root]) {
            filteredRoots.push(root);
        }
    }

    // Promote any task that was a dep of a satisfied service (and now
    // has no remaining dependents) into a root. Without this, removing
    // a service that was the sole consumer of an upstream task would
    // strand that upstream task off the root list.
    for (const [id, count] of reverseEdgeCount) {
        if (count === 0 && !filteredRoots.includes(id) && filteredTasks[id]) {
            filteredRoots.push(id);
        }
    }

    const filteredInitialTasks = initialTasks.filter((task) => !satisfied.has(task.id));

    return {
        diagnostics,
        initialTasks: filteredInitialTasks,
        satisfiedServices,
        serviceEnvByTaskId,
        taskGraph: {
            dependencies: filteredDependencies,
            roots: filteredRoots,
            tasks: filteredTasks,
        },
    };
};
