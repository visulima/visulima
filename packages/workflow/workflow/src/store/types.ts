import type { RunStatus } from "../types";

/**
 * The persisted form of a run. `snapshot` is the opaque XState persisted
 * snapshot; `status`, `wakeAt` and `eventName` are denormalised so a store can
 * answer {@link WorkflowStore.due} and signal lookups without parsing it.
 */
export interface StoredRun {
    definitionId: string;
    /** For `waiting` runs: the event name the run is blocked on. */
    eventName?: string;
    runId: string;
    /** Opaque XState persisted snapshot (must be JSON-serialisable). */
    snapshot: unknown;
    status: RunStatus;
    updatedAt: number;
    /** For `suspended` (sleep) and timed `waiting` runs: the epoch ms to wake at. */
    wakeAt?: number;
}

/**
 * Durability contract for the engine. Implementations own persistence and the
 * "what is due" query; the engine stays storage-agnostic. The contract is
 * deliberately poll-based (`due`) so it works on plain KV/SQL, but is shaped so
 * a push-based adapter (e.g. Durable Object alarms) can implement `due` as a
 * no-op and schedule wake-ups in `save` instead.
 */
export interface WorkflowStore {
    /**
     * Optional cross-process lease. Atomically claim `runId` for `ttlMs`; returns
     * `true` if the caller now owns it, `false` if another (unexpired) holder does.
     *
     * The runtime always serialises activations *within a process*; implement this
     * to extend mutual exclusion *across* processes/instances on a shared store.
     * For that to be race-free the implementation must be atomic (Redis `SET NX`,
     * a SQL row lock, a Durable Object, …); plain read-check-write on a non-atomic
     * KV is best-effort only. Omit it entirely to rely on in-process locking alone.
     *
     * A lease gives mutual exclusion, NOT crash-proof exactly-once: a holder that
     * crashes between a side effect and its persisted record will re-run on the next
     * acquisition. Close that window with idempotent effects keyed on `runId:stepId`.
     */
    acquire?: (runId: string, token: string, ttlMs: number) => Promise<boolean>;
    /** Remove a run permanently. */
    delete: (runId: string) => Promise<void>;
    /** Run ids whose `wakeAt` is at or before `now`, up to `limit`. */
    due: (now: number, limit: number) => Promise<string[]>;
    /** Load a run, or `undefined` if unknown. */
    load: (runId: string) => Promise<StoredRun | undefined>;
    /** Release a lease previously taken with {@link WorkflowStore.acquire}; a no-op unless `token` owns it. */
    release?: (runId: string, token: string) => Promise<void>;
    /** Persist (insert or replace) a run. */
    save: (run: StoredRun) => Promise<void>;
}
