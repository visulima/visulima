import { bench, describe } from "vitest";

import LRUCache from "../src/utils/lru-cache";

/**
 * Previous O(n) implementation that maintained a separate `keyOrder` array and
 * rebuilt it via Array.prototype.filter on every get/set. Kept here only to
 * contrast against the current Map-insertion-order implementation so the speedup
 * is measurable.
 */
class LegacyLRUCache<K, V> {
    private readonly capacity: number;

    private readonly cache: Map<K, V>;

    private keyOrder: K[];

    public constructor(capacity: number) {
        this.capacity = capacity;
        this.cache = new Map<K, V>();
        this.keyOrder = [];
    }

    public get(key: K): V | undefined {
        if (!this.cache.has(key)) {
            return undefined;
        }

        this.keyOrder = this.keyOrder.filter((k) => k !== key);
        this.keyOrder.push(key);

        return this.cache.get(key);
    }

    public has(key: K): boolean {
        return this.cache.has(key);
    }

    public set(key: K, value: V): void {
        if (this.cache.has(key)) {
            this.keyOrder = this.keyOrder.filter((k) => k !== key);
        } else if (this.cache.size >= this.capacity) {
            const lruKey = this.keyOrder.shift();

            if (lruKey !== undefined) {
                this.cache.delete(lruKey);
            }
        }

        this.cache.set(key, value);
        this.keyOrder.push(key);
    }
}

const CAPACITY = 1000;
const keys = Array.from({ length: CAPACITY }, (_, index) => `key-${index}`);

const seed = <T extends { set: (k: string, v: number) => void }>(cache: T): T => {
    for (let index = 0; index < CAPACITY; index += 1) {
        cache.set(keys[index] as string, index);
    }

    return cache;
};

describe("LRUCache - hot-path get/set (Map order vs keyOrder.filter)", () => {
    bench.skipIf(process.env.CODSPEED_ENV)("current (Map insertion order) - mixed get/set", () => {
        const cache = seed(new LRUCache<string, number>(CAPACITY));

        for (let round = 0; round < 5; round += 1) {
            for (let index = 0; index < CAPACITY; index += 1) {
                cache.get(keys[index] as string);
                cache.set(keys[index] as string, index + round);
            }
        }
    });

    bench.skipIf(process.env.CODSPEED_ENV)("legacy (keyOrder.filter O(n)) - mixed get/set", () => {
        const cache = seed(new LegacyLRUCache<string, number>(CAPACITY));

        for (let round = 0; round < 5; round += 1) {
            for (let index = 0; index < CAPACITY; index += 1) {
                cache.get(keys[index] as string);
                cache.set(keys[index] as string, index + round);
            }
        }
    });

    bench.skipIf(process.env.CODSPEED_ENV)("current (Map insertion order) - eviction churn", () => {
        const cache = new LRUCache<string, number>(CAPACITY);

        for (let index = 0; index < CAPACITY * 4; index += 1) {
            cache.set(`churn-${index}`, index);
        }
    });

    bench.skipIf(process.env.CODSPEED_ENV)("legacy (keyOrder.filter O(n)) - eviction churn", () => {
        const cache = new LegacyLRUCache<string, number>(CAPACITY);

        for (let index = 0; index < CAPACITY * 4; index += 1) {
            cache.set(`churn-${index}`, index);
        }
    });
});
