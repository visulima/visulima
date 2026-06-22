import { describe, expect, it, vi } from "vitest";

import defineWorkflow from "../src/define-workflow";
import createRuntime from "../src/runtime";
import DurableObjectStore from "../src/store/durable-object-store";
import FakeDurableObjectStorage from "./_helpers/fake-durable-object";
import { runStoreContract } from "./_helpers/store-contract";

runStoreContract("DurableObjectStore", () => Promise.resolve({ store: new DurableObjectStore(new FakeDurableObjectStorage()) }));

describe("DurableObjectStore alarm scheduling", () => {
    it("arms the alarm at the earliest pending wake-at", async () => {
        expect.assertions(2);

        const storage = new FakeDurableObjectStorage();
        const store = new DurableObjectStore(storage);

        await store.save({ definitionId: "w", runId: "late", snapshot: {}, status: "suspended", updatedAt: 0, wakeAt: 5000 });

        await expect(storage.getAlarm()).resolves.toBe(5000);

        // A run due earlier moves the alarm earlier.
        await store.save({ definitionId: "w", runId: "early", snapshot: {}, status: "suspended", updatedAt: 0, wakeAt: 2000 });

        await expect(storage.getAlarm()).resolves.toBe(2000);
    });

    it("does not arm an alarm for a completed run", async () => {
        expect.assertions(1);

        const storage = new FakeDurableObjectStorage();
        const store = new DurableObjectStore(storage);

        await store.save({ definitionId: "w", runId: "done", snapshot: {}, status: "completed", updatedAt: 0 });

        await expect(storage.getAlarm()).resolves.toBeNull();
    });

    it("re-arms the alarm to the next pending wake when the earliest run is deleted", async () => {
        expect.assertions(2);

        const storage = new FakeDurableObjectStorage();
        const store = new DurableObjectStore(storage);

        await store.save({ definitionId: "w", runId: "early", snapshot: {}, status: "suspended", updatedAt: 0, wakeAt: 1000 });
        await store.save({ definitionId: "w", runId: "late", snapshot: {}, status: "suspended", updatedAt: 0, wakeAt: 5000 });

        await expect(storage.getAlarm()).resolves.toBe(1000);

        // Deleting the earliest-waking run must move the alarm forward to the next
        // pending wake; otherwise the stale 1000ms alarm fires, finds nothing due,
        // and never re-arms — orphaning the 5000ms wake.
        await store.delete("early");

        await expect(storage.getAlarm()).resolves.toBe(5000);
    });
});

describe("DurableObjectStore with a runtime (alarm-driven sweep)", () => {
    it("persists a sleeping run, arms the alarm, and resumes via sweep", async () => {
        expect.assertions(4);

        const storage = new FakeDurableObjectStorage();
        const store = new DurableObjectStore(storage);
        const sideEffect = vi.fn(() => "shipped");
        const workflow = defineWorkflow({
            id: "order",
            run: async (context) => {
                await context.sleep("settle", 1000);
                await context.step("ship", sideEffect);
            },
        });

        const runtime = createRuntime({ store, workflows: [workflow] });
        const triggered = await runtime.trigger(workflow, {});

        expect(triggered.status).toBe("suspended");

        // The store armed an alarm at the sleep's wake-at — that's how a DO would wake itself.
        const alarm = await storage.getAlarm();

        expect(alarm).not.toBeNull();

        // Simulate the DO's alarm() firing: sweep at (or after) the armed time.
        const [resumed] = await runtime.sweep((alarm ?? Date.now()) + 1);

        expect(resumed?.status).toBe("completed");
        expect(sideEffect).toHaveBeenCalledTimes(1);
    });

    it("does not drive a run whose lease is held by another holder", async () => {
        expect.assertions(2);

        const store = new DurableObjectStore(new FakeDurableObjectStorage());
        const sideEffect = vi.fn(() => "x");
        const workflow = defineWorkflow({
            id: "leased-do",
            run: async (context) => {
                await context.sleep("nap", 1000);
                await context.step("after", sideEffect);
            },
        });

        const runtime = createRuntime({ store, workflows: [workflow] });
        const triggered = await runtime.trigger(workflow, {});

        // Another holder claims the lease (the Durable Object's input gate makes acquire atomic in production).
        await store.acquire(triggered.runId, "other-holder", 60_000);

        const [result] = await runtime.sweep(Date.now() + 2000);

        expect(sideEffect).toHaveBeenCalledTimes(0);
        expect(result?.status).toBe("suspended");
    });
});
