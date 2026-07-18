import { createStorage } from "unstorage";
import { beforeEach, describe, expect, it, vi } from "vitest";
// eslint-disable-next-line import/no-namespace -- the zod plugin mandates a namespace import for Zod v4
import * as z from "zod";

import defineWorkflow from "../src/define-workflow";
import { DuplicateStepIdError, LeaseHeldError, RunNotFoundError } from "../src/errors";
import createRuntime from "../src/runtime";
import MemoryStore from "../src/store/memory-store";
import type { WorkflowStore } from "../src/store/types";
import UnstorageStore from "../src/store/unstorage-store";

// "validation failed: " must be followed by a non-colon, non-space char (no leading colon for root errors).
const ROOT_ERROR_PATTERN = /failed: [^\s:]/;

describe(createRuntime, () => {
    it("runs a step-only workflow to completion", async () => {
        expect.assertions(3);

        const runtime = createRuntime();
        const workflow = defineWorkflow<{ name: string }, string>({
            id: "greet",
            run: async (context) => {
                const upper = await context.step("upper", () => context.payload.name.toUpperCase());

                return `hi ${upper}`;
            },
        });

        const result = await runtime.trigger(workflow, { name: "ada" });

        expect(result.status).toBe("completed");
        expect(result.output).toBe("hi ADA");
        expect(result.runId).toContain("greet:");
    });

    it("runs each step exactly once across a sleep/resume cycle (replay idempotency)", async () => {
        expect.assertions(5);

        const sideEffect = vi.fn(() => "done");
        const runtime = createRuntime();
        const workflow = defineWorkflow({
            id: "replay",
            run: async (context) => {
                await context.step("once", sideEffect);
                await context.sleep("nap", 1000);
                await context.step("after", () => "later");
            },
        });

        const triggered = await runtime.trigger(workflow, {});

        expect(triggered.status).toBe("suspended");
        expect(triggered.pending).toMatchObject({ kind: "sleep" });
        expect(sideEffect).toHaveBeenCalledTimes(1);

        const [resumed] = await runtime.sweep(Date.now() + 2000);

        expect(resumed?.status).toBe("completed");
        // The pre-sleep step must NOT have run again on replay.
        expect(sideEffect).toHaveBeenCalledTimes(1);
    });

    it("suspends on sleep and is picked up by sweep once due", async () => {
        expect.assertions(4);

        const runtime = createRuntime();
        const workflow = defineWorkflow({
            id: "sleeper",
            run: async (context) => {
                await context.sleep("wait", { amount: 1, unit: "hours" });

                return "awake";
            },
        });

        const triggered = await runtime.trigger(workflow, {});

        expect(triggered.status).toBe("suspended");

        // Not due yet.
        const none = await runtime.sweep(Date.now());

        expect(none).toHaveLength(0);

        // Far enough in the future to be due.
        const swept = await runtime.sweep(Date.now() + 3_600_001);

        expect(swept).toHaveLength(1);
        expect(swept[0]?.status).toBe("completed");
    });

    it("waits for an external event and resumes with its payload", async () => {
        expect.assertions(3);

        const runtime = createRuntime();
        const workflow = defineWorkflow<unknown, string>({
            id: "approval",
            run: async (context) => {
                const decision = await context.waitForEvent<{ ok: boolean }>("approved", "approval");

                return decision?.ok ? "approved" : "rejected";
            },
        });

        const triggered = await runtime.trigger(workflow, {});

        expect(triggered.status).toBe("waiting");

        const signaled = await runtime.signal(triggered.runId, "approval", { ok: true });

        expect(signaled.status).toBe("completed");
        expect(signaled.output).toBe("approved");
    });

    it("ignores a signal with the wrong event name", async () => {
        expect.assertions(2);

        const runtime = createRuntime();
        const workflow = defineWorkflow({
            id: "wrong-signal",
            run: async (context) => {
                await context.waitForEvent("wanted", "wanted-event");
            },
        });

        const triggered = await runtime.trigger(workflow, {});
        const result = await runtime.signal(triggered.runId, "other-event", {});

        expect(result.status).toBe("waiting");

        const info = await runtime.getRun(triggered.runId);

        expect(info?.status).toBe("waiting");
    });

    it("times out a wait via resume when a timeout was set", async () => {
        expect.assertions(2);

        const runtime = createRuntime();
        const workflow = defineWorkflow<unknown, string>({
            id: "wait-timeout",
            run: async (context) => {
                const value = await context.waitForEvent<string>("maybe", "maybe-event", { timeout: 5000 });

                return value ?? "timed-out";
            },
        });

        await runtime.trigger(workflow, {});

        const swept = await runtime.sweep(Date.now() + 5001);

        expect(swept[0]?.status).toBe("completed");
        expect(swept[0]?.output).toBe("timed-out");
    });

    it("marks the run failed when a step throws", async () => {
        expect.assertions(2);

        const runtime = createRuntime();
        const workflow = defineWorkflow({
            id: "boom",
            run: async (context) => {
                await context.step("explode", () => {
                    throw new Error("kaboom");
                });
            },
        });

        const result = await runtime.trigger(workflow, {});

        expect(result.status).toBe("failed");
        expect(result.error?.message).toBe("kaboom");
    });

    it("validates the payload against the Standard Schema", async () => {
        expect.assertions(1);

        const runtime = createRuntime();
        const workflow = defineWorkflow({
            id: "typed",
            payload: z.object({ count: z.number() }),
            run: () => undefined,
        });

        await expect(runtime.trigger(workflow, { count: "nope" })).rejects.toThrow("payload validation failed");
    });

    it("rejects duplicate step ids within a run", async () => {
        expect.assertions(2);

        const runtime = createRuntime();
        const workflow = defineWorkflow({
            id: "dupe",
            run: async (context) => {
                await context.step("same", () => 1);
                await context.step("same", () => 2);
            },
        });

        const result = await runtime.trigger(workflow, {});

        expect(result.status).toBe("failed");
        expect(result.error?.name).toBe(new DuplicateStepIdError("same").name);
    });

    it("throws when resuming an unknown run", async () => {
        expect.assertions(1);

        const runtime = createRuntime();

        await expect(runtime.resume("missing:123")).rejects.toBeInstanceOf(RunNotFoundError);
    });

    it("throws when triggering an unregistered workflow id", async () => {
        expect.assertions(1);

        const runtime = createRuntime();

        await expect(runtime.trigger("nope", {})).rejects.toThrow("No workflow registered");
    });

    it("rejects a non-positive leaseTtlMs", () => {
        expect.assertions(2);

        expect(() => createRuntime({ leaseTtlMs: 0 })).toThrow("leaseTtlMs");
        expect(() => createRuntime({ leaseTtlMs: Number.NaN })).toThrow("leaseTtlMs");
    });

    it("rejects a non-positive sweep limit", async () => {
        expect.assertions(2);

        const runtime = createRuntime();

        await expect(runtime.sweep(Date.now(), 0)).rejects.toThrow("sweep limit");
        await expect(runtime.sweep(Date.now(), 1.5)).rejects.toThrow("sweep limit");
    });

    it("formats a root-level payload error without a leading colon", async () => {
        expect.assertions(1);

        const runtime = createRuntime();
        const workflow = defineWorkflow({
            id: "root-error",
            payload: z.number(),
            run: () => undefined,
        });

        await expect(runtime.trigger(workflow, "not-a-number")).rejects.toThrow(ROOT_ERROR_PATTERN);
    });

    it("resumes a registered-by-id workflow after restart (new runtime, shared store)", async () => {
        expect.assertions(2);

        const store = new MemoryStore();
        const workflow = defineWorkflow<unknown, string>({
            id: "persisted",
            run: async (context) => {
                await context.sleep("nap", 1000);

                return "ok";
            },
        });

        const first = createRuntime({ store, workflows: [workflow] });
        const triggered = await first.trigger("persisted", {});

        expect(triggered.status).toBe("suspended");

        // Simulate a fresh process: new runtime, same store, re-registered workflow.
        const second = createRuntime({ store, workflows: [workflow] });
        const [resumed] = await second.sweep(Date.now() + 2000);

        expect(resumed?.status).toBe("completed");
    });

    it("does not advance a sleep before it is due (resume is due-gated)", async () => {
        expect.assertions(2);

        const runtime = createRuntime();
        const workflow = defineWorkflow<unknown, string>({
            id: "not-due",
            run: async (context) => {
                await context.sleep("nap", { amount: 1, unit: "hours" });

                return "awake";
            },
        });

        const triggered = await runtime.trigger(workflow, {});
        const resumed = await runtime.resume(triggered.runId);

        // Still suspended: the hour has not elapsed.
        expect(resumed.status).toBe("suspended");
        expect(resumed.output).toBeUndefined();
    });

    it("no-ops resume on an untimed wait (only signal advances it)", async () => {
        expect.assertions(1);

        const runtime = createRuntime();
        const workflow = defineWorkflow({
            id: "untimed-wait",
            run: async (context) => {
                await context.waitForEvent("ev", "go");
            },
        });

        const triggered = await runtime.trigger(workflow, {});
        const resumed = await runtime.resume(triggered.runId);

        expect(resumed.status).toBe("waiting");
    });

    it("ignores a signal to a run that is not waiting", async () => {
        expect.assertions(1);

        const runtime = createRuntime();
        const workflow = defineWorkflow<unknown, string>({
            id: "already-done",
            run: () => "done",
        });

        const triggered = await runtime.trigger(workflow, {});
        const result = await runtime.signal(triggered.runId, "whatever", {});

        expect(result.status).toBe("completed");
    });

    it("serialises concurrent resumes so a step runs exactly once", async () => {
        expect.assertions(2);

        const sideEffect = vi.fn(() => "x");
        const runtime = createRuntime();
        const workflow = defineWorkflow({
            id: "concurrent",
            run: async (context) => {
                await context.sleep("nap", 1000);
                await context.step("after", sideEffect);
            },
        });

        const triggered = await runtime.trigger(workflow, {});
        const now = Date.now() + 2000;

        // Two overlapping resumes of the same run must not double-execute the post-sleep step.
        const [a, b] = await Promise.all([runtime.resume(triggered.runId), runtime.sweep(now)]);

        expect(sideEffect).toHaveBeenCalledTimes(1);
        expect(a.status === "completed" || b[0]?.status === "completed").toBe(true);
    });

    it("does not drive a run whose lease is held by another instance", async () => {
        expect.assertions(2);

        const store = new MemoryStore();
        const sideEffect = vi.fn(() => "x");
        const workflow = defineWorkflow({
            id: "leased",
            run: async (context) => {
                await context.sleep("nap", 1000);
                await context.step("after", sideEffect);
            },
        });

        const runtime = createRuntime({ store, workflows: [workflow] });
        const triggered = await runtime.trigger(workflow, {});

        // Another instance grabs the lease and holds it.
        await store.acquire(triggered.runId, "other-instance", 60_000);

        const [result] = await runtime.sweep(Date.now() + 2000);

        // Lease refused => the post-sleep step never ran; the run stays suspended.
        expect(sideEffect).toHaveBeenCalledTimes(0);
        expect(result?.status).toBe("suspended");
    });

    it("returns undefined from getRun for an unknown run", async () => {
        expect.assertions(1);

        const runtime = createRuntime();

        await expect(runtime.getRun("nope:1")).resolves.toBeUndefined();
    });

    it("fails the run when a step throws a non-Error value", async () => {
        expect.assertions(2);

        const runtime = createRuntime();
        const workflow = defineWorkflow({
            id: "throw-string",
            run: async (context) => {
                await context.step("boom", () => {
                    // eslint-disable-next-line @typescript-eslint/only-throw-error -- intentionally testing a non-Error throw
                    throw "just a string";
                });
            },
        });

        const result = await runtime.trigger(workflow, {});

        expect(result.status).toBe("failed");
        expect(result.error?.message).toBe("just a string");
    });

    it("fails the run when an id is reused for a different step kind across replay", async () => {
        expect.assertions(2);

        const runtime = createRuntime();
        let firstPass = true;
        const workflow = defineWorkflow({
            id: "id-reuse",
            run: async (context) => {
                if (firstPass) {
                    firstPass = false;
                    await context.sleep("x", 1000);
                } else {
                    // On replay the recorded "x" is a sleep, now used as a step.
                    await context.step("x", () => 1);
                }
            },
        });

        const triggered = await runtime.trigger(workflow, {});

        expect(triggered.status).toBe("suspended");

        const [resumed] = await runtime.sweep(Date.now() + 2000);

        expect(resumed?.status).toBe("failed");
    });

    it("isolates a poisoned run in sweep so later-due runs still complete", async () => {
        expect.assertions(3);

        const store = new MemoryStore();
        const poison = defineWorkflow({
            id: "poison",
            run: async (context) => {
                await context.sleep("nap", 1000);
            },
        });
        const good = defineWorkflow<unknown, string>({
            id: "good",
            run: async (context) => {
                await context.sleep("nap", 5000);

                return "ok";
            },
        });

        const seeder = createRuntime({ store, workflows: [poison, good] });

        await seeder.trigger(poison, {});
        await seeder.trigger(good, {});

        // A fresh instance that never registered "poison": resuming it throws unknown-workflow. The
        // poisoned run sorts first by wake-at, so without isolation it would abort the whole sweep.
        const runtime = createRuntime({ store, workflows: [good] });
        const results = await runtime.sweep(Date.now() + 10_000);

        const poisonResult = results.find((result) => result.runId.startsWith("poison:"));
        const goodResult = results.find((result) => result.runId.startsWith("good:"));

        expect(results).toHaveLength(2);
        expect(poisonResult?.status).toBe("failed");
        expect(goodResult?.status).toBe("completed");
    });

    it("still resolves an activation when the store's release rejects", async () => {
        expect.assertions(2);

        const memory = new MemoryStore();
        // A store whose lease release fails transiently must not turn a committed activation into a rejection.
        const store: WorkflowStore = {
            acquire: (runId, token, ttlMs) => memory.acquire(runId, token, ttlMs),
            delete: (runId) => memory.delete(runId),
            due: (now, limit) => memory.due(now, limit),
            load: (runId) => memory.load(runId),
            release: () => Promise.reject(new Error("release blip")),
            save: (run) => memory.save(run),
        };
        const workflow = defineWorkflow<unknown, string>({
            id: "flaky-release",
            run: async (context) => {
                const value = await context.waitForEvent<string>("ev", "go");

                return value ?? "none";
            },
        });

        const runtime = createRuntime({ store, workflows: [workflow] });
        const triggered = await runtime.trigger(workflow, {});

        // signal() has no sweep-level try/catch, so a rejecting release would surface directly.
        const result = await runtime.signal(triggered.runId, "go", "delivered");

        expect(result.status).toBe("completed");
        expect(result.output).toBe("delivered");
    });

    it("throws LeaseHeldError when signalling a run whose lease is held by another instance", async () => {
        expect.assertions(1);

        const store = new MemoryStore();
        const workflow = defineWorkflow({
            id: "leased-signal",
            run: async (context) => {
                await context.waitForEvent("ev", "go");
            },
        });

        const runtime = createRuntime({ store, workflows: [workflow] });
        const triggered = await runtime.trigger(workflow, {});

        // Another instance holds the lease: delivering the event must not be silently dropped.
        await store.acquire(triggered.runId, "other-instance", 60_000);

        await expect(runtime.signal(triggered.runId, "go", { ok: true })).rejects.toBeInstanceOf(LeaseHeldError);
    });

    it("records a step's Date output as its JSON form identically across stores", async () => {
        expect.assertions(3);

        const when = new Date("2020-05-01T00:00:00.000Z");
        const makeWorkflow = (): ReturnType<typeof defineWorkflow<unknown, unknown>> =>
            defineWorkflow<unknown, unknown>({
                id: "date-step",
                run: (context) => context.step("when", () => when),
            });

        const memory = createRuntime({ store: new MemoryStore() });
        const unstorage = createRuntime({ store: new UnstorageStore(createStorage()) });

        const viaMemory = await memory.trigger(makeWorkflow(), {});
        const viaUnstorage = await unstorage.trigger(makeWorkflow(), {});

        // The default MemoryStore must not preserve a Date the durable stores would flatten to a string.
        expect(viaMemory.output).toBe(when.toISOString());
        expect(viaUnstorage.output).toBe(when.toISOString());
        expect(viaMemory.output).toStrictEqual(viaUnstorage.output);
    });
});

describe("createRuntime with UnstorageStore", () => {
    let runtime: ReturnType<typeof createRuntime>;

    beforeEach(() => {
        runtime = createRuntime({ store: new UnstorageStore(createStorage()) });
    });

    it("persists and resumes a run through unstorage (JSON round-trip safe)", async () => {
        expect.assertions(3);

        const workflow = defineWorkflow<{ id: number }, string>({
            id: "unstore",
            payload: z.object({ id: z.number() }),
            run: async (context) => {
                await context.step("a", () => context.payload.id * 2);
                await context.sleep("nap", 1000);
                const doubled = await context.step("b", () => "second");

                return doubled;
            },
        });

        const triggered = await runtime.trigger(workflow, { id: 21 });

        expect(triggered.status).toBe("suspended");

        const info = await runtime.getRun(triggered.runId);

        expect(info?.history.find((record) => record.id === "a")).toMatchObject({ output: 42 });

        const [resumed] = await runtime.sweep(Date.now() + 2000);

        expect(resumed?.status).toBe("completed");
    });
});
