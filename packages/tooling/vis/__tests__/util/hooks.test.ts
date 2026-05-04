import type { Task, TaskResult } from "@visulima/task-runner";
import { describe, expect, it, vi } from "vitest";

import type { VisPlugin } from "../../src/util/hooks";
import { createVisHooks, HookableLifeCycle, registerPlugins } from "../../src/util/hooks";

const makeTask = (id: string): Task => {
    return {
        id,
        outputs: [],
        overrides: {},
        target: { project: id.split(":")[0] ?? "app", target: id.split(":")[1] ?? "build" },
    };
};

const makeResult = (task: Task, status: TaskResult["status"] = "success"): TaskResult => {
    return {
        code: status === "failure" ? 1 : 0,
        endTime: Date.now(),
        startTime: Date.now() - 100,
        status,
        task,
        terminalOutput: "",
    };
};

describe(registerPlugins, () => {
    it("registers declarative hook handlers in plugin order", async () => {
        expect.assertions(1);

        const hooks = createVisHooks();
        const calls: string[] = [];

        const pluginA: VisPlugin = {
            hooks: {
                "task:before": () => {
                    calls.push("A");
                },
            },
            name: "a",
        };
        const pluginB: VisPlugin = {
            hooks: {
                "task:before": () => {
                    calls.push("B");
                },
            },
            name: "b",
        };

        await registerPlugins(hooks, [pluginA, pluginB]);
        await hooks.callHook("task:before", makeTask("app:build"));

        expect(calls).toStrictEqual(["A", "B"]);
    });

    it("awaits async setup in order", async () => {
        expect.assertions(1);

        const hooks = createVisHooks();
        const order: string[] = [];

        await registerPlugins(hooks, [
            {
                name: "slow",
                setup: async () => {
                    await new Promise<void>((r) => {
                        setTimeout(r, 5);
                    });
                    order.push("slow");
                },
            },
            {
                name: "fast",
                setup: () => {
                    order.push("fast");
                },
            },
        ]);

        expect(order).toStrictEqual(["slow", "fast"]);
    });

    it("accepts an array of handlers per hook name", async () => {
        expect.assertions(1);

        const hooks = createVisHooks();
        const calls: number[] = [];

        await registerPlugins(hooks, [
            {
                hooks: {
                    "task:before": [
                        () => {
                            calls.push(1);
                        },
                        () => {
                            calls.push(2);
                        },
                    ],
                },
                name: "multi",
            },
        ]);

        await hooks.callHook("task:before", makeTask("app:build"));

        expect(calls).toStrictEqual([1, 2]);
    });

    it("is a no-op for undefined or empty plugins", async () => {
        expect.assertions(2);

        const hooks = createVisHooks();

        await expect(registerPlugins(hooks, undefined)).resolves.toBeUndefined();
        await expect(registerPlugins(hooks, [])).resolves.toBeUndefined();
    });
});

describe(HookableLifeCycle, () => {
    it("emits task:before/after on startTasks/endTasks", () => {
        expect.assertions(2);

        const hooks = createVisHooks();
        const before = vi.fn();
        const after = vi.fn();

        hooks.hook("task:before", before);
        hooks.hook("task:after", after);

        const adapter = new HookableLifeCycle(hooks);
        const task = makeTask("app:build");

        adapter.startTasks([task]);
        adapter.endTasks([makeResult(task)]);

        expect(before).toHaveBeenCalledWith(task);
        expect(after).toHaveBeenCalledTimes(1);
    });

    it("emits task:cacheHit for cache statuses", () => {
        expect.assertions(2);

        const hooks = createVisHooks();
        const cacheHit = vi.fn();

        hooks.hook("task:cacheHit", cacheHit);

        const adapter = new HookableLifeCycle(hooks);
        const task = makeTask("app:build");

        adapter.endTasks([makeResult(task, "local-cache")]);

        expect(cacheHit).toHaveBeenCalledTimes(1);
        expect(cacheHit).toHaveBeenCalledWith(task, expect.objectContaining({ status: "local-cache" }));
    });

    it("emits task:failure on failure status", () => {
        expect.assertions(1);

        const hooks = createVisHooks();
        const failure = vi.fn();

        hooks.hook("task:failure", failure);

        const adapter = new HookableLifeCycle(hooks);
        const task = makeTask("app:build");

        adapter.endTasks([makeResult(task, "failure")]);

        expect(failure).toHaveBeenCalledTimes(1);
    });

    it("emits task:cacheMiss when printCacheMiss fires", () => {
        expect.assertions(1);

        const hooks = createVisHooks();
        const miss = vi.fn();

        hooks.hook("task:cacheMiss", miss);

        const adapter = new HookableLifeCycle(hooks);
        const task = makeTask("app:build");

        adapter.printCacheMiss(task, "src/index.ts changed");

        expect(miss).toHaveBeenCalledWith(task, "src/index.ts changed");
    });

    it("emits task:stdout / task:stderr for streaming chunks", async () => {
        expect.assertions(2);

        const hooks = createVisHooks();
        const stdoutHandler = vi.fn();
        const stderrHandler = vi.fn();

        hooks.hook("task:stdout", stdoutHandler);
        hooks.hook("task:stderr", stderrHandler);

        const adapter = new HookableLifeCycle(hooks);
        const task = makeTask("app:build");

        adapter.onTaskStdout(task, "line 1\n");
        adapter.onTaskStderr(task, "error 1\n");

        // Promise.resolve() pump — HookableLifeCycle fires and forgets
        await new Promise<void>((resolve) => {
            setTimeout(resolve, 0);
        });

        expect(stdoutHandler).toHaveBeenCalledWith(task, "line 1\n");
        expect(stderrHandler).toHaveBeenCalledWith(task, "error 1\n");
    });

    it("routes fire-and-forget hook failures through the per-instance onError handler", async () => {
        expect.assertions(3);

        const hooks = createVisHooks();

        hooks.hook("task:stdout", () => {
            throw new Error("boom from plugin");
        });

        const captured: { error: unknown; hook: string }[] = [];
        const adapter = new HookableLifeCycle(hooks, (hookName, error) => {
            captured.push({ error, hook: String(hookName) });
        });

        adapter.onTaskStdout(makeTask("app:build"), "chunk");

        // Flush the microtask queue so the fire-and-forget `.catch`
        // callback has a chance to run.
        await new Promise<void>((resolve) => {
            setTimeout(resolve, 0);
        });

        expect(captured).toHaveLength(1);
        expect(captured[0]?.hook).toBe("task:stdout");
        expect((captured[0]?.error as Error).message).toBe("boom from plugin");
    });
});
