import { randomUUID } from "node:crypto";

import { LRUCache as Cache } from "lru-cache";

/**
 * A simple lock map keyed by strings, backed by LRUCache. Locks
 * automatically expire according to the configured TTL preventing deadlocks.
 *
 * Each successful `lock()` returns a unique token; the corresponding `unlock(key, token)`
 * call only releases the lock when the token matches the current holder. This prevents a
 * stale lock owner (e.g. one whose entry TTL'd out and was re-acquired by another caller)
 * from releasing another caller's lock by accident.
 */
class Locker<K extends string = string> extends Cache<K, string, number> {
    public constructor(options?: Cache.Options<K, string, number>) {
        super({
            ttl: 30_000,
            ttlAutopurge: true,
            ...options,
        });
    }

    /**
     * Acquires a lock for the specified key.
     * @returns A unique token identifying the lock holder.
     * @throws Error if the key is already locked.
     */
    public lock(key: K): string {
        if (this.get(key) !== undefined) {
            throw new Error(`${key} is locked`);
        }

        const token = randomUUID();

        this.set(key, token);

        return token;
    }

    /**
     * Releases the lock for the specified key, but only if the token matches the current holder.
     * Silently no-ops when the lock has expired or is owned by someone else — releasing somebody
     * else's lock is worse than leaving a stale entry to TTL out on its own.
     * @returns true if the lock was released, false if it was already gone or owned by another caller.
     */
    public unlock(key: K, token: string): boolean {
        if (this.get(key) !== token) {
            return false;
        }

        return this.delete(key);
    }
}

export default Locker;
