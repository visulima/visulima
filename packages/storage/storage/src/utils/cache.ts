/* eslint-disable class-methods-use-this */

/**
 * Simple cache interface that any cache implementation can follow
 */
export interface Cache<K = string, V = unknown> {
    /** Clear all cache entries */
    clear: () => void | Promise<void>;

    /** Delete a value from cache */
    delete: (key: K) => boolean | Promise<boolean>;

    /** Get a value from cache */
    get: (key: K) => V | undefined | Promise<V | undefined>;

    /** Check if a key exists in cache */
    has: (key: K) => boolean | Promise<boolean>;

    /** Set a value in cache */
    set: (key: K, value: V, options?: CacheOptions) => boolean | Promise<boolean>;
}

/**
 * Options for cache operations
 */
export interface CacheOptions {
    /** TTL in milliseconds */
    ttl?: number;
}

/**
 * No-op cache implementation that does nothing (used when caching is disabled)
 */
export class NoOpCache<K = string, V = unknown> implements Cache<K, V> {
    public get(): undefined {
        return undefined;
    }

    public set(): boolean {
        return true;
    }

    public delete(): boolean {
        return true;
    }

    public clear(): void {
        // Do nothing
    }

    public has(): boolean {
        return false;
    }
}
