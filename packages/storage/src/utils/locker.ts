import { LRUCache as Cache } from "lru-cache";

/**
 * A simple lock map keyed by strings, backed by LRUCache. Locks
 * automatically expire according to the configured TTL preventing deadlocks.
 */
class Locker<K extends string = string, V extends string = string> extends Cache<K, V, number> {
    /**
     * Creates a new Locker instance with configurable TTL and cache options.
     * @param options LRU cache configuration options
     */
    public constructor(options?: Cache.Options<K, V, number>) {
        super({
            ttl: 1000,
            ttlAutopurge: true,
            ...options,
        });
    }

    /**
     * Acquires a lock for the specified key.
     * Throws an error if the key is already locked.
     * @param key The key to lock
     * @returns The lock token (same as the key)
     * @throws Error if the key is already locked
     */
    public lock(key: K): string {
        const locked = this.get(key);

        if (locked) {
            throw new Error(`${key} is locked`);
        }

        this.set(key, key as unknown as V);

        return key;
    }

    /**
     * Releases the lock for the specified key.
     * @param key The key to unlock
     */
    public unlock(key: K): void {
        this.delete(key);
    }
}

export default Locker;
