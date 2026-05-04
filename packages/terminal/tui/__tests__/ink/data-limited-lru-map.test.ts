import { describe, expect, it } from "vitest";

import DataLimitedLruMap from "../../src/ink/data-limited-lru-map";

describe(DataLimitedLruMap, () => {
    it("should store and retrieve values", () => {
        expect.assertions(2);

        const map = new DataLimitedLruMap<number>(10, 1000);

        map.set("foo", 42);

        expect(map.get("foo")).toBe(42);
        expect(map.size).toBe(1);
    });

    it("should return undefined for missing keys", () => {
        expect.assertions(1);

        const map = new DataLimitedLruMap<number>(10, 1000);

        expect(map.get("missing")).toBeUndefined();
    });

    it("should evict LRU entries when max keys is reached", () => {
        expect.assertions(5);

        const map = new DataLimitedLruMap<number>(3, 10_000);

        map.set("a", 1);
        map.set("b", 2);
        map.set("c", 3);
        map.set("d", 4);

        expect(map.get("a")).toBeUndefined();
        expect(map.get("b")).toBe(2);
        expect(map.get("c")).toBe(3);
        expect(map.get("d")).toBe(4);
        expect(map.size).toBe(3);
    });

    it("should evict LRU entries when max data size is reached", () => {
        // maxDataSize = 6, keys "aa"(2), "bb"(2), "cc"(2) = 6 total
        expect.assertions(3);

        const map = new DataLimitedLruMap<number>(100, 6);

        map.set("aa", 1);
        map.set("bb", 2);
        map.set("cc", 3);

        // Adding "dd" (2 chars) requires evicting "aa" (2 chars)
        map.set("dd", 4);

        expect(map.get("aa")).toBeUndefined();
        expect(map.get("bb")).toBe(2);
        expect(map.size).toBe(3);
    });

    it("should promote accessed entries to most-recently-used", () => {
        expect.assertions(2);

        const map = new DataLimitedLruMap<number>(3, 10_000);

        map.set("a", 1);
        map.set("b", 2);
        map.set("c", 3);

        // Access "a" to promote it
        map.get("a");

        // Adding "d" should evict "b" (now LRU), not "a"
        map.set("d", 4);

        expect(map.get("a")).toBe(1);
        expect(map.get("b")).toBeUndefined();
    });

    it("should update value for existing key", () => {
        expect.assertions(2);

        const map = new DataLimitedLruMap<number>(10, 1000);

        map.set("key", 1);
        map.set("key", 2);

        expect(map.get("key")).toBe(2);
        expect(map.size).toBe(1);
    });

    it("should skip keys that exceed maxDataSize individually", () => {
        expect.assertions(2);

        const map = new DataLimitedLruMap<number>(10, 5);

        map.set("toolongkey", 1);

        expect(map.get("toolongkey")).toBeUndefined();
        expect(map.size).toBe(0);
    });

    it("should handle get() with has() check for falsy values", () => {
        expect.assertions(2);

        const map = new DataLimitedLruMap<number | null>(10, 1000);

        map.set("zero", 0);
        map.set("null", null);

        expect(map.get("zero")).toBe(0);
        expect(map.get("null")).toBeNull();
    });
});
