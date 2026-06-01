import { describe, expect, it } from "vitest";

import type { UrlStorageEntry } from "../../src/core/url-storage";
import { defaultUrlStorage, LocalStorageUrlStorage, MemoryUrlStorage } from "../../src/core/url-storage";

const makeEntry = (overrides: Partial<UrlStorageEntry> = {}): UrlStorageEntry => {
    return {
        createdAt: 1_700_000_000_000,
        endpoint: "http://localhost/api/upload",
        fingerprint: "tus::http://localhost/api/upload::test.bin::100::application/octet-stream::0",
        lastModified: 0,
        protocol: "tus",
        size: 100,
        uploadUrl: "http://localhost/api/upload/123",
        ...overrides,
    };
};

interface MemoryStore {
    getItem: (key: string) => string | null;
    key: (index: number) => string | null;
    readonly length: number;
    removeItem: (key: string) => void;
    setItem: (key: string, value: string) => void;
}

const createInMemoryLocalStorage = (): MemoryStore => {
    const map = new Map<string, string>();

    return {
        getItem: (key) => map.get(key) ?? null,
        key: (index) => [...map.keys()][index] ?? null,
        get length() {
            return map.size;
        },
        removeItem: (key) => {
            map.delete(key);
        },
        setItem: (key, value) => {
            map.set(key, value);
        },
    };
};

describe(MemoryUrlStorage, () => {
    it("round-trips a single entry by fingerprint", async () => {
        expect.assertions(3);

        const storage = new MemoryUrlStorage();
        const entry = makeEntry();

        await storage.addEntry(entry);

        await expect(storage.findEntry(entry.fingerprint)).resolves.toStrictEqual(entry);

        await storage.removeEntry(entry.fingerprint);

        await expect(storage.findEntry(entry.fingerprint)).resolves.toBeUndefined();
        await expect(storage.listEntries()).resolves.toStrictEqual([]);
    });

    it("returns undefined for a missing fingerprint", async () => {
        expect.assertions(1);

        const storage = new MemoryUrlStorage();

        await expect(storage.findEntry("does-not-exist")).resolves.toBeUndefined();
    });

    it("overwrites an existing entry with the same fingerprint", async () => {
        expect.assertions(1);

        const storage = new MemoryUrlStorage();
        const first = makeEntry({ uploadUrl: "http://localhost/api/upload/first" });
        const second = makeEntry({ uploadUrl: "http://localhost/api/upload/second" });

        await storage.addEntry(first);
        await storage.addEntry(second);

        const found = await storage.findEntry(first.fingerprint);

        expect(found?.uploadUrl).toBe("http://localhost/api/upload/second");
    });

    it("lists every entry that has been added", async () => {
        expect.assertions(2);

        const storage = new MemoryUrlStorage();
        const a = makeEntry({ fingerprint: "a", uploadUrl: "http://localhost/api/upload/a" });
        const b = makeEntry({ fingerprint: "b", uploadUrl: "http://localhost/api/upload/b" });

        await storage.addEntry(a);
        await storage.addEntry(b);

        const entries = await storage.listEntries();

        expect(entries).toHaveLength(2);
        expect(entries.map((entry) => entry.fingerprint).toSorted((first, second) => first.localeCompare(second))).toStrictEqual(["a", "b"]);
    });
});

describe(LocalStorageUrlStorage, () => {
    it("persists entries to the injected localStorage with the default prefix", async () => {
        expect.assertions(2);

        const ls = createInMemoryLocalStorage();
        const storage = new LocalStorageUrlStorage(ls);
        const entry = makeEntry();

        await storage.addEntry(entry);

        expect(ls.getItem(`visulima-upload::${entry.fingerprint}`)).toBe(JSON.stringify(entry));
        await expect(storage.findEntry(entry.fingerprint)).resolves.toStrictEqual(entry);
    });

    it("honours a custom prefix", async () => {
        expect.assertions(2);

        const ls = createInMemoryLocalStorage();
        const storage = new LocalStorageUrlStorage(ls, "my-app::");
        const entry = makeEntry();

        await storage.addEntry(entry);

        expect(ls.getItem(`my-app::${entry.fingerprint}`)).toBe(JSON.stringify(entry));
        expect(ls.getItem(`visulima-upload::${entry.fingerprint}`)).toBeNull();
    });

    it("ignores localStorage keys outside its prefix when listing", async () => {
        expect.assertions(1);

        const ls = createInMemoryLocalStorage();

        ls.setItem("unrelated-key", "ignore-me");
        ls.setItem("visulima-upload::also-bogus", "not-valid-json{");

        const storage = new LocalStorageUrlStorage(ls);
        const entry = makeEntry();

        await storage.addEntry(entry);

        const entries = await storage.listEntries();

        expect(entries).toStrictEqual([entry]);
    });

    it("drops a corrupted entry on read", async () => {
        expect.assertions(2);

        const ls = createInMemoryLocalStorage();

        ls.setItem("visulima-upload::corrupt", "{not json");

        const storage = new LocalStorageUrlStorage(ls);

        await expect(storage.findEntry("corrupt")).resolves.toBeUndefined();
        expect(ls.getItem("visulima-upload::corrupt")).toBeNull();
    });

    it("removes an entry by fingerprint", async () => {
        expect.assertions(1);

        const ls = createInMemoryLocalStorage();
        const storage = new LocalStorageUrlStorage(ls);
        const entry = makeEntry();

        await storage.addEntry(entry);
        await storage.removeEntry(entry.fingerprint);

        expect(ls.getItem(`visulima-upload::${entry.fingerprint}`)).toBeNull();
    });

    it("throws if no localStorage-like object is available", () => {
        expect.assertions(1);

        const originalLs = (globalThis as { localStorage?: unknown }).localStorage;

        delete (globalThis as { localStorage?: unknown }).localStorage;

        try {
            expect(() => new LocalStorageUrlStorage()).toThrow(/localStorage/);
        } finally {
            if (originalLs !== undefined) {
                (globalThis as { localStorage?: unknown }).localStorage = originalLs;
            }
        }
    });
});

describe(defaultUrlStorage, () => {
    it("returns a LocalStorageUrlStorage when localStorage is available", () => {
        expect.assertions(1);

        const original = (globalThis as { localStorage?: unknown }).localStorage;

        (globalThis as { localStorage?: unknown }).localStorage = createInMemoryLocalStorage();

        try {
            expect(defaultUrlStorage()).toBeInstanceOf(LocalStorageUrlStorage);
        } finally {
            if (original === undefined) {
                delete (globalThis as { localStorage?: unknown }).localStorage;
            } else {
                (globalThis as { localStorage?: unknown }).localStorage = original;
            }
        }
    });

    it("falls back to MemoryUrlStorage when localStorage is missing", () => {
        expect.assertions(1);

        const original = (globalThis as { localStorage?: unknown }).localStorage;

        delete (globalThis as { localStorage?: unknown }).localStorage;

        try {
            expect(defaultUrlStorage()).toBeInstanceOf(MemoryUrlStorage);
        } finally {
            if (original !== undefined) {
                (globalThis as { localStorage?: unknown }).localStorage = original;
            }
        }
    });
});
