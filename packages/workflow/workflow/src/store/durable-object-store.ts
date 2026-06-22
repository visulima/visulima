import type { StoredRun, WorkflowStore } from "./types";

/**
 * The subset of [`DurableObjectStorage`](https://developers.cloudflare.com/durable-objects/api/storage-api/)
 * this store touches. Declared structurally so it needs no `@cloudflare/workers-types`
 * dependency and can be unit-tested with a plain object. `getAlarm`/`setAlarm` are
 * optional: when present, the store schedules a wake-up alarm so `sweep` is driven
 * by the runtime instead of an external cron (the push model).
 */
interface DurableObjectStorageLike {
    delete: (key: string) => Promise<boolean>;
    get: <T = unknown>(key: string) => Promise<T | undefined>;
    getAlarm?: () => Promise<number | null>;
    list: <T = unknown>(options?: { limit?: number; prefix?: string }) => Promise<Map<string, T>>;
    put: (key: string, value: unknown) => Promise<void>;
    setAlarm?: (scheduledTime: number) => Promise<void>;
}

interface Lease {
    expiresAt: number;
    token: string;
}

const RUN_PREFIX = "run:";
const LEASE_PREFIX = "lease:";
const WAKE_PREFIX = "wake:";

/** Fixed-width so `storage.list` (UTF-8 key order) yields wake keys ascending by time. */
const WAKE_WIDTH = 16;

const wakeKey = (wakeAt: number, runId: string): string => `${WAKE_PREFIX}${String(wakeAt).padStart(WAKE_WIDTH, "0")}:${runId}`;

const wakeAtOf = (key: string): number => Number(key.slice(WAKE_PREFIX.length, WAKE_PREFIX.length + WAKE_WIDTH));

const isWakeable = (run: StoredRun): boolean => (run.status === "suspended" || run.status === "waiting") && run.wakeAt !== undefined;

/**
 * {@link WorkflowStore} backed by a Cloudflare Durable Object's storage. Because a
 * Durable Object processes requests **serially**, the lease (`acquire`/`release`)
 * is race-free by construction — the cleanest correct cross-process store.
 *
 * It keeps a wake-index (sorted keys) so `due` and the next-alarm time are cheap,
 * and, when the storage exposes `setAlarm`, schedules an alarm at the earliest
 * wake-at. Pair it with a Durable Object whose `alarm()` calls `runtime.sweep()`:
 *
 * ```ts
 * export class WorkflowDO {
 *     #runtime;
 *     constructor(state) {
 *         this.#runtime = createRuntime({ store: new DurableObjectStore(state.storage), workflows });
 *     }
 *     // fetch() routes trigger / signal calls into this.#runtime
 *     async alarm() {
 *         await this.#runtime.sweep(); // the store re-arms the next alarm on save
 *     }
 * }
 * ```
 */
class DurableObjectStore implements WorkflowStore {
    readonly #storage: DurableObjectStorageLike;

    public constructor(storage: DurableObjectStorageLike) {
        this.#storage = storage;
    }

    public async save(run: StoredRun): Promise<void> {
        const previous = await this.#storage.get<StoredRun>(RUN_PREFIX + run.runId);

        if (previous !== undefined && isWakeable(previous)) {
            await this.#storage.delete(wakeKey(previous.wakeAt as number, run.runId));
        }

        await this.#storage.put(RUN_PREFIX + run.runId, run);

        if (isWakeable(run)) {
            await this.#storage.put(wakeKey(run.wakeAt as number, run.runId), run.runId);
        }

        await this.#reschedule();
    }

    public async load(runId: string): Promise<StoredRun | undefined> {
        return this.#storage.get<StoredRun>(RUN_PREFIX + runId);
    }

    public async delete(runId: string): Promise<void> {
        const run = await this.#storage.get<StoredRun>(RUN_PREFIX + runId);

        await this.#storage.delete(RUN_PREFIX + runId);
        await this.#storage.delete(LEASE_PREFIX + runId);

        if (run !== undefined && isWakeable(run)) {
            await this.#storage.delete(wakeKey(run.wakeAt as number, runId));
        }

        await this.#reschedule();
    }

    public async due(now: number, limit: number): Promise<string[]> {
        const entries = await this.#storage.list<string>({ prefix: WAKE_PREFIX });
        const due: string[] = [];

        // `list` returns keys ascending by wake-at, so the earliest are first.
        for (const [key, runId] of entries) {
            if (wakeAtOf(key) > now || due.length >= limit) {
                break;
            }

            due.push(runId);
        }

        return due;
    }

    public async acquire(runId: string, token: string, ttlMs: number): Promise<boolean> {
        const now = Date.now();
        const existing = await this.#storage.get<Lease>(LEASE_PREFIX + runId);

        if (existing !== undefined && existing.expiresAt > now && existing.token !== token) {
            return false;
        }

        await this.#storage.put(LEASE_PREFIX + runId, { expiresAt: now + ttlMs, token } satisfies Lease);

        return true;
    }

    public async release(runId: string, token: string): Promise<void> {
        const existing = await this.#storage.get<Lease>(LEASE_PREFIX + runId);

        if (existing?.token === token) {
            await this.#storage.delete(LEASE_PREFIX + runId);
        }
    }

    /** Arm the alarm at the earliest pending wake-at, so the DO wakes itself to sweep. */
    async #reschedule(): Promise<void> {
        if (this.#storage.setAlarm === undefined) {
            return;
        }

        const next = await this.#nextWakeAt();

        if (next === undefined) {
            return;
        }

        const current = this.#storage.getAlarm === undefined ? undefined : await this.#storage.getAlarm();

        // Keep the alarm aligned with the actual earliest pending wake. It must be
        // able to move in BOTH directions: earlier when a sooner run is saved, and
        // later when the earliest run is deleted — otherwise a stale alarm fires
        // once, finds nothing due (so sweep never re-arms via save), and the
        // remaining later wake-ups are orphaned.
        if (current !== next) {
            await this.#storage.setAlarm(next);
        }
    }

    async #nextWakeAt(): Promise<number | undefined> {
        const entries = await this.#storage.list<string>({ limit: 1, prefix: WAKE_PREFIX });

        for (const key of entries.keys()) {
            return wakeAtOf(key);
        }

        return undefined;
    }
}

export type { DurableObjectStorageLike };
export default DurableObjectStore;
