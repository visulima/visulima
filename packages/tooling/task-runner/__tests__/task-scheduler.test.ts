import { describe, expect, it } from "vitest";

import { parsePartition, TaskScheduler } from "../src/task-scheduler";
import type { ProjectGraph, Task, TaskGraph } from "../src/types";

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
