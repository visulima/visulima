import type { Actor, Snapshot } from "xstate";
import { createActor } from "xstate";

import WorkflowError, { LeaseHeldError, RunNotFoundError, serializeError } from "./errors";
import generateRunId from "./id";
import runMachine from "./lifecycle-machine";
import executeRun from "./run-context";
import MemoryStore from "./store/memory-store";
import type { StoredRun, WorkflowStore } from "./store/types";
import type { PendingSuspension, RunStatus, SerializedError, StepRecord, WorkflowDefinition } from "./types";

/**
 * Internal erased workflow type for the registry. Payload/output are opaque at
 * the runtime boundary, where runs are addressed by id rather than by type.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- intentional type erasure at the registry boundary
type AnyWorkflowDefinition = WorkflowDefinition<any, any>;

type RunActor = Actor<typeof runMachine>;

/** A read-only view of a run's current state. */
interface RunInfo {
    error?: SerializedError;
    history: StepRecord[];
    output?: unknown;
    pending?: PendingSuspension;
    runId: string;
    status: RunStatus;
}

/** The outcome of a trigger/resume/signal activation. */
interface RunResult {
    error?: SerializedError;
    output?: unknown;
    pending?: PendingSuspension;
    runId: string;
    status: RunStatus;
}

/** Options for {@link createRuntime}. */
interface RuntimeOptions {
    /**
     * How long (ms) a cross-process lease is held while an activation runs, for
     * stores that implement {@link WorkflowStore.acquire}. Must exceed the longest
     * expected single activation. Defaults to 30000.
     */
    leaseTtlMs?: number;
    /** The durable store; defaults to an in-memory store. */
    store?: WorkflowStore;
    /** Workflows to pre-register. */
    workflows?: AnyWorkflowDefinition[];
}

/**
 * The engine runtime: registers workflows, triggers runs, and resumes/signals
 * suspended runs. Durability is delegated to the configured {@link WorkflowStore}.
 */
interface WorkflowRuntime {
    /** Read a run's current state, or `undefined` if unknown. */
    getRun: (runId: string) => Promise<RunInfo | undefined>;
    /** Register a workflow so it can be triggered/resumed by id. */
    register: (workflow: AnyWorkflowDefinition) => void;

    /**
     * Advance a suspended run whose sleep/timeout is now due (no-op if not yet due).
     * Used by {@link WorkflowRuntime.sweep}; an untimed wait is advanced only via {@link WorkflowRuntime.signal}.
     */
    resume: (runId: string) => Promise<RunResult>;
    /** Deliver an external event to a run waiting via `ctx.waitForEvent`. */
    signal: (runId: string, event: string, payload?: unknown) => Promise<RunResult>;
    /** Resume every run whose wake-at has passed (the cron/edge entrypoint). */
    sweep: (now?: number, limit?: number) => Promise<RunResult[]>;
    /** Start a new run of a workflow (by definition or registered id). */
    trigger: <PayloadT, OutputT>(workflow: WorkflowDefinition<PayloadT, OutputT> | string, input: unknown) => Promise<RunResult>;
}

const wakeAtOf = (pending: PendingSuspension | undefined): number | undefined => {
    if (pending?.kind === "sleep") {
        return pending.wakeAt;
    }

    if (pending?.kind === "event") {
        // Untimed waits have no wakeAt (undefined) and are therefore never swept — only signal() advances them.
        return pending.timeoutAt;
    }

    return undefined;
};

/**
 * Create a {@link WorkflowRuntime}.
 * @param options Optional store and pre-registered workflows.
 */
const createRuntime = (options: RuntimeOptions = {}): WorkflowRuntime => {
    const store: WorkflowStore = options.store ?? new MemoryStore();
    const leaseTtlMs = options.leaseTtlMs ?? 30_000;

    if (!Number.isFinite(leaseTtlMs) || leaseTtlMs <= 0) {
        throw new WorkflowError("invalid-option", `leaseTtlMs must be a positive, finite number. Received: ${String(leaseTtlMs)}.`);
    }

    const registry = new Map<string, AnyWorkflowDefinition>();

    for (const workflow of options.workflows ?? []) {
        registry.set(workflow.id, workflow);
    }

    // In-process per-run mutex: serialises overlapping resume/signal activations of the
    // same run within this runtime instance, so a step side effect is not executed twice
    // by e.g. two concurrent sweeps. NOTE: this does NOT span processes/instances —
    // cross-instance exactly-once requires a store-level lease (see README / roadmap).
    const runTails = new Map<string, Promise<unknown>>();

    const withRunLock = <T>(runId: string, function_: () => Promise<T>): Promise<T> => {
        const previous = runTails.get(runId) ?? Promise.resolve();
        const current = previous.then(function_, function_);
        const tail = current.then(
            () => undefined,
            () => undefined,
        );

        runTails.set(runId, tail);
        // Best-effort cleanup so the map does not grow unbounded across many distinct run ids.
        tail.finally(() => {
            if (runTails.get(runId) === tail) {
                runTails.delete(runId);
            }
        }).catch(() => undefined);

        return current;
    };

    const requireDefinition = (id: string): AnyWorkflowDefinition => {
        const definition = registry.get(id);

        if (!definition) {
            throw new WorkflowError("unknown-workflow", `No workflow registered with id "${id}". Register it on the runtime before resuming.`);
        }

        return definition;
    };

    const toResult = (runId: string, actor: RunActor): RunResult => {
        const snapshot = actor.getSnapshot();

        return {
            error: snapshot.context.error,
            output: snapshot.context.output,
            pending: snapshot.context.pending,
            runId,
            // `running` is transient and never observed here: drive() loops until the actor leaves it.
            status: snapshot.value as RunStatus,
        };
    };

    /** Drive a started actor sitting in `running` to its next terminal/suspended state. */
    const drive = async (runId: string, definition: AnyWorkflowDefinition, actor: RunActor): Promise<void> => {
        while (actor.getSnapshot().value === "running") {
            const { history, payload } = actor.getSnapshot().context;
            // eslint-disable-next-line no-await-in-loop -- the body is sequential by design; a run advances one activation at a time
            const outcome = await executeRun(definition, payload, runId, history);

            if (outcome.status === "suspended") {
                actor.send({ history: outcome.history, pending: outcome.pending, type: "SUSPEND" });
            } else if (outcome.status === "completed") {
                actor.send({ history: outcome.history, output: outcome.output, type: "COMPLETE" });
            } else {
                actor.send({ error: outcome.error, history: outcome.history, type: "FAIL" });
            }
        }
    };

    const persist = async (runId: string, definition: AnyWorkflowDefinition, actor: RunActor): Promise<void> => {
        const snapshot = actor.getSnapshot();
        const { pending } = snapshot.context;
        const stored: StoredRun = {
            definitionId: definition.id,
            eventName: pending?.kind === "event" ? pending.eventName : undefined,
            runId,
            snapshot: actor.getPersistedSnapshot(),
            // `running` is transient and never observed here: drive() loops until the actor leaves it.
            status: snapshot.value as RunStatus,
            updatedAt: Date.now(),
            wakeAt: wakeAtOf(pending),
        };

        await store.save(stored);
    };

    const restore = (stored: StoredRun): RunActor => {
        // `input` is ignored when a snapshot is supplied (the context comes from the
        // snapshot), but the actor-options type still requires it.
        const actor = createActor(runMachine, {
            input: { definitionId: stored.definitionId, history: [], payload: undefined },
            snapshot: stored.snapshot as Snapshot<unknown>,
        });

        actor.start();

        return actor;
    };

    const getRun = async (runId: string): Promise<RunInfo | undefined> => {
        const stored = await store.load(runId);

        if (!stored) {
            return undefined;
        }

        const actor = restore(stored);
        const snapshot = actor.getSnapshot();

        actor.stop();

        return {
            error: snapshot.context.error,
            history: snapshot.context.history,
            output: snapshot.context.output,
            pending: snapshot.context.pending,
            runId,
            status: stored.status,
        };
    };

    const register = (workflow: AnyWorkflowDefinition): void => {
        registry.set(workflow.id, workflow);
    };

    /** Read a run's current result without driving it (used when a lease is held elsewhere). */
    const readResult = async (runId: string): Promise<RunResult> => {
        const stored = await store.load(runId);

        if (!stored) {
            throw new RunNotFoundError(runId);
        }

        const actor = restore(stored);
        const result = toResult(runId, actor);

        actor.stop();

        return result;
    };

    /**
     * Run `body` under a cross-process lease (when the store supports one). If the
     * lease is held by another instance, `onContended` decides the outcome — by
     * default a passive read of the run's current state (intentional for `resume`,
     * which the next sweep retries). The in-process {@link withRunLock} still wraps
     * every call.
     */
    const withLease = async (
        runId: string,
        body: () => Promise<RunResult>,
        onContended: () => Promise<RunResult> = () => readResult(runId),
    ): Promise<RunResult> => {
        if (!store.acquire) {
            return body();
        }

        const token = generateRunId("lease");
        const acquired = await store.acquire(runId, token, leaseTtlMs);

        if (!acquired) {
            return onContended();
        }

        try {
            return await body();
        } finally {
            if (store.release) {
                // Best-effort: the lease TTL guarantees eventual expiry, so a transient release
                // failure must not supersede the (already committed) activation result.
                try {
                    await store.release(runId, token);
                } catch {
                    // Swallowed: the lease self-expires; failing here would mask the body's outcome.
                }
            }
        }
    };

    /** The critical section for advancing a due suspended/timed-out run (run under lock + lease). */
    const resumeRun = async (runId: string, now: number): Promise<RunResult> => {
        const stored = await store.load(runId);

        if (!stored) {
            throw new RunNotFoundError(runId);
        }

        const definition = requireDefinition(stored.definitionId);
        const actor = restore(stored);
        const snapshot = actor.getSnapshot();
        const { pending } = snapshot.context;

        if (snapshot.value === "suspended" && pending?.kind === "sleep" && pending.wakeAt <= now) {
            actor.send({ record: { id: pending.id, type: "sleep" }, type: "RESUME" });
        } else if (snapshot.value === "waiting" && pending?.kind === "event" && pending.timeoutAt !== undefined && pending.timeoutAt <= now) {
            // Only a *due* timed wait is advanced by resume; an untimed (or not-yet-due) wait is left for signal().
            actor.send({ record: { id: pending.id, timedOut: true, type: "event" }, type: "RESUME" });
        } else {
            actor.stop();

            return toResult(runId, actor);
        }

        await drive(runId, definition, actor);
        await persist(runId, definition, actor);

        const result = toResult(runId, actor);

        actor.stop();

        return result;
    };

    /** The critical section for delivering an external event (run under lock + lease). */
    const signalRun = async (runId: string, event: string, payload: unknown): Promise<RunResult> => {
        const stored = await store.load(runId);

        if (!stored) {
            throw new RunNotFoundError(runId);
        }

        const definition = requireDefinition(stored.definitionId);
        const actor = restore(stored);
        const snapshot = actor.getSnapshot();
        const { pending } = snapshot.context;

        if (snapshot.value !== "waiting" || pending?.kind !== "event" || pending.eventName !== event) {
            actor.stop();

            return toResult(runId, actor);
        }

        actor.send({ record: { id: pending.id, output: payload, type: "event" }, type: "RESUME" });

        await drive(runId, definition, actor);
        await persist(runId, definition, actor);

        const result = toResult(runId, actor);

        actor.stop();

        return result;
    };

    /** Advance a suspended/timed-out run that is due at `now`. Serialised per run, leased across processes. */
    const resumeAt = (runId: string, now: number): Promise<RunResult> => withRunLock(runId, () => withLease(runId, () => resumeRun(runId, now)));

    const resume = (runId: string): Promise<RunResult> => resumeAt(runId, Date.now());

    const signal = (runId: string, event: string, payload?: unknown): Promise<RunResult> =>
        withRunLock(runId, () =>
            withLease(runId, () => signalRun(runId, event, payload), () => {
                // A dropped signal is not retried by the sweep, so surface the contention instead of
                // returning a stale, misleading result the caller would mistake for successful delivery.
                throw new LeaseHeldError(runId);
            }));

    const sweep = async (now: number = Date.now(), limit = 100): Promise<RunResult[]> => {
        if (!Number.isInteger(limit) || limit <= 0) {
            throw new WorkflowError("invalid-option", `sweep limit must be a positive integer. Received: ${String(limit)}.`);
        }

        const due = await store.due(now, limit);
        const results: RunResult[] = [];

        for (const runId of due) {
            try {
                // eslint-disable-next-line no-await-in-loop -- resume mutates shared store state; process due runs sequentially
                results.push(await resumeAt(runId, now));
            } catch (error) {
                // A due id with no run document is a phantom wake-index entry (e.g. a crash between
                // save()'s index write and its run write): drop it from the wake index so it stops
                // resurfacing — and failing — on every future sweep.
                if (error instanceof RunNotFoundError) {
                    try {
                        // eslint-disable-next-line no-await-in-loop -- best-effort cleanup of the just-failed due id, kept in-order with the sweep
                        await store.delete(runId);
                    } catch {
                        // Swallowed: the cleanup is best-effort; a later sweep retries it.
                    }
                }

                // Isolate per-run failures: one poisoned run (e.g. an unregistered definition or a
                // row deleted mid-sweep) must not abort the loop and starve every later-due run.
                results.push({ error: serializeError(error), runId, status: "failed" });
            }
        }

        return results;
    };

    const trigger = async <PayloadT, OutputT>(workflow: WorkflowDefinition<PayloadT, OutputT> | string, input: unknown): Promise<RunResult> => {
        const definition = typeof workflow === "string" ? requireDefinition(workflow) : workflow;

        if (typeof workflow !== "string") {
            registry.set(definition.id, definition);
        }

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- parsePayload returns `any` from the type-erased registry; the public trigger() signature re-types it
        const payload = await definition.parsePayload(input);
        const runId = generateRunId(definition.id);
        const actor = createActor(runMachine, { input: { definitionId: definition.id, history: [], payload } });

        actor.start();

        await drive(runId, definition, actor);
        await persist(runId, definition, actor);

        const result = toResult(runId, actor);

        actor.stop();

        return result;
    };

    return { getRun, register, resume, signal, sweep, trigger };
};

export type { RunInfo, RunResult, RuntimeOptions, WorkflowRuntime };
export default createRuntime;
