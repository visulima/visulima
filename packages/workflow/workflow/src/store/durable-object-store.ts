import type { StoredRun, WorkflowStore } from "./types";

/**
 * The subset of [`DurableObjectStorage`](https://developers.cloudflare.com/durable-objects/api/storage-api/)
 * this store touches. Declared structurally so it needs no `@cloudflare/workers-types`
 * dependency and can be unit-tested with a plain object. `getAlarm`/`setAlarm`/
 * `deleteAlarm` are optional: when present, the store schedules a wake-up alarm so
 * `sweep` is driven by the runtime instead of an external cron (the push model),
 * and clears it once no wakes remain.
 */
interface DurableObjectStorageLike {
    delete: (key: string) => Promise<boolean>;
    deleteAlarm?: () => Promise<void>;
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

/**
 * Fixed-width zero-padding so `storage.list` (UTF-8 key order) yields wake keys
 * ascending by time. 16 digits holds every epoch-millisecond wake-at (13 digits
 * today, room until ~year 318000) AND `Number.MAX_SAFE_INTEGER` (16 digits), which
 * the store contract probes. Wake-at values with **more than 16 digits would break
 * key ordering** — keep wake-at in epoch-ms (the runtime's `resolveWakeAt` does).
 */
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
        // `list` returns keys ascending by wake-at (earliest first), so capping at
        // `limit` in the query yields the soonest-due runs without materialising the
        // whole wake-index — matching the SQL/Redis stores' bounded reads.
        const entries = await this.#storage.list<string>({ limit, prefix: WAKE_PREFIX });
        const due: string[] = [];

        for (const [key, runId] of entries) {
            if (wakeAtOf(key) > now) {
                break;
            }

            due.push(runId);
        }

        return due;
    }

    // Lease keys carry an `expiresAt` checked on acquire, so a stale lease is always
    // reclaimable; unlike Redis' native TTL the DO has no auto-expiry, so a key for a
    // run that crashes between acquire and release lingers until the run is re-driven
    // or `delete`d. Harmless (the DO's serial execution already guarantees exclusion),
    // just a slow accrual of dead keys in pathological crash loops.
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
        const current = this.#storage.getAlarm === undefined ? undefined : await this.#storage.getAlarm();

        if (next === undefined) {
            // No pending wakes: clear any leftover alarm so the DO doesn't wake spuriously.
            if (typeof current === "number" && this.#storage.deleteAlarm !== undefined) {
                await this.#storage.deleteAlarm();
            }

            return;
        }

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
