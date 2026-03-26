import { describe, expect, it } from "vitest";

import { TaskScheduler } from "../src/task-scheduler";
import type { ProjectGraph, TaskGraph } from "../src/types";

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
        const { projectGraph, taskGraph } = createTestGraph();
        const scheduler = new TaskScheduler(taskGraph, projectGraph, 3);

        const batch = scheduler.getNextBatch();

        // Only c:build has no dependencies
        expect(batch).toHaveLength(1);
        expect(batch[0]?.id).toBe("c:build");
    });

    it("should release dependent tasks after completion", () => {
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
        const { projectGraph, taskGraph } = createTestGraph();
        const scheduler = new TaskScheduler(taskGraph, projectGraph, 1);

        const batch = scheduler.getNextBatch();

        expect(batch[0]).toBeDefined();

        scheduler.startTask((batch[0] as { id: string }).id);

        // With maxParallel=1 and one running, should return empty
        const batch2 = scheduler.getNextBatch();

        expect(batch2).toHaveLength(0);
    });
});
