import type { Task, TaskGraph } from "@visulima/task-runner";
import { describe, expect, it } from "vitest";

import { applyServiceRegistry } from "../../../src/commands/run/apply-service-registry";
import type { ServiceEntry } from "../../../src/services/types";
import type { VisTargetOptions } from "../../../src/task/target-options";

const VIS_VERSION = "0.0.0-test";

const buildTask = (id: string, options?: VisTargetOptions): Task => {
    return {
        cache: false,
        id,
        outputs: [],
        overrides: {
            command: `echo ${id}`,
            ...(options ? { visOptions: options } : {}),
        },
        target: { project: id.split(":")[0]!, target: id.split(":")[1]! },
    };
};

const buildEntry = (id: string, overrides: Partial<ServiceEntry> = {}): ServiceEntry => {
    return {
        command: `echo ${id}`,
        config: {},
        cwd: "/tmp",
        env: { DB_URL: "postgres://attached" },
        id,
        logFile: `/tmp/${id}.log`,
        pid: process.pid,
        slug: id.replaceAll(":", "__"),
        startedAt: new Date().toISOString(),
        visVersion: VIS_VERSION,
        ...overrides,
    };
};

describe(applyServiceRegistry, () => {
    it("prunes a satisfied service from the graph and threads its env to the dependent", async () => {
        expect.assertions(6);

        const dbTask = buildTask("api:db", { service: { port: 5432 } });
        const testTask = buildTask("api:test");
        const taskGraph: TaskGraph = {
            dependencies: { "api:db": [], "api:test": ["api:db"] },
            roots: ["api:test"],
            tasks: { "api:db": dbTask, "api:test": testTask },
        };

        const result = await applyServiceRegistry({
            initialTasks: [testTask],
            registeredEntries: [buildEntry("api:db")],
            taskGraph,
            visVersion: VIS_VERSION,
        });

        expect(result.diagnostics).toEqual([]);
        expect(result.taskGraph.tasks["api:db"]).toBeUndefined();
        expect(result.taskGraph.tasks["api:test"]).toBeDefined();
        expect(result.taskGraph.dependencies["api:test"]).toEqual([]);
        expect(result.satisfiedServices.map((s) => s.id)).toEqual(["api:db"]);
        expect(result.serviceEnvByTaskId.get("api:test")).toEqual({ DB_URL: "postgres://attached" });
    });

    it("emits a diagnostic when a service dep is missing and not user-invoked", async () => {
        expect.assertions(3);

        const dbTask = buildTask("api:db", { service: { port: 5432 } });
        const testTask = buildTask("api:test");
        const taskGraph: TaskGraph = {
            dependencies: { "api:db": [], "api:test": ["api:db"] },
            roots: ["api:test"],
            tasks: { "api:db": dbTask, "api:test": testTask },
        };

        const result = await applyServiceRegistry({
            initialTasks: [testTask],
            registeredEntries: [],
            taskGraph,
            visVersion: VIS_VERSION,
        });

        expect(result.diagnostics).toHaveLength(1);
        expect(result.diagnostics[0]?.targetId).toBe("api:db");
        expect(result.diagnostics[0]?.message).toMatch(/vis service start api:db/);
    });

    it("falls through silently when the user invoked the service directly with no entry", async () => {
        expect.assertions(3);

        const dbTask = buildTask("api:db", { service: { port: 5432 } });
        const taskGraph: TaskGraph = {
            dependencies: { "api:db": [] },
            roots: ["api:db"],
            tasks: { "api:db": dbTask },
        };

        const result = await applyServiceRegistry({
            initialTasks: [dbTask],
            registeredEntries: [],
            taskGraph,
            visVersion: VIS_VERSION,
        });

        expect(result.diagnostics).toEqual([]);
        expect(result.taskGraph.tasks["api:db"]).toBeDefined();
        expect(result.initialTasks).toHaveLength(1);
    });

    it("treats version-mismatched entries as stale and emits a restart hint", async () => {
        expect.assertions(2);

        const dbTask = buildTask("api:db", { service: { port: 5432 } });
        const testTask = buildTask("api:test");
        const taskGraph: TaskGraph = {
            dependencies: { "api:db": [], "api:test": ["api:db"] },
            roots: ["api:test"],
            tasks: { "api:db": dbTask, "api:test": testTask },
        };

        const result = await applyServiceRegistry({
            initialTasks: [testTask],
            registeredEntries: [buildEntry("api:db", { visVersion: "9.9.9-other" })],
            taskGraph,
            visVersion: VIS_VERSION,
        });

        expect(result.diagnostics).toHaveLength(1);
        expect(result.diagnostics[0]?.message).toMatch(/vis service restart api:db/);
    });

    it("ignores dead PIDs from the registry", async () => {
        expect.assertions(1);

        const dbTask = buildTask("api:db", { service: { port: 5432 } });
        const testTask = buildTask("api:test");
        const taskGraph: TaskGraph = {
            dependencies: { "api:db": [], "api:test": ["api:db"] },
            roots: ["api:test"],
            tasks: { "api:db": dbTask, "api:test": testTask },
        };

        const result = await applyServiceRegistry({
            initialTasks: [testTask],
            registeredEntries: [buildEntry("api:db", { pid: 99_999_999 })],
            taskGraph,
            visVersion: VIS_VERSION,
        });

        // Dead entry → not satisfied → diagnostic, same as no entry at all.
        expect(result.diagnostics).toHaveLength(1);
    });

    it("returns input unchanged when no service tasks are present", async () => {
        expect.assertions(3);

        const buildTaskNoService = buildTask("api:test");
        const taskGraph: TaskGraph = {
            dependencies: { "api:test": [] },
            roots: ["api:test"],
            tasks: { "api:test": buildTaskNoService },
        };

        const result = await applyServiceRegistry({
            initialTasks: [buildTaskNoService],
            registeredEntries: [],
            taskGraph,
            visVersion: VIS_VERSION,
        });

        expect(result.diagnostics).toEqual([]);
        expect(result.taskGraph).toBe(taskGraph);
        expect(result.serviceEnvByTaskId.size).toBe(0);
    });

    it("promotes orphaned upstream tasks to roots when the only dependent was a satisfied service", async () => {
        expect.assertions(3);

        // setup → db (service, satisfied) → test
        // After pruning db, setup has no remaining dependent. It used to
        // only feed the satisfied service, so it must become a new root
        // rather than being stranded off the root list.
        const setupTask = buildTask("api:setup");
        const dbTask = buildTask("api:db", { service: { port: 5432 } });
        const testTask = buildTask("api:test");
        const taskGraph: TaskGraph = {
            dependencies: {
                "api:db": ["api:setup"],
                "api:setup": [],
                "api:test": ["api:db"],
            },
            roots: ["api:test"],
            tasks: { "api:db": dbTask, "api:setup": setupTask, "api:test": testTask },
        };

        const result = await applyServiceRegistry({
            initialTasks: [testTask],
            registeredEntries: [buildEntry("api:db")],
            taskGraph,
            visVersion: VIS_VERSION,
        });

        expect(result.taskGraph.roots).toContain("api:test");
        expect(result.taskGraph.roots).toContain("api:setup");
        expect(result.taskGraph.tasks["api:db"]).toBeUndefined();
    });

    it("merges env from multiple satisfied service deps into the same dependent", async () => {
        expect.assertions(1);

        const dbTask = buildTask("api:db", { service: { port: 5432 } });
        const cacheTask = buildTask("api:cache", { service: { port: 6379 } });
        const testTask = buildTask("api:test");
        const taskGraph: TaskGraph = {
            dependencies: {
                "api:cache": [],
                "api:db": [],
                "api:test": ["api:db", "api:cache"],
            },
            roots: ["api:test"],
            tasks: { "api:cache": cacheTask, "api:db": dbTask, "api:test": testTask },
        };

        const result = await applyServiceRegistry({
            initialTasks: [testTask],
            registeredEntries: [
                buildEntry("api:db", { env: { DB_URL: "postgres://attached" } }),
                buildEntry("api:cache", { env: { REDIS_URL: "redis://attached" } }),
            ],
            taskGraph,
            visVersion: VIS_VERSION,
        });

        expect(result.serviceEnvByTaskId.get("api:test")).toEqual({
            DB_URL: "postgres://attached",
            REDIS_URL: "redis://attached",
        });
    });

    it("does not mutate the input task graph", async () => {
        expect.assertions(2);

        const dbTask = buildTask("api:db", { service: { port: 5432 } });
        const testTask = buildTask("api:test");
        const dependencies = { "api:db": [], "api:test": ["api:db"] };
        const tasks = { "api:db": dbTask, "api:test": testTask };
        const taskGraph: TaskGraph = {
            dependencies,
            roots: ["api:test"],
            tasks,
        };

        await applyServiceRegistry({
            initialTasks: [testTask],
            registeredEntries: [buildEntry("api:db")],
            taskGraph,
            visVersion: VIS_VERSION,
        });

        // Originals untouched.
        expect(taskGraph.dependencies["api:test"]).toEqual(["api:db"]);
        expect(taskGraph.tasks["api:db"]).toBeDefined();
    });

    it("propagates service env transitively across pruned intermediate tasks", async () => {
        expect.assertions(2);

        // chain → middle → db (service, satisfied)
        // After pruning db, the chain task no longer has a direct edge
        // to db (or to middle's transitive db dep), but it still needs
        // db's env at runtime — the executor walks the post-prune graph.
        const dbTask = buildTask("api:db", { service: { port: 5432 } });
        const middleTask = buildTask("api:middle");
        const chainTask = buildTask("api:chain");
        const taskGraph: TaskGraph = {
            dependencies: {
                "api:chain": ["api:middle"],
                "api:db": [],
                "api:middle": ["api:db"],
            },
            roots: ["api:chain"],
            tasks: {
                "api:chain": chainTask,
                "api:db": dbTask,
                "api:middle": middleTask,
            },
        };

        const result = await applyServiceRegistry({
            initialTasks: [chainTask],
            registeredEntries: [buildEntry("api:db", { env: { DB_URL: "postgres://attached" } })],
            taskGraph,
            visVersion: VIS_VERSION,
        });

        expect(result.serviceEnvByTaskId.get("api:middle")).toEqual({ DB_URL: "postgres://attached" });
        expect(result.serviceEnvByTaskId.get("api:chain")).toEqual({ DB_URL: "postgres://attached" });
    });

    it("merges multi-service env in deterministic alphabetical order", async () => {
        expect.assertions(1);

        // Both services define DATABASE_URL with different values. The
        // alphabetically-later service id wins — stable across reorders
        // of `dependencies` arrays or `tasks` keys.
        const aTask = buildTask("api:a", { service: { port: 1 } });
        const bTask = buildTask("api:b", { service: { port: 2 } });
        const consumer = buildTask("api:consumer");
        const taskGraph: TaskGraph = {
            dependencies: {
                "api:a": [],
                "api:b": [],
                // Intentional reverse-alpha order to confirm the merge
                // doesn't follow array order.
                "api:consumer": ["api:b", "api:a"],
            },
            roots: ["api:consumer"],
            tasks: { "api:a": aTask, "api:b": bTask, "api:consumer": consumer },
        };

        const result = await applyServiceRegistry({
            initialTasks: [consumer],
            registeredEntries: [buildEntry("api:a", { env: { DATABASE_URL: "from-a" } }), buildEntry("api:b", { env: { DATABASE_URL: "from-b" } })],
            taskGraph,
            visVersion: VIS_VERSION,
        });

        // a then b → b wins because alphabetical sort, last-write wins.
        expect(result.serviceEnvByTaskId.get("api:consumer")).toEqual({ DATABASE_URL: "from-b" });
    });

    it("does not emit a diagnostic for a service task that is an orphan in the graph", async () => {
        expect.assertions(2);

        // db is in the graph but nothing depends on it and the user
        // didn't ask for it. Treating this as an error would be noise —
        // it usually means a leftover config, not a real misconfiguration.
        const dbTask = buildTask("api:db", { service: { port: 5432 } });
        const otherTask = buildTask("api:other");
        const taskGraph: TaskGraph = {
            dependencies: { "api:db": [], "api:other": [] },
            roots: ["api:other"],
            tasks: { "api:db": dbTask, "api:other": otherTask },
        };

        const result = await applyServiceRegistry({
            initialTasks: [otherTask],
            registeredEntries: [],
            taskGraph,
            visVersion: VIS_VERSION,
        });

        expect(result.diagnostics).toEqual([]);
        // Orphan stays in graph — it isn't satisfied, but it isn't a
        // problem either.
        expect(result.taskGraph.tasks["api:db"]).toBeDefined();
    });

    it("demotes an entry whose probe rejects and emits a restart hint", async () => {
        expect.assertions(3);

        const dbTask = buildTask("api:db", { service: { port: 5432 } });
        const testTask = buildTask("api:test");
        const taskGraph: TaskGraph = {
            dependencies: { "api:db": [], "api:test": ["api:db"] },
            roots: ["api:test"],
            tasks: { "api:db": dbTask, "api:test": testTask },
        };

        const result = await applyServiceRegistry({
            initialTasks: [testTask],
            probe: async () => false,
            registeredEntries: [buildEntry("api:db")],
            taskGraph,
            visVersion: VIS_VERSION,
        });

        expect(result.diagnostics).toHaveLength(1);
        // Probe failure → distinct diagnostic from "no entry": the wrapper
        // is alive, the user just needs to restart it.
        expect(result.diagnostics[0]?.message).toMatch(/vis service restart api:db/);
        expect(result.satisfiedServices).toEqual([]);
    });

    it("treats a probe that throws as a probe failure with the restart hint", async () => {
        expect.assertions(2);

        const dbTask = buildTask("api:db", { service: { port: 5432 } });
        const testTask = buildTask("api:test");
        const taskGraph: TaskGraph = {
            dependencies: { "api:db": [], "api:test": ["api:db"] },
            roots: ["api:test"],
            tasks: { "api:db": dbTask, "api:test": testTask },
        };

        const result = await applyServiceRegistry({
            initialTasks: [testTask],
            probe: async () => {
                throw new Error("boom");
            },
            registeredEntries: [buildEntry("api:db")],
            taskGraph,
            visVersion: VIS_VERSION,
        });

        expect(result.diagnostics).toHaveLength(1);
        expect(result.diagnostics[0]?.message).toMatch(/vis service restart api:db/);
    });
});
