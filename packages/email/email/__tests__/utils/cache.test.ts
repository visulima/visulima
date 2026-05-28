import { describe, expect, it } from "vitest";

import { InMemoryCache } from "../../src/utils/cache";

describe("inMemoryCache", () => {
    it("stores and retrieves a value", async () => {
        expect.assertions(1);

        const cache = new InMemoryCache<{ value: number }>();

        await cache.set("a", { value: 1 }, 1000);

        await expect(cache.get("a")).resolves.toStrictEqual({ value: 1 });
    });

    it("returns undefined for a missing key", async () => {
        expect.assertions(1);

        const cache = new InMemoryCache<{ value: number }>();

        await expect(cache.get("missing")).resolves.toBeUndefined();
    });

    it("deletes an entry", async () => {
        expect.assertions(1);

        const cache = new InMemoryCache<{ value: number }>();

        await cache.set("a", { value: 1 }, 1000);
        await cache.delete("a");

        await expect(cache.get("a")).resolves.toBeUndefined();
    });

    it("clears all entries", async () => {
        expect.assertions(2);

        const cache = new InMemoryCache<{ value: number }>();

        await cache.set("a", { value: 1 }, 1000);
        await cache.set("b", { value: 2 }, 1000);
        await cache.clear();

        await expect(cache.get("a")).resolves.toBeUndefined();
        await expect(cache.get("b")).resolves.toBeUndefined();
    });

    it("evicts the oldest entry when the max size is exceeded", async () => {
        expect.assertions(2);

        const cache = new InMemoryCache<{ value: number }>({ max: 1 });

        await cache.set("a", { value: 1 }, 1000);
        await cache.set("b", { value: 2 }, 1000);

        await expect(cache.get("a")).resolves.toBeUndefined();
        await expect(cache.get("b")).resolves.toStrictEqual({ value: 2 });
    });
});
