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
 *
 * With `maxHoldMs`, a held lock is renewed before its TTL runs out, so a holder that outlasts the
 * TTL keeps it; renewal stops after `maxHoldMs`, so a hung holder loses the lock a TTL later.
 */
class Locker<K extends string = string> extends Cache<K, string, number> {
    private readonly maxHoldMs: number;

    /** Renewal timers of the held locks, by lock token. */
    private readonly renewals = new Map<string, ReturnType<typeof setInterval>>();

    public constructor({ maxHoldMs = 0, ...options }: Partial<Cache.Options<K, string, number>> & { maxHoldMs?: number } = {}) {
        super({
            ttl: 30_000,
            ttlAutopurge: true,
            ...options,
        });

        this.maxHoldMs = maxHoldMs;
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

        if (this.maxHoldMs > 0 && this.ttl > 0) {
            const lockedAt = Date.now();
            const renewal = setInterval(() => {
                // Also stops once the lock was released or taken over without the token.
                if (this.get(key) === token && Date.now() - lockedAt < this.maxHoldMs) {
                    this.set(key, token);
                } else {
                    this.stopRenewal(token);
                }
            }, this.ttl / 3);

            renewal.unref?.();
            this.renewals.set(token, renewal);
        }

        return token;
    }

    /**
     * Releases the lock for the specified key, but only if the token matches the current holder.
     * Silently no-ops when the lock has expired or is owned by someone else — releasing somebody
     * else's lock is worse than leaving a stale entry to TTL out on its own.
     * @returns true if the lock was released, false if it was already gone or owned by another caller.
     */
    public unlock(key: K, token: string): boolean {
        this.stopRenewal(token);

        if (this.get(key) !== token) {
            return false;
        }

        return this.delete(key);
    }

    private stopRenewal(token: string): void {
        clearInterval(this.renewals.get(token));
        this.renewals.delete(token);
    }
}

export default Locker;
