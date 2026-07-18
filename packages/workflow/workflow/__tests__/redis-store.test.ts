import { describe, expect, it, vi } from "vitest";

import defineWorkflow from "../src/define-workflow";
import createRuntime from "../src/runtime";
import type { RedisLike } from "../src/store/redis-store";
import RedisStore from "../src/store/redis-store";
import FakeRedis from "./_helpers/fake-redis";
import { makeRun, runStoreContract } from "./_helpers/store-contract";

runStoreContract("RedisStore (in-memory fake)", () => Promise.resolve({ store: new RedisStore(new FakeRedis()) }));

describe("RedisStore save ordering", () => {
    it("writes the wake index before the run when adding a wake (no lost wake on a crash)", async () => {
        expect.assertions(2);

        const redis = new FakeRedis();
        let failSet = false;
        // Delegate to the faithful fake, but let a `set` crash after the wake index was written.
        const wrapped: RedisLike = {
            del: (...keys) => redis.del(...keys),
            eval: (script, numberOfKeys, ...arguments_) => redis.eval(script, numberOfKeys, ...arguments_),
            get: (key) => redis.get(key),
            set: (key, value, ...options) => {
                if (failSet) {
                    return Promise.reject(new Error("crash"));
                }

                return redis.set(key, value, ...options);
            },
            zadd: (key, score, member) => redis.zadd(key, score, member),
            zrangebyscore: (key, min, max, ...arguments_) => redis.zrangebyscore(key, min, max, ...arguments_),
            zrem: (key, ...members) => redis.zrem(key, ...members),
        };
        const store = new RedisStore(wrapped);

        failSet = true;

        await expect(store.save(makeRun("a", { wakeAt: 1000 }))).rejects.toThrow("crash");
        // The index write happened first, so the run is still discoverable by due(): the wake is not lost.
        await expect(store.due(5000, 10)).resolves.toStrictEqual(["a"]);
    });
});

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
