import type { StoredRun, WorkflowStore } from "./types";

/**
 * Minimal structural view of an [unstorage](https://unstorage.unjs.io) instance.
 * Declared locally so the package needs no hard `unstorage` dependency.
 */
interface UnstorageLike {
    getItem: <T = unknown>(key: string) => Promise<T | null>;
    removeItem: (key: string) => Promise<void>;
    setItem: (key: string, value: unknown) => Promise<void>;
}

const RUN_PREFIX = "run:";
const LEASE_PREFIX = "lease:";
const DUE_INDEX_KEY = "wf:due-index";

interface Lease {
    expiresAt: number;
    token: string;
}

/**
 * {@link WorkflowStore} backed by [unstorage](https://unstorage.unjs.io), giving
 * durable, edge-friendly persistence over any unstorage driver (Cloudflare KV,
 * D1, Redis, filesystem, memory…).
 *
 * A single due-index document tracks wake-at times so `due` does not scan every
 * run. That index is rewritten with a read-modify-write, which is NOT atomic on a
 * plain KV driver: concurrent `save`s from multiple instances can clobber each
 * other and drop an entry, so a sleep could be missed (a missed wake-up, not a
 * double-run). For multi-writer / multi-instance deployments use a store with
 * atomic guarantees — `SqlStore` or `RedisStore` (whose due index is a Redis
 * sorted set). This store is best for single-writer or single-instance use.
 */
class UnstorageStore implements WorkflowStore {
    readonly #storage: UnstorageLike;

    public constructor(storage: UnstorageLike) {
        this.#storage = storage;
    }

    public async acquire(runId: string, token: string, ttlMs: number): Promise<boolean> {
        const now = Date.now();
        const found = await this.#storage.getItem<Lease>(LEASE_PREFIX + runId);
        const existing = found ?? undefined;

        if (existing !== undefined && existing.expiresAt > now && existing.token !== token) {
            return false;
        }

        // Best-effort: this read-check-write is NOT atomic, so two callers racing on a
        // non-CAS driver can both win. Use a store with atomic primitives (Redis/SQL/DO)
        // for race-free cross-process exclusion.
        await this.#storage.setItem(LEASE_PREFIX + runId, { expiresAt: now + ttlMs, token } satisfies Lease);

        return true;
    }

    public async release(runId: string, token: string): Promise<void> {
        const existing = await this.#storage.getItem<Lease>(LEASE_PREFIX + runId);

        if (existing?.token === token) {
            await this.#storage.removeItem(LEASE_PREFIX + runId);
        }
    }

    public async save(run: StoredRun): Promise<void> {
        // Update the wake index BEFORE the run, so a crash between the two writes at worst
        // yields a spurious wake (harmless — resume re-validates and no-ops) rather than a
        // lost wake-up (a sleep that never fires).
        const index = await this.#readIndex();

        if ((run.status === "suspended" || run.status === "waiting") && run.wakeAt !== undefined) {
            index[run.runId] = run.wakeAt;
        } else {
            // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- removing a run from the wake index by its dynamic id
            delete index[run.runId];
        }

        await this.#storage.setItem(DUE_INDEX_KEY, index);
        await this.#storage.setItem(RUN_PREFIX + run.runId, run);
    }

    public async load(runId: string): Promise<StoredRun | undefined> {
        const run = await this.#storage.getItem<StoredRun>(RUN_PREFIX + runId);

        return run ?? undefined;
    }

    public async delete(runId: string): Promise<void> {
        await this.#storage.removeItem(RUN_PREFIX + runId);
        await this.#storage.removeItem(LEASE_PREFIX + runId);

        const index = await this.#readIndex();

        if (runId in index) {
            // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- removing a run from the wake index by its dynamic id
            delete index[runId];
            await this.#storage.setItem(DUE_INDEX_KEY, index);
        }
    }

    public async due(now: number, limit: number): Promise<string[]> {
        const index = await this.#readIndex();

        return Object.entries(index)
            .filter(([, wakeAt]) => wakeAt <= now)
            .toSorted((a, b) => a[1] - b[1])
            .slice(0, limit)
            .map(([runId]) => runId);
    }

    async #readIndex(): Promise<Record<string, number>> {
        const index = await this.#storage.getItem<Record<string, number>>(DUE_INDEX_KEY);

        return index ?? {};
    }
}

export type { UnstorageLike };
export default UnstorageStore;
