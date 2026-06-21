import { describe, expect, it, vi } from "vitest";

import defineWorkflow from "../src/define-workflow";
import createRuntime from "../src/runtime";
import RedisStore from "../src/store/redis-store";
import FakeRedis from "./_helpers/fake-redis";
import { runStoreContract } from "./_helpers/store-contract";

runStoreContract("RedisStore (in-memory fake)", () => Promise.resolve({ store: new RedisStore(new FakeRedis()) }));

describe("RedisStore with a runtime", () => {
    it("persists a run and resumes it from a fresh runtime against the same Redis", async () => {
        expect.assertions(3);

        const redis = new FakeRedis();
        const store = new RedisStore(redis);
        const sideEffect = vi.fn(() => "sent");
        const workflow = defineWorkflow({
            id: "redis-flow",
            run: async (context) => {
                await context.sleep("wait", 1000);
                await context.step("notify", sideEffect);
            },
        });

        const first = createRuntime({ store, workflows: [workflow] });
        const triggered = await first.trigger(workflow, {});

        expect(triggered.status).toBe("suspended");

        const second = createRuntime({ store, workflows: [workflow] });
        const [resumed] = await second.sweep(Date.now() + 2000);

        expect(resumed?.status).toBe("completed");
        expect(sideEffect).toHaveBeenCalledTimes(1);
    });

    it("serialises two runtimes on the shared lease so a step runs exactly once", async () => {
        expect.assertions(1);

        const store = new RedisStore(new FakeRedis());
        const sideEffect = vi.fn(() => "x");
        const workflow = defineWorkflow({
            id: "redis-leased",
            run: async (context) => {
                await context.sleep("nap", 1000);
                await context.step("after", sideEffect);
            },
        });

        const a = createRuntime({ store, workflows: [workflow] });
        const b = createRuntime({ store, workflows: [workflow] });

        await a.trigger(workflow, {});

        const now = Date.now() + 2000;

        await Promise.all([a.sweep(now), b.sweep(now)]);

        expect(sideEffect).toHaveBeenCalledTimes(1);
    });
});
