import type { Task, TaskResult } from "@visulima/task-runner";
import { describe, expect, it, vi } from "vitest";

import type { ServiceEntry } from "../../src/services/types";
import type { VisPlugin } from "../../src/util/hooks";
import { createVisHooks, HookableLifeCycle, registerPlugins } from "../../src/util/hooks";

const makeServiceEntry = (id: string): ServiceEntry => {
    return {
        command: "node server.js",
        config: { port: 5432 },
        cwd: "/tmp/workspace",
        env: { DB_URL: "postgres://localhost" },
        id,
        logFile: `/tmp/${id}.log`,
        pid: 12_345,
        slug: id.replaceAll(/[/:]/g, "_"),
        startedAt: new Date().toISOString(),
        visVersion: "1.0.0",
    };
};

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
                    await new Promise<void>((resolve) => {
                        setTimeout(resolve, 5);
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

    it("dispatches service:start, service:stop, and service:attach", async () => {
        expect.assertions(3);

        const hooks = createVisHooks();
        const start = vi.fn();
        const stop = vi.fn();
        const attach = vi.fn();

        await registerPlugins(hooks, [
            {
                hooks: {
                    "service:attach": attach,
                    "service:start": start,
                    "service:stop": stop,
                },
                name: "service-observer",
            },
        ]);

        const entry = makeServiceEntry("api:db");

        await hooks.callHook("service:start", entry);
        await hooks.callHook("service:stop", entry);
        await hooks.callHook("service:attach", entry, ["api:test", "api:web"]);

        expect(start).toHaveBeenCalledWith(entry);
        expect(stop).toHaveBeenCalledWith(entry);
        expect(attach).toHaveBeenCalledWith(entry, ["api:test", "api:web"]);
    });

    it("dispatches task:fingerprint with a contributor that mutates the hash bucket", async () => {
        expect.assertions(2);

        const hooks = createVisHooks();
        const seenContributions: { key: string; value: string }[] = [];

        await registerPlugins(hooks, [
            {
                hooks: {
                    "task:fingerprint": (_task, contributor) => {
                        contributor.contribute("plugin-version", "1.2.3");
                    },
                },
                name: "fingerprint-plugin",
            },
        ]);

        const stubContributor = {
            contribute: (key: string, value: string) => {
                seenContributions.push({ key, value });
            },
        };

        await hooks.callHook("task:fingerprint", makeTask("app:build"), stubContributor);

        expect(seenContributions).toHaveLength(1);
        expect(seenContributions[0]).toStrictEqual({ key: "plugin-version", value: "1.2.3" });
    });

    it("propagates task:fingerprint handler throws so the task fails before cache lookup", async () => {
        expect.assertions(1);

        const hooks = createVisHooks();

        await registerPlugins(hooks, [
            {
                hooks: {
                    "task:fingerprint": () => {
                        throw new Error("schema mismatch");
                    },
                },
                name: "abort-fingerprint",
            },
        ]);

        const stubContributor = { contribute: () => {} };

        await expect(hooks.callHook("task:fingerprint", makeTask("app:build"), stubContributor)).rejects.toThrow("schema mismatch");
    });

    it("dispatches task:retry with (task, attempt, prevExitCode)", async () => {
        expect.assertions(2);

        const hooks = createVisHooks();
        const retry = vi.fn();

        await registerPlugins(hooks, [
            {
                hooks: { "task:retry": retry },
                name: "retry-observer",
            },
        ]);

        const task = makeTask("app:build");

        await hooks.callHook("task:retry", task, 1, 137);

        expect(retry).toHaveBeenCalledTimes(1);
        expect(retry).toHaveBeenCalledWith(task, 1, 137);
    });

    it("propagates task:retry handler throws so the retry can be aborted", async () => {
        expect.assertions(1);

        const hooks = createVisHooks();

        await registerPlugins(hooks, [
            {
                hooks: {
                    "task:retry": () => {
                        throw new Error("budget exhausted");
                    },
                },
                name: "abort-retry",
            },
        ]);

        await expect(hooks.callHook("task:retry", makeTask("app:build"), 1, 1)).rejects.toThrow("budget exhausted");
    });

    it("awaits async service:start handlers before resolving callHook", async () => {
        expect.assertions(1);

        const hooks = createVisHooks();
        const order: string[] = [];

        await registerPlugins(hooks, [
            {
                hooks: {
                    "service:start": async () => {
                        await new Promise<void>((resolve) => {
                            setTimeout(resolve, 5);
                        });
                        order.push("plugin");
                    },
                },
                name: "slow",
            },
        ]);

        const callPromise = hooks.callHook("service:start", makeServiceEntry("api:db"));

        order.push("after-call");

        await callPromise;
        order.push("post-await");

        expect(order).toStrictEqual(["after-call", "plugin", "post-await"]);
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
