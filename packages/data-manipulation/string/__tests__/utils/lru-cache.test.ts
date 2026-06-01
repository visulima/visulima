import { describe, expect, it } from "vitest";

import LRUCache from "../../src/utils/lru-cache";

describe(LRUCache, () => {
    it("stores and retrieves values via set/get/has", () => {
        expect.assertions(4);

        const cache = new LRUCache<string, number>(3);

        cache.set("a", 1);
        cache.set("b", 2);

        expect(cache.get("a")).toBe(1);
        expect(cache.get("b")).toBe(2);
        expect(cache.has("a")).toBe(true);
        expect(cache.has("missing")).toBe(false);
    });

    it("returns undefined for a missing key", () => {
        expect.assertions(1);

        const cache = new LRUCache<string, number>(2);

        expect(cache.get("missing")).toBeUndefined();
    });

    it("reports the current size and clears all entries", () => {
        expect.assertions(3);

        const cache = new LRUCache<string, number>(3);

        cache.set("a", 1);
        cache.set("b", 2);

        expect(cache.size()).toBe(2);

        cache.clear();

        expect(cache.size()).toBe(0);
        expect(cache.has("a")).toBe(false);
    });

    it("deletes a specific key without affecting others", () => {
        expect.assertions(3);

        const cache = new LRUCache<string, number>(3);

        cache.set("a", 1);
        cache.set("b", 2);
        cache.set("c", 3);

        cache.delete("b");

        expect(cache.has("b")).toBe(false);
        expect(cache.get("a")).toBe(1);
        expect(cache.get("c")).toBe(3);
    });

    it("evicts the least-recently-used entry when capacity is exceeded", () => {
        expect.assertions(4);

        const cache = new LRUCache<string, number>(2);

        cache.set("a", 1);
        cache.set("b", 2);
        // Touch "a" so "b" becomes LRU
        cache.get("a");

        // Insert "c" — capacity is 2 so "b" should be evicted
        cache.set("c", 3);

        expect(cache.has("a")).toBe(true);
        expect(cache.has("b")).toBe(false);
        expect(cache.has("c")).toBe(true);
        expect(cache.size()).toBe(2);
    });

    it("updates the recency on set when key already exists without evicting", () => {
        expect.assertions(3);

        const cache = new LRUCache<string, number>(2);

        cache.set("a", 1);
        cache.set("b", 2);
        // Re-set "a" with new value — should bump recency, not evict
        // eslint-disable-next-line sonarjs/no-element-overwrite -- intentional re-set to bump LRU recency before eviction
        cache.set("a", 10);
        // Now insert "c" — "b" was LRU so it goes
        cache.set("c", 3);

        expect(cache.get("a")).toBe(10);
        expect(cache.has("b")).toBe(false);
        expect(cache.has("c")).toBe(true);
    });
});
