/* eslint-disable vitest/require-hook -- parametrised store-contract suite invokes describe() via a factory */
import { createStorage } from "unstorage";
import { describe, expect, it } from "vitest";

import MemoryStore from "../src/store/memory-store";
import type { StoredRun, WorkflowStore } from "../src/store/types";
import UnstorageStore from "../src/store/unstorage-store";

const makeRun = (runId: string, overrides: Partial<StoredRun> = {}): StoredRun => {
    return {
        definitionId: "wf",
        runId,
        snapshot: { value: "suspended" },
        status: "suspended",
        updatedAt: 0,
        wakeAt: 1000,
        ...overrides,
    };
};

const runStoreContract = (name: string, makeStore: () => WorkflowStore): void => {
    describe(name, () => {
        it("saves and loads a run", async () => {
            expect.assertions(1);

            const store = makeStore();

            await store.save(makeRun("a"));

            await expect(store.load("a")).resolves.toMatchObject({ runId: "a", status: "suspended" });
        });

        it("returns undefined for an unknown run", async () => {
            expect.assertions(1);

            const store = makeStore();

            await expect(store.load("ghost")).resolves.toBeUndefined();
        });

        it("deletes a run", async () => {
            expect.assertions(1);

            const store = makeStore();

            await store.save(makeRun("a"));
            await store.delete("a");

            await expect(store.load("a")).resolves.toBeUndefined();
        });

        it("returns only runs that are due, sorted and limited", async () => {
            expect.assertions(2);

            const store = makeStore();

            await store.save(makeRun("late", { wakeAt: 3000 }));
            await store.save(makeRun("early", { wakeAt: 1000 }));
            await store.save(makeRun("mid", { wakeAt: 2000 }));

            await expect(store.due(2500, 10)).resolves.toStrictEqual(["early", "mid"]);
            await expect(store.due(5000, 1)).resolves.toStrictEqual(["early"]);
        });

        it("excludes completed runs and runs without a wake-at from due", async () => {
            expect.assertions(1);

            const store = makeStore();

            await store.save(makeRun("done", { status: "completed", wakeAt: undefined }));
            await store.save(makeRun("untimed", { status: "waiting", wakeAt: undefined }));

            await expect(store.due(Number.MAX_SAFE_INTEGER, 10)).resolves.toStrictEqual([]);
        });

        it("drops a run from the due set once it is no longer suspended", async () => {
            expect.assertions(1);

            const store = makeStore();

            await store.save(makeRun("a", { wakeAt: 1000 }));
            await store.save(makeRun("a", { status: "completed", wakeAt: undefined }));

            await expect(store.due(5000, 10)).resolves.toStrictEqual([]);
        });

        it("grants a lease and refuses a second holder until released", async () => {
            expect.assertions(3);

            const store = makeStore();

            await expect(store.acquire?.("a", "owner-1", 60_000)).resolves.toBe(true);
            await expect(store.acquire?.("a", "owner-2", 60_000)).resolves.toBe(false);

            await store.release?.("a", "owner-1");

            await expect(store.acquire?.("a", "owner-2", 60_000)).resolves.toBe(true);
        });

        it("re-acquires idempotently for the same token and ignores release by a non-owner", async () => {
            expect.assertions(2);

            const store = makeStore();

            await store.acquire?.("a", "owner-1", 60_000);

            await expect(store.acquire?.("a", "owner-1", 60_000)).resolves.toBe(true);

            await store.release?.("a", "someone-else");

            // owner-1 still holds it, so owner-2 is refused.
            await expect(store.acquire?.("a", "owner-2", 60_000)).resolves.toBe(false);
        });

        it("lets another holder acquire once the lease has expired", async () => {
            expect.assertions(2);

            const store = makeStore();

            // ttl in the past => already expired.
            await expect(store.acquire?.("a", "owner-1", -1)).resolves.toBe(true);
            await expect(store.acquire?.("a", "owner-2", 60_000)).resolves.toBe(true);
        });
    });
};

runStoreContract("MemoryStore", () => new MemoryStore());
runStoreContract("UnstorageStore", () => new UnstorageStore(createStorage()));
