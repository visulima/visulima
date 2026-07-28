import type { RunStatus } from "../types";
import type { StoredRun, WorkflowStore } from "./types";

/**
 * Minimal structural view of a Redis client (e.g. [ioredis](https://github.com/redis/ioredis)).
 * Declared locally so the package needs no hard `ioredis` dependency.
 */
interface RedisLike {
    del: (...keys: string[]) => Promise<number>;
    eval: (script: string, numberOfKeys: number, ...args: (number | string)[]) => Promise<unknown>;
    get: (key: string) => Promise<string | null>;
    set: (key: string, value: string, ...options: (number | string)[]) => Promise<unknown>;
    zadd: (key: string, score: number, member: string) => Promise<unknown>;
    zrangebyscore: (key: string, min: number | string, max: number | string, ...args: (number | string)[]) => Promise<string[]>;
    zrem: (key: string, ...members: string[]) => Promise<unknown>;
}

/** Atomic claim: set the lease iff it is free or already ours (supports idempotent re-acquire and TTL expiry). */
const ACQUIRE_SCRIPT: string = [
    "local c=redis.call('GET',KEYS[1]);",
    "if c==false or c==ARGV[1] then redis.call('SET',KEYS[1],ARGV[1],'PX',ARGV[2]);return 1 end;",
    "return 0",
].join("");

/** Atomic release: delete the lease only if we still own it. */
const RELEASE_SCRIPT: string = ["if redis.call('GET',KEYS[1])==ARGV[1] then return redis.call('DEL',KEYS[1]) end;", "return 0"].join("");

/** Options for {@link RedisStore}. */
interface RedisStoreOptions {
    /** Key prefix for all keys this store writes. Defaults to `"wf:"`. */
    keyPrefix?: string;
}

const DUE_STATUSES = new Set<RunStatus>(["suspended", "waiting"]);

/**
 * {@link WorkflowStore} backed by Redis, with a genuinely-atomic cross-process
 * lease (Lua `acquire`/`release`) and a sorted-set wake index, making it safe for
 * multiple runtime instances against one shared Redis.
 *
 * Driver-agnostic — pass any client adapted to {@link RedisLike} (ioredis works
 * directly). Run state is stored as JSON strings; due runs are tracked in a
 * sorted set scored by wake-at.
 */
class RedisStore implements WorkflowStore {
    readonly #redis: RedisLike;

    readonly #runPrefix: string;

    readonly #leasePrefix: string;

    readonly #dueKey: string;

    public constructor(redis: RedisLike, options: RedisStoreOptions = {}) {
        const prefix = options.keyPrefix ?? "wf:";

        this.#redis = redis;
        this.#runPrefix = `${prefix}run:`;
        this.#leasePrefix = `${prefix}lease:`;
        this.#dueKey = `${prefix}due`;
    }

    public async save(run: StoredRun): Promise<void> {
        const serialized = JSON.stringify(run);

        // Order the two writes so a crash between them never loses a wake-up:
        //   - adding a wake: index BEFORE the run, so at worst a spurious wake (resume re-validates and no-ops);
        //   - removing a wake: run BEFORE the index, so a still-suspended run is never dropped from the index.
        if (DUE_STATUSES.has(run.status) && run.wakeAt !== undefined) {
            await this.#redis.zadd(this.#dueKey, run.wakeAt, run.runId);
            await this.#redis.set(this.#runPrefix + run.runId, serialized);
        } else {
            await this.#redis.set(this.#runPrefix + run.runId, serialized);
            await this.#redis.zrem(this.#dueKey, run.runId);
        }
    }

    public async load(runId: string): Promise<StoredRun | undefined> {
        const raw = await this.#redis.get(this.#runPrefix + runId);

        return raw === null ? undefined : (JSON.parse(raw) as StoredRun);
    }

    public async delete(runId: string): Promise<void> {
        await this.#redis.del(this.#runPrefix + runId, this.#leasePrefix + runId);
        await this.#redis.zrem(this.#dueKey, runId);
    }

    public async due(now: number, limit: number): Promise<string[]> {
        return this.#redis.zrangebyscore(this.#dueKey, "-inf", now, "LIMIT", 0, limit);
    }

    public async acquire(runId: string, token: string, ttlMs: number): Promise<boolean> {
        const result = await this.#redis.eval(ACQUIRE_SCRIPT, 1, this.#leasePrefix + runId, token, ttlMs);

        // Lua returns the integer 1, but drivers vary (number, "1", Buffer); coerce defensively.
        return Number(result) === 1;
    }

    public async release(runId: string, token: string): Promise<void> {
        await this.#redis.eval(RELEASE_SCRIPT, 1, this.#leasePrefix + runId, token);
    }
}

export { ACQUIRE_SCRIPT, type RedisLike, type RedisStoreOptions, RELEASE_SCRIPT };
export default RedisStore;
