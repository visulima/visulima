import type { StoredRun, WorkflowStore } from "./types";

/**
 * In-process {@link WorkflowStore}. Ideal for tests, single-instance apps and as
 * the default; swap for the unstorage adapter (or a custom one) for durability
 * across restarts and instances.
 */
class MemoryStore implements WorkflowStore {
    readonly #leases = new Map<string, { expiresAt: number; token: string }>();

    readonly #runs = new Map<string, StoredRun>();

    public acquire(runId: string, token: string, ttlMs: number): Promise<boolean> {
        const now = Date.now();
        const existing = this.#leases.get(runId);

        if (existing !== undefined && existing.expiresAt > now && existing.token !== token) {
            return Promise.resolve(false);
        }

        this.#leases.set(runId, { expiresAt: now + ttlMs, token });

        return Promise.resolve(true);
    }

    public release(runId: string, token: string): Promise<void> {
        if (this.#leases.get(runId)?.token === token) {
            this.#leases.delete(runId);
        }

        return Promise.resolve();
    }

    public save(run: StoredRun): Promise<void> {
        this.#runs.set(run.runId, structuredClone(run));

        return Promise.resolve();
    }

    public load(runId: string): Promise<StoredRun | undefined> {
        const run = this.#runs.get(runId);

        return Promise.resolve(run === undefined ? undefined : structuredClone(run));
    }

    public delete(runId: string): Promise<void> {
        this.#runs.delete(runId);

        return Promise.resolve();
    }

    public due(now: number, limit: number): Promise<string[]> {
        const due: { runId: string; wakeAt: number }[] = [];

        for (const run of this.#runs.values()) {
            if ((run.status === "suspended" || run.status === "waiting") && run.wakeAt !== undefined && run.wakeAt <= now) {
                due.push({ runId: run.runId, wakeAt: run.wakeAt });
            }
        }

        const ordered = due
            .toSorted((a, b) => a.wakeAt - b.wakeAt)
            .slice(0, limit)
            .map((entry) => entry.runId);

        return Promise.resolve(ordered);
    }
}

export default MemoryStore;
