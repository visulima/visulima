import { describe, expect, it } from "vitest";

import { parsePartition, TaskScheduler } from "../../src/task-scheduler";
import type { ProjectGraph, Task, TaskGraph } from "../../src/types";

const createTestGraph = (): { projectGraph: ProjectGraph; taskGraph: TaskGraph } => {
    const taskGraph: TaskGraph = {
        dependencies: {
            "a:build": ["b:build"],
            "b:build": ["c:build"],
            "c:build": [],
        },
        roots: ["a:build"],
        tasks: {
            "a:build": { id: "a:build", outputs: [], overrides: {}, target: { project: "a", target: "build" } },
            "b:build": { id: "b:build", outputs: [], overrides: {}, target: { project: "b", target: "build" } },
            "c:build": { id: "c:build", outputs: [], overrides: {}, target: { project: "c", target: "build" } },
        },
    };

    const projectGraph: ProjectGraph = {
        dependencies: {
            a: [{ source: "a", target: "b", type: "static" }],
            b: [{ source: "b", target: "c", type: "static" }],
            c: [],
        },
        nodes: {
            a: { data: { root: "packages/a" }, name: "a", type: "application" },
            b: { data: { root: "packages/b" }, name: "b", type: "library" },
            c: { data: { root: "packages/c" }, name: "c", type: "library" },
        },
    };

    return { projectGraph, taskGraph };
};

describe(TaskScheduler, () => {
    it("should return leaf tasks first", () => {
        expect.assertions(2);

        const { projectGraph, taskGraph } = createTestGraph();
        const scheduler = new TaskScheduler(taskGraph, projectGraph, 3);

        const batch = scheduler.getNextBatch();

        // Only c:build has no dependencies
        expect(batch).toHaveLength(1);
        expect(batch[0]?.id).toBe("c:build");
    });

    it("should release dependent tasks after completion", () => {
        expect.assertions(3);

        const { projectGraph, taskGraph } = createTestGraph();
        const scheduler = new TaskScheduler(taskGraph, projectGraph, 3);

        // Get and complete c:build
        const batch1 = scheduler.getNextBatch();

        expect(batch1[0]).toBeDefined();

        scheduler.startTask((batch1[0] as { id: string }).id);
        scheduler.completeTask((batch1[0] as { id: string }).id);

        // Now b:build should be available
        const batch2 = scheduler.getNextBatch();

        expect(batch2).toHaveLength(1);
        expect(batch2[0]?.id).toBe("b:build");
    });

    it("should respect maxParallel limit", () => {
        expect.assertions(1);

        const taskGraph: TaskGraph = {
            dependencies: {
                "a:build": [],
                "b:build": [],
                "c:build": [],
            },
            roots: ["a:build", "b:build", "c:build"],
            tasks: {
                "a:build": { id: "a:build", outputs: [], overrides: {}, target: { project: "a", target: "build" } },
                "b:build": { id: "b:build", outputs: [], overrides: {}, target: { project: "b", target: "build" } },
                "c:build": { id: "c:build", outputs: [], overrides: {}, target: { project: "c", target: "build" } },
            },
        };

        const projectGraph: ProjectGraph = {
            dependencies: { a: [], b: [], c: [] },
            nodes: {
                a: { data: { root: "a" }, name: "a", type: "library" },
                b: { data: { root: "b" }, name: "b", type: "library" },
                c: { data: { root: "c" }, name: "c", type: "library" },
            },
        };

        const scheduler = new TaskScheduler(taskGraph, projectGraph, 2);
        const batch = scheduler.getNextBatch();

        expect(batch).toHaveLength(2);
    });

    it("should report isComplete correctly", () => {
        expect.assertions(2);

        const { projectGraph, taskGraph } = createTestGraph();
        const scheduler = new TaskScheduler(taskGraph, projectGraph, 3);

        expect(scheduler.isComplete()).toBe(false);

        // Complete all tasks in order
        for (const taskId of ["c:build", "b:build", "a:build"]) {
            scheduler.startTask(taskId);
            scheduler.completeTask(taskId);
        }

        expect(scheduler.isComplete()).toBe(true);
    });

    it("should track running and remaining counts", () => {
        expect.assertions(5);

        const { projectGraph, taskGraph } = createTestGraph();
        const scheduler = new TaskScheduler(taskGraph, projectGraph, 3);

        expect(scheduler.remainingCount).toBe(3);
        expect(scheduler.runningCount).toBe(0);

        scheduler.startTask("c:build");

        expect(scheduler.runningCount).toBe(1);

        scheduler.completeTask("c:build");

        expect(scheduler.remainingCount).toBe(2);
        expect(scheduler.runningCount).toBe(0);
    });

    it("should return empty batch when running tasks fill slots", () => {
        expect.assertions(2);

        const { projectGraph, taskGraph } = createTestGraph();
        const scheduler = new TaskScheduler(taskGraph, projectGraph, 1);

        const batch = scheduler.getNextBatch();

        expect(batch[0]).toBeDefined();

        scheduler.startTask((batch[0] as { id: string }).id);

        // With maxParallel=1 and one running, should return empty
        const batch2 = scheduler.getNextBatch();

        expect(batch2).toHaveLength(0);
    });

    it("ranks high-priority tasks before normal and low in the ready queue", () => {
        expect.assertions(1);

        // Three sibling leaves — no dependencies between them. Without
        // priority the scheduler would fall back to graph-derived signals
        // (identical here) and finally alphabetical ID.
        const tasks: Record<string, Task> = {
            "a:build": { id: "a:build", outputs: [], overrides: {}, priority: "low", target: { project: "a", target: "build" } },
            "b:build": { id: "b:build", outputs: [], overrides: {}, priority: "high", target: { project: "b", target: "build" } },
            "c:build": { id: "c:build", outputs: [], overrides: {}, target: { project: "c", target: "build" } }, // normal default
        };
        const graph: TaskGraph = {
            dependencies: { "a:build": [], "b:build": [], "c:build": [] },
            roots: ["a:build", "b:build", "c:build"],
            tasks,
        };
        const projectGraph: ProjectGraph = {
            dependencies: { a: [], b: [], c: [] },
            nodes: {
                a: { data: { root: "a" }, name: "a", type: "library" },
                b: { data: { root: "b" }, name: "b", type: "library" },
                c: { data: { root: "c" }, name: "c", type: "library" },
            },
        };
        const scheduler = new TaskScheduler(graph, projectGraph, 3);

        const batch = scheduler.getNextBatch();

        // high → normal → low
        expect(batch.map((t) => t.id)).toStrictEqual(["b:build", "c:build", "a:build"]);
    });
});

const buildSiblingGraph = (
    targetName: string,
    projects: string[],
    overrides: (project: string) => Partial<Task> = () => {
        return {};
    },
): { projectGraph: ProjectGraph; taskGraph: TaskGraph } => {
    const tasks: Record<string, Task> = {};
    const dependencies: Record<string, string[]> = {};

    for (const project of projects) {
        const id = `${project}:${targetName}`;

        tasks[id] = {
            id,
            outputs: [],
            overrides: {},
            target: { project, target: targetName },
            ...overrides(project),
        };
        dependencies[id] = [];
    }

    const projectGraph: ProjectGraph = {
        dependencies: Object.fromEntries(projects.map((p) => [p, []])),
        nodes: Object.fromEntries(projects.map((p) => [p, { data: { root: `packages/${p}` }, name: p, type: "library" }])),
    };

    return {
        projectGraph,
        taskGraph: { dependencies, roots: Object.keys(tasks), tasks },
    };
};

describe("taskScheduler concurrency caps", () => {
    it("should serialize tasks of the same target when maxConcurrent=1", () => {
        expect.assertions(4);

        const { projectGraph, taskGraph } = buildSiblingGraph("e2e", ["a", "b", "c"], () => {
            return { maxConcurrent: 1 };
        });
        const scheduler = new TaskScheduler(taskGraph, projectGraph, 8);

        // Even with 8 parallel slots, only one e2e task may start at a time.
        const batch1 = scheduler.getNextBatch();

        expect(batch1).toHaveLength(1);

        scheduler.startTask((batch1[0] as Task).id);

        const batch2 = scheduler.getNextBatch();

        expect(batch2).toHaveLength(0);

        scheduler.completeTask((batch1[0] as Task).id);

        const batch3 = scheduler.getNextBatch();

        expect(batch3).toHaveLength(1);
        expect(batch3[0]?.id).not.toBe(batch1[0]?.id);
    });

    it("should allow up to maxConcurrent tasks of the same target in one batch", () => {
        expect.assertions(2);

        const { projectGraph, taskGraph } = buildSiblingGraph("test", ["a", "b", "c", "d"], () => {
            return { maxConcurrent: 2 };
        });
        const scheduler = new TaskScheduler(taskGraph, projectGraph, 8);

        const batch = scheduler.getNextBatch();

        expect(batch).toHaveLength(2);

        for (const t of batch) {
            scheduler.startTask(t.id);
        }

        const batch2 = scheduler.getNextBatch();

        expect(batch2).toHaveLength(0);
    });

    it("should pick the smallest cap when projects declare different maxConcurrent for the same target", () => {
        expect.assertions(2);

        // Four sibling tasks; only `b` declares the limiting cap. If
        // the min logic broke and the runner used `a`'s cap of 4 (or
        // ignored `b` because it was the second project), the batch
        // would have 4 entries. The single entry proves `b`'s cap of 1
        // is what binds the whole target name.
        const caps: Record<string, number | undefined> = { a: 4, b: 1, c: 2, d: undefined };
        const { projectGraph, taskGraph } = buildSiblingGraph("test", ["a", "b", "c", "d"], (project) => {
            const cap = caps[project];

            return cap === undefined ? {} : { maxConcurrent: cap };
        });
        const scheduler = new TaskScheduler(taskGraph, projectGraph, 8);

        const batch = scheduler.getNextBatch();

        expect(batch).toHaveLength(1);

        // After completing the first one, exactly one new task starts.
        scheduler.startTask((batch[0] as Task).id);
        scheduler.completeTask((batch[0] as Task).id);

        const batch2 = scheduler.getNextBatch();

        expect(batch2).toHaveLength(1);
    });

    it("should ignore non-finite maxConcurrent values (NaN, Infinity)", () => {
        expect.assertions(1);

        const caps: Record<string, number> = { a: Number.NaN, b: Number.POSITIVE_INFINITY, c: -1 };
        const { projectGraph, taskGraph } = buildSiblingGraph("test", ["a", "b", "c"], (project) => {
            return {
                maxConcurrent: caps[project],
            };
        });
        const scheduler = new TaskScheduler(taskGraph, projectGraph, 8);

        const batch = scheduler.getNextBatch();

        // No valid cap survived — all three tasks fill the batch.
        expect(batch).toHaveLength(3);
    });

    it("should also ignore non-finite group cap values", () => {
        expect.assertions(1);

        const tasks: Record<string, Task> = {
            "a:test": {
                concurrencyGroup: "db",
                id: "a:test",
                outputs: [],
                overrides: {},
                target: { project: "a", target: "test" },
            },
            "b:test": {
                concurrencyGroup: "db",
                id: "b:test",
                outputs: [],
                overrides: {},
                target: { project: "b", target: "test" },
            },
        };
        const taskGraph: TaskGraph = {
            dependencies: { "a:test": [], "b:test": [] },
            roots: Object.keys(tasks),
            tasks,
        };
        const projectGraph: ProjectGraph = {
            dependencies: { a: [], b: [] },
            nodes: {
                a: { data: { root: "a" }, name: "a", type: "library" },
                b: { data: { root: "b" }, name: "b", type: "library" },
            },
        };
        const scheduler = new TaskScheduler(taskGraph, projectGraph, 8, { db: Number.NaN });

        // NaN cap is dropped → effectively no group cap; both run.
        expect(scheduler.getNextBatch()).toHaveLength(2);
    });

    it("should let the smaller cap bind when a task carries both a target cap and a group cap", () => {
        expect.assertions(1);

        // Three sibling tasks: target cap is 2, but they all share a
        // db-bound group capped at 1. The group cap is smaller, so only
        // one starts.
        const tasks: Record<string, Task> = {
            "a:test": {
                concurrencyGroup: "db",
                id: "a:test",
                maxConcurrent: 2,
                outputs: [],
                overrides: {},
                target: { project: "a", target: "test" },
            },
            "b:test": {
                concurrencyGroup: "db",
                id: "b:test",
                maxConcurrent: 2,
                outputs: [],
                overrides: {},
                target: { project: "b", target: "test" },
            },
            "c:test": {
                concurrencyGroup: "db",
                id: "c:test",
                maxConcurrent: 2,
                outputs: [],
                overrides: {},
                target: { project: "c", target: "test" },
            },
        };
        const taskGraph: TaskGraph = {
            dependencies: { "a:test": [], "b:test": [], "c:test": [] },
            roots: Object.keys(tasks),
            tasks,
        };
        const projectGraph: ProjectGraph = {
            dependencies: { a: [], b: [], c: [] },
            nodes: {
                a: { data: { root: "a" }, name: "a", type: "library" },
                b: { data: { root: "b" }, name: "b", type: "library" },
                c: { data: { root: "c" }, name: "c", type: "library" },
            },
        };
        const scheduler = new TaskScheduler(taskGraph, projectGraph, 8, { db: 1 });

        expect(scheduler.getNextBatch()).toHaveLength(1);
    });

    it("should be idempotent on double startTask / completeTask", () => {
        expect.assertions(3);

        const { projectGraph, taskGraph } = buildSiblingGraph("e2e", ["a", "b"], () => {
            return { maxConcurrent: 1 };
        });
        const scheduler = new TaskScheduler(taskGraph, projectGraph, 8);

        const batch1 = scheduler.getNextBatch();
        const first = batch1[0] as Task;

        scheduler.startTask(first.id);
        // Second start is a no-op — must not double-count the per-key total
        // or the cap would never recover.
        scheduler.startTask(first.id);

        scheduler.completeTask(first.id);
        // Completing twice must not over-decrement and free a slot the cap
        // is holding for some other key.
        scheduler.completeTask(first.id);

        const batch2 = scheduler.getNextBatch();

        expect(batch2).toHaveLength(1);
        expect(batch2[0]?.id).not.toBe(first.id);

        scheduler.startTask((batch2[0] as Task).id);

        // With both still-uncompleted task slot accounting honest, no
        // further work is releasable.
        expect(scheduler.getNextBatch()).toHaveLength(0);
    });

    it("should ignore maxConcurrent values <= 0", () => {
        expect.assertions(1);

        const { projectGraph, taskGraph } = buildSiblingGraph("test", ["a", "b", "c"], () => {
            return { maxConcurrent: 0 };
        });
        const scheduler = new TaskScheduler(taskGraph, projectGraph, 8);

        const batch = scheduler.getNextBatch();

        // 0 cap means "no cap" — all three siblings should fill the slots.
        expect(batch).toHaveLength(3);
    });

    it("should fill remaining slots with uncapped tasks when capped target is saturated", () => {
        expect.assertions(2);

        // Two `e2e` tasks (capped at 1) + two uncapped `lint` tasks. With
        // 4 parallel slots, the first batch should be: 1 e2e + 2 lint = 3 tasks.
        const tasks: Record<string, Task> = {
            "a:e2e": { id: "a:e2e", maxConcurrent: 1, outputs: [], overrides: {}, target: { project: "a", target: "e2e" } },
            "a:lint": { id: "a:lint", outputs: [], overrides: {}, target: { project: "a", target: "lint" } },
            "b:e2e": { id: "b:e2e", maxConcurrent: 1, outputs: [], overrides: {}, target: { project: "b", target: "e2e" } },
            "b:lint": { id: "b:lint", outputs: [], overrides: {}, target: { project: "b", target: "lint" } },
        };
        const taskGraph: TaskGraph = {
            dependencies: { "a:e2e": [], "a:lint": [], "b:e2e": [], "b:lint": [] },
            roots: Object.keys(tasks),
            tasks,
        };
        const projectGraph: ProjectGraph = {
            dependencies: { a: [], b: [] },
            nodes: {
                a: { data: { root: "a" }, name: "a", type: "library" },
                b: { data: { root: "b" }, name: "b", type: "library" },
            },
        };
        const scheduler = new TaskScheduler(taskGraph, projectGraph, 4);

        const batch = scheduler.getNextBatch();

        const e2eCount = batch.filter((t) => t.target.target === "e2e").length;
        const lintCount = batch.filter((t) => t.target.target === "lint").length;

        expect(e2eCount).toBe(1);
        expect(lintCount).toBe(2);
    });

    it("should enforce a workspace-level concurrency group across heterogeneous targets", () => {
        expect.assertions(2);

        // Two different targets share concurrencyGroup="db" with cap 1.
        const tasks: Record<string, Task> = {
            "a:test": {
                concurrencyGroup: "db",
                id: "a:test",
                outputs: [],
                overrides: {},
                target: { project: "a", target: "test" },
            },
            "b:integration": {
                concurrencyGroup: "db",
                id: "b:integration",
                outputs: [],
                overrides: {},
                target: { project: "b", target: "integration" },
            },
            "c:lint": { id: "c:lint", outputs: [], overrides: {}, target: { project: "c", target: "lint" } },
        };
        const taskGraph: TaskGraph = {
            dependencies: { "a:test": [], "b:integration": [], "c:lint": [] },
            roots: Object.keys(tasks),
            tasks,
        };
        const projectGraph: ProjectGraph = {
            dependencies: { a: [], b: [], c: [] },
            nodes: {
                a: { data: { root: "a" }, name: "a", type: "library" },
                b: { data: { root: "b" }, name: "b", type: "library" },
                c: { data: { root: "c" }, name: "c", type: "library" },
            },
        };
        const scheduler = new TaskScheduler(taskGraph, projectGraph, 8, { db: 1 });

        const batch = scheduler.getNextBatch();
        const dbCount = batch.filter((t) => t.concurrencyGroup === "db").length;

        // Only one db-group task may start; lint is unrelated and runs alongside.
        expect(dbCount).toBe(1);
        expect(batch.some((t) => t.id === "c:lint")).toBe(true);
    });

    it("should free the cap slot when a task completes", () => {
        expect.assertions(2);

        const { projectGraph, taskGraph } = buildSiblingGraph("e2e", ["a", "b"], () => {
            return { maxConcurrent: 1 };
        });
        const scheduler = new TaskScheduler(taskGraph, projectGraph, 8);

        const batch1 = scheduler.getNextBatch();

        expect(batch1).toHaveLength(1);

        scheduler.startTask((batch1[0] as Task).id);
        scheduler.completeTask((batch1[0] as Task).id);

        const batch2 = scheduler.getNextBatch();

        expect(batch2).toHaveLength(1);
    });

    it("should not deadlock when a capped task is blocked but uncapped tasks remain", () => {
        expect.assertions(3);

        const tasks: Record<string, Task> = {
            "a:e2e": { id: "a:e2e", maxConcurrent: 1, outputs: [], overrides: {}, target: { project: "a", target: "e2e" } },
            "a:lint": { id: "a:lint", outputs: [], overrides: {}, target: { project: "a", target: "lint" } },
            "b:e2e": { id: "b:e2e", maxConcurrent: 1, outputs: [], overrides: {}, target: { project: "b", target: "e2e" } },
        };
        const taskGraph: TaskGraph = {
            dependencies: { "a:e2e": [], "a:lint": [], "b:e2e": [] },
            roots: Object.keys(tasks),
            tasks,
        };
        const projectGraph: ProjectGraph = {
            dependencies: { a: [], b: [] },
            nodes: {
                a: { data: { root: "a" }, name: "a", type: "library" },
                b: { data: { root: "b" }, name: "b", type: "library" },
            },
        };
        const scheduler = new TaskScheduler(taskGraph, projectGraph, 8);

        const batch1 = scheduler.getNextBatch();

        // First batch: 1 e2e + 1 lint (b:e2e blocked by cap)
        expect(batch1).toHaveLength(2);

        for (const t of batch1) {
            scheduler.startTask(t.id);
        }

        // While e2e is running, b:e2e is held back; ready queue has nothing else.
        const batch2 = scheduler.getNextBatch();

        expect(batch2).toHaveLength(0);

        // After the first e2e finishes, the second one may start.
        const e2eFirst = batch1.find((t) => t.target.target === "e2e") as Task;

        scheduler.completeTask(e2eFirst.id);

        const batch3 = scheduler.getNextBatch();

        expect(batch3.map((t) => t.id)).toStrictEqual([e2eFirst.id === "a:e2e" ? "b:e2e" : "a:e2e"]);
    });
});

const makeTask = (id: string): Task => {
    return {
        id,
        outputs: [],
        overrides: {},
        target: { project: id.split(":")[0] as string, target: id.split(":")[1] as string },
    };
};

describe("taskScheduler.partitionTasks", () => {
    it("should split 10 tasks into 4 partitions of [3, 3, 3, 1]", () => {
        expect.assertions(5);

        const tasks = Array.from({ length: 10 }, (_, i) => makeTask(`p${String(i).padStart(2, "0")}:build`));

        const p1 = TaskScheduler.partitionTasks(tasks, { index: 1, total: 4 });
        const p2 = TaskScheduler.partitionTasks(tasks, { index: 2, total: 4 });
        const p3 = TaskScheduler.partitionTasks(tasks, { index: 3, total: 4 });
        const p4 = TaskScheduler.partitionTasks(tasks, { index: 4, total: 4 });

        expect(p1).toHaveLength(3);
        expect(p2).toHaveLength(3);
        expect(p3).toHaveLength(3);
        expect(p4).toHaveLength(1);

        // All tasks are covered, no duplicates
        const allIds = [...p1, ...p2, ...p3, ...p4].map((t) => t.id);

        expect(new Set(allIds).size).toBe(10);
    });

    it("should split 4 tasks into 4 partitions of [1, 1, 1, 1]", () => {
        expect.hasAssertions();

        const tasks = [makeTask("a:build"), makeTask("b:build"), makeTask("c:build"), makeTask("d:build")];

        for (let i = 1; i <= 4; i++) {
            const partition = TaskScheduler.partitionTasks(tasks, { index: i, total: 4 });

            expect(partition).toHaveLength(1);
        }
    });

    it("should assign single task to partition 1 and empty to others", () => {
        expect.assertions(4);

        const tasks = [makeTask("a:build")];

        expect(TaskScheduler.partitionTasks(tasks, { index: 1, total: 4 })).toHaveLength(1);
        expect(TaskScheduler.partitionTasks(tasks, { index: 2, total: 4 })).toHaveLength(0);
        expect(TaskScheduler.partitionTasks(tasks, { index: 3, total: 4 })).toHaveLength(0);
        expect(TaskScheduler.partitionTasks(tasks, { index: 4, total: 4 })).toHaveLength(0);
    });

    it("should return empty for empty task list", () => {
        expect.assertions(1);

        expect(TaskScheduler.partitionTasks([], { index: 1, total: 4 })).toHaveLength(0);
    });

    it("should throw for invalid partition index (0)", () => {
        expect.assertions(1);

        const tasks = [makeTask("a:build")];

        expect(() => TaskScheduler.partitionTasks(tasks, { index: 0, total: 4 })).toThrow("Invalid partition index");
    });

    it("should throw for partition index exceeding total", () => {
        expect.assertions(1);

        const tasks = [makeTask("a:build")];

        expect(() => TaskScheduler.partitionTasks(tasks, { index: 5, total: 4 })).toThrow("Invalid partition index");
    });

    it("should produce deterministic results regardless of input order", () => {
        expect.assertions(1);

        const tasks1 = [makeTask("c:build"), makeTask("a:build"), makeTask("b:build")];
        const tasks2 = [makeTask("b:build"), makeTask("c:build"), makeTask("a:build")];

        const result1 = TaskScheduler.partitionTasks(tasks1, { index: 1, total: 2 });
        const result2 = TaskScheduler.partitionTasks(tasks2, { index: 1, total: 2 });

        expect(result1.map((t) => t.id)).toStrictEqual(result2.map((t) => t.id));
    });

    it("should handle single partition (1/1) returning all tasks", () => {
        expect.assertions(1);

        const tasks = [makeTask("a:build"), makeTask("b:build"), makeTask("c:build")];

        const result = TaskScheduler.partitionTasks(tasks, { index: 1, total: 1 });

        expect(result).toHaveLength(3);
    });

    it("should handle more partitions than tasks", () => {
        expect.assertions(2);

        const tasks = [makeTask("a:build"), makeTask("b:build")];

        const p1 = TaskScheduler.partitionTasks(tasks, { index: 1, total: 5 });
        const p2 = TaskScheduler.partitionTasks(tasks, { index: 2, total: 5 });
        const p3 = TaskScheduler.partitionTasks(tasks, { index: 3, total: 5 });
        const p4 = TaskScheduler.partitionTasks(tasks, { index: 4, total: 5 });
        const p5 = TaskScheduler.partitionTasks(tasks, { index: 5, total: 5 });

        // 2 tasks across 5 partitions: first 2 get 1 each, rest empty
        const allIds = [...p1, ...p2, ...p3, ...p4, ...p5].map((t) => t.id);

        expect(allIds).toHaveLength(2);
        expect(new Set(allIds).size).toBe(2);
    });
});

describe(parsePartition, () => {
    it('should parse "1/4" correctly', () => {
        expect.assertions(1);

        expect(parsePartition("1/4")).toStrictEqual({ index: 1, total: 4 });
    });

    it('should parse "3/3" correctly', () => {
        expect.assertions(1);

        expect(parsePartition("3/3")).toStrictEqual({ index: 3, total: 3 });
    });

    it("should return undefined for undefined input and no env var", () => {
        expect.assertions(1);

        const original = process.env.VIS_PARTITION;

        delete process.env.VIS_PARTITION;

        expect(parsePartition(undefined)).toBeUndefined();

        process.env.VIS_PARTITION = original;
    });

    it("should throw for invalid format", () => {
        expect.assertions(2);

        expect(() => parsePartition("1")).toThrow("Invalid partition format");
        expect(() => parsePartition("1/2/3")).toThrow("Invalid partition format");
    });

    it("should throw for non-integer values", () => {
        expect.assertions(2);

        expect(() => parsePartition("1.5/4")).toThrow("Invalid partition values");
        expect(() => parsePartition("a/b")).toThrow("Invalid partition values");
    });

    it("should throw when index exceeds total", () => {
        expect.assertions(1);

        expect(() => parsePartition("5/4")).toThrow("Invalid partition index");
    });

    it("should throw for zero values", () => {
        expect.assertions(2);

        expect(() => parsePartition("0/4")).toThrow("Invalid partition values");
        expect(() => parsePartition("1/0")).toThrow("Invalid partition values");
    });

    it("should throw for negative values", () => {
        expect.assertions(2);

        expect(() => parsePartition("-1/4")).toThrow("Invalid partition values");
        expect(() => parsePartition("1/-2")).toThrow("Invalid partition values");
    });

    it("should read from VIS_PARTITION env var when no argument given", () => {
        expect.assertions(1);

        const original = process.env.VIS_PARTITION;

        try {
            process.env.VIS_PARTITION = "2/3";

            expect(parsePartition(undefined)).toStrictEqual({ index: 2, total: 3 });
        } finally {
            if (original === undefined) {
                delete process.env.VIS_PARTITION;
            } else {
                process.env.VIS_PARTITION = original;
            }
        }
    });

    it("should prefer explicit argument over VIS_PARTITION env var", () => {
        expect.assertions(1);

        const original = process.env.VIS_PARTITION;

        try {
            process.env.VIS_PARTITION = "1/2";

            expect(parsePartition("3/4")).toStrictEqual({ index: 3, total: 4 });
        } finally {
            if (original === undefined) {
                delete process.env.VIS_PARTITION;
            } else {
                process.env.VIS_PARTITION = original;
            }
        }
    });
});

describe("taskScheduler concurrencyWeight", () => {
    const makeFlat = (entries: Record<string, Partial<Task>>): { projectGraph: ProjectGraph; taskGraph: TaskGraph } => {
        const tasks: Record<string, Task> = {};
        const dependencies: Record<string, string[]> = {};

        for (const [id, overrides] of Object.entries(entries)) {
            const [project, target] = id.split(":") as [string, string];

            tasks[id] = {
                id,
                outputs: [],
                overrides: {},
                target: { project, target },
                ...overrides,
            };
            dependencies[id] = [];
        }

        const projectGraph: ProjectGraph = {
            dependencies: Object.fromEntries(Object.keys(entries).map((id) => [id.split(":")[0] as string, []])),
            nodes: Object.fromEntries(
                Object.keys(entries).map((id) => {
                    const project = id.split(":")[0] as string;

                    return [project, { data: { root: project }, name: project, type: "library" }];
                }),
            ),
        };

        return {
            projectGraph,
            taskGraph: { dependencies, roots: Object.keys(entries), tasks },
        };
    };

    it("default weight of 1 keeps prior count-based behavior", () => {
        expect.assertions(1);

        const { projectGraph, taskGraph } = makeFlat({
            "a:build": {},
            "b:build": {},
            "c:build": {},
        });
        const scheduler = new TaskScheduler(taskGraph, projectGraph, 2);

        // No weights set; the scheduler should fill 2 slots, same as before.
        expect(scheduler.getNextBatch()).toHaveLength(2);
    });

    it("weight-2 task halves throughput against the cap", () => {
        expect.assertions(2);

        const { projectGraph, taskGraph } = makeFlat({
            // weight-2 task should occupy 2 of 4 slots on its own,
            // leaving room for two weight-1 tasks but blocking a third.
            "heavy:build": { concurrencyWeight: 2 },
            "x:build": {},
            "y:build": {},
            "z:build": {},
        });
        const scheduler = new TaskScheduler(taskGraph, projectGraph, 4);

        const batch = scheduler.getNextBatch();

        expect(batch).toHaveLength(3);
        // weighted slots used: 2 (heavy) + 1 + 1 = 4; the fourth task is held back.
        expect(batch.map((t) => t.id).includes("z:build") || batch.map((t) => t.id).includes("y:build") || batch.map((t) => t.id).includes("x:build")).toBe(
            true,
        );
    });

    it("running weight blocks further admits until completion", () => {
        expect.assertions(2);

        const { projectGraph, taskGraph } = makeFlat({
            "heavy:build": { concurrencyWeight: 3 },
            "light:build": {},
        });
        const scheduler = new TaskScheduler(taskGraph, projectGraph, 3);

        const first = scheduler.getNextBatch();

        // Heavy + light = 4 > 3, so only one of them runs.
        expect(first).toHaveLength(1);

        scheduler.startTask((first[0] as Task).id);
        const second = scheduler.getNextBatch();

        // Whichever task the scheduler picked first, the remaining one
        // can't fit: heavy first leaves 0 slots (3 used of 3); light first
        // leaves 2 slots which heavy (weight 3) still overruns. Either
        // way the second batch is empty until completion frees the budget.
        expect(second).toHaveLength(0);
    });

    it("heavy task on parallel:1 still runs (deadlock-free)", () => {
        expect.assertions(1);

        const { projectGraph, taskGraph } = makeFlat({
            "heavy:build": { concurrencyWeight: 8 },
        });
        const scheduler = new TaskScheduler(taskGraph, projectGraph, 1);

        // Without the idle-pool exception, a weight-8 task on a 1-slot
        // pool would never start — the cap would refuse it forever.
        expect(scheduler.getNextBatch()).toHaveLength(1);
    });

    it("invalid weights coerce to 1", () => {
        expect.assertions(1);

        const { projectGraph, taskGraph } = makeFlat({
            "a:build": { concurrencyWeight: -5 },
            "b:build": { concurrencyWeight: 0 },
            "c:build": { concurrencyWeight: 1.5 },
            "d:build": { concurrencyWeight: Number.NaN },
        });
        const scheduler = new TaskScheduler(taskGraph, projectGraph, 4);

        // All four should fit at weight 1 each.
        expect(scheduler.getNextBatch()).toHaveLength(4);
    });

    it("completion frees the weight slot", () => {
        expect.assertions(2);

        const { projectGraph, taskGraph } = makeFlat({
            "heavy:build": { concurrencyWeight: 2 },
            "next:build": { concurrencyWeight: 2 },
        });
        const scheduler = new TaskScheduler(taskGraph, projectGraph, 2);

        const first = scheduler.getNextBatch();

        expect(first).toHaveLength(1);

        scheduler.startTask((first[0] as Task).id);
        scheduler.completeTask((first[0] as Task).id);

        // After completion, the budget is fully freed and the other heavy task fits.
        expect(scheduler.getNextBatch()).toHaveLength(1);
    });
});
