import { LRUCache } from "lru-cache";

/**
 * Generic cache interface for caching any type of data.
 * Implementations can use in-memory cache, LRU cache, Redis, etc.
 */
interface Cache<T = unknown> {
    /**
     * Clears all cached entries.
     */
    clear: () => Promise<void>;

    /**
     * Deletes a cached entry.
     * @param key The cache key.
     */
    delete: (key: string) => Promise<void>;

    /**
     * Gets a cached value.
     * @param key The cache key.
     * @returns The cached value or undefined if not found or expired.
     */
    get: (key: string) => Promise<T | undefined>;

    /**
     * Sets a cached value.
     * @param key The cache key.
     * @param value The value to cache.
     * @param ttl Time-to-live in milliseconds.
     */
    set: (key: string, value: T, ttl: number) => Promise<void>;
}

/**
 * Options for creating an in-memory cache.
 */
interface InMemoryCacheOptions {
    /**
     * Maximum number of entries in the cache.
     * @default 500
     */
    max?: number;

    /**
     * Default TTL in milliseconds for entries.
     * @default 3600000 (1 hour)
     */
    ttl?: number;
}

/**
 * Default in-memory cache implementation using LRU cache.
 *
 * Shared by the MX and SMTP probes so repeated lookups against the same domain
 * (e.g. when verifying a list) avoid redundant DNS/socket work.
 */
class InMemoryCache<T extends object = Record<string, unknown>> implements Cache<T> {
    private readonly cache: LRUCache<string, T>;

    public constructor(options: InMemoryCacheOptions = {}) {
        const { max = 500, ttl = 3_600_000 } = options;

        this.cache = new LRUCache<string, T>({
            max,
            ttl,
        });
    }

    // eslint-disable-next-line @typescript-eslint/require-await
    public clear = async (): Promise<void> => {
        this.cache.clear();
    };

    // eslint-disable-next-line @typescript-eslint/require-await
    public delete = async (key: string): Promise<void> => {
        this.cache.delete(key);
    };

    // eslint-disable-next-line @typescript-eslint/require-await
    public get = async (key: string): Promise<T | undefined> => this.cache.get(key);

    // eslint-disable-next-line @typescript-eslint/require-await
    public set = async (key: string, value: T, ttl: number): Promise<void> => {
        this.cache.set(key, value, { ttl });
    };
}

export type { Cache, InMemoryCacheOptions };
export { InMemoryCache };
