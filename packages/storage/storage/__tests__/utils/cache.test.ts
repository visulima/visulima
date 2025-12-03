import { describe, expect, it } from "vitest";

import { NoOpCache } from "../../src/utils/cache";

describe("cache", () => {
    describe(NoOpCache, () => {
        it("should create NoOpCache instance", () => {
            expect.assertions(1);

            const cache = new NoOpCache();

            expect(cache).toBeInstanceOf(NoOpCache);
        });

        it("should return undefined for get", () => {
            expect.assertions(1);

            const cache = new NoOpCache();

            expect(cache.get("key")).toBeUndefined();
        });

        it("should return true for set", () => {
            expect.assertions(1);

            const cache = new NoOpCache();

            expect(cache.set("key", "value")).toBe(true);
        });

        it("should return true for set with options", () => {
            expect.assertions(1);

            const cache = new NoOpCache();

            expect(cache.set("key", "value", { ttl: 1000 })).toBe(true);
        });

        it("should return true for delete", () => {
            expect.assertions(1);

            const cache = new NoOpCache();

            expect(cache.delete("key")).toBe(true);
        });

        it("should return false for has", () => {
            expect.assertions(1);

            const cache = new NoOpCache();

            expect(cache.has("key")).toBe(false);
        });

        it("should not throw when calling clear", () => {
            expect.assertions(1);

            const cache = new NoOpCache();

            expect(() => cache.clear()).not.toThrow();
        });

        it("should handle multiple operations without side effects", () => {
            expect.assertions(4);

            const cache = new NoOpCache();

            cache.set("key1", "value1");
            cache.set("key2", "value2");

            expect(cache.get("key1")).toBeUndefined();
            expect(cache.get("key2")).toBeUndefined();
            expect(cache.has("key1")).toBe(false);
            expect(cache.has("key2")).toBe(false);
        });
    });
});
