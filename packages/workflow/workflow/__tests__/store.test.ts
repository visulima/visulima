import { createStorage } from "unstorage";
import { describe, expect, it } from "vitest";

import MemoryStore from "../src/store/memory-store";
import type { UnstorageLike } from "../src/store/unstorage-store";
import UnstorageStore from "../src/store/unstorage-store";
import { makeRun, runStoreContract } from "./_helpers/store-contract";

runStoreContract("MemoryStore", () => Promise.resolve({ store: new MemoryStore() }));
runStoreContract("UnstorageStore", () => Promise.resolve({ store: new UnstorageStore(createStorage()) }));

describe("store constructors", () => {
    it("creates a MemoryStore instance", () => {
        expect.assertions(1);

        expect(new MemoryStore()).toBeInstanceOf(MemoryStore);
    });
});

describe("UnstorageStore save ordering", () => {
    it("writes the run before the wake index when removing a wake (no lost wake on a crash)", async () => {
        expect.assertions(2);

        const storage = createStorage();
        let failIndexWrite = false;
        // Delegate to a real unstorage, but let the wake-index write crash while removing a wake.
        const wrapped: UnstorageLike = {
            getItem: (key) => storage.getItem(key),
            removeItem: (key) => storage.removeItem(key),
            setItem: (key, value) => {
                if (failIndexWrite && key === "wf:due-index") {
                    return Promise.reject(new Error("crash"));
                }

                return storage.setItem(key, value);
            },
        };
        const store = new UnstorageStore(wrapped);

        await store.save(makeRun("a", { wakeAt: 1000 }));

        failIndexWrite = true;

        await expect(store.save(makeRun("a", { status: "completed", wakeAt: undefined }))).rejects.toThrow("crash");
        // The run was written first, so it is durably completed rather than left as a still-suspended run
        // that a lost index entry would strand. (Verified via load below.)
        await expect(store.load("a")).resolves.toMatchObject({ status: "completed" });
    });
});
