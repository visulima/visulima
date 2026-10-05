import { afterEach, describe, expect, it, vi } from "vitest";

import { Files } from "../../src/files";
import MemoryStorage from "../../src/storage/memory/memory-storage";
import BaseTransformer from "../../src/transformer/base-transformer";
import type { BaseTransformerConfig } from "../../src/transformer/transformer-config";

/** Minimal transformer: upper-cases the original and caches through the base-class helpers. */
class UpperTransformer extends BaseTransformer<BaseTransformerConfig, { text: string }> {
    public runs = 0;

    public constructor(storage: MemoryStorage, config: BaseTransformerConfig) {
        super(storage, config);
    }

    public async transform(fileId: string): Promise<{ text: string }> {
        const cacheKey = await this.versionedCacheKey(fileId, `${fileId}:upper`);
        const cached = await this.getCached(cacheKey);

        if (cached) {
            return cached;
        }

        this.runs += 1;

        const original = await this.storage.get({ id: fileId });
        const result = { text: original.content.toString("utf8").toUpperCase() };

        await this.setCached(cacheKey, result);

        return result;
    }
}

describe("base transformer cache", () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    it("does not serve a stale transform after the original is replaced", async () => {
        expect.assertions(3);

        const storage = new MemoryStorage({ initial: { "a.txt": "first" } });
        const transformer = new UpperTransformer(storage, { cache: new Map() });

        await expect(transformer.transform("a.txt")).resolves.toStrictEqual({ text: "FIRST" });

        await new Files({ adapter: storage }).upload("a.txt", "second version");

        await expect(transformer.transform("a.txt")).resolves.toStrictEqual({ text: "SECOND VERSION" });
        expect(transformer.runs).toBe(2);
    });

    it("expires entries after cacheTtl even on a cache that ignores the ttl option", async () => {
        expect.assertions(2);

        vi.useFakeTimers();

        const storage = new MemoryStorage({ initial: { "a.txt": "x" } });
        const transformer = new UpperTransformer(storage, { cache: new Map(), cacheTtl: 60 });

        await transformer.transform("a.txt");
        await transformer.transform("a.txt");

        expect(transformer.runs).toBe(1);

        vi.advanceTimersByTime(61_000);

        await transformer.transform("a.txt");

        expect(transformer.runs).toBe(2);
    });

    it("evicts the oldest entries past maxCacheSize", async () => {
        expect.assertions(2);

        const cache = new Map();
        const storage = new MemoryStorage({ initial: { "a.txt": "a", "b.txt": "b", "c.txt": "c" } });
        const transformer = new UpperTransformer(storage, { cache, maxCacheSize: 2 });

        await transformer.transform("a.txt");
        await transformer.transform("b.txt");
        await transformer.transform("c.txt");

        expect(cache.size).toBe(2);
        expect([...cache.keys()].some((key: string) => key.startsWith("a.txt:"))).toBe(false);
    });
});
