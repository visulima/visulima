/**
 * @packageDocumentation
 * Lightweight lock registry built on an LRU cache to guard concurrent
 * operations using short‑lived string locks.
 */
import { LRUCache as Cache } from "lru-cache";

/**
 * A simple lock map keyed by strings, backed by {@link LRUCache}. Locks
 * automatically expire according to the configured TTL preventing deadlocks.
 */
class Locker<K extends string = string, V extends string = string> extends Cache<K, V, number> {
    public constructor(options?: Cache.Options<K, V, number>) {
        super({
            ttl: 1000,
            ttlAutopurge: true,
            ...options,
        });
    }

    public lock(key: K): string {
        const locked = this.get(key);

        if (locked) {
            throw new Error(`${key} is locked`);
        }

        this.set(key, key as unknown as V);

        return key;
    }

    public unlock(key: K): void {
        this.delete(key);
    }
}

export default Locker;
