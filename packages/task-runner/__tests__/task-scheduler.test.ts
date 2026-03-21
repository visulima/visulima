import { describe, it, expect } from "vitest";

import { TaskScheduler } from "../src/task-scheduler";
import type { TaskGraph, ProjectGraph } from "../src/types";

const createTestGraph = (): { taskGraph: TaskGraph; projectGraph: ProjectGraph } => {
    const taskGraph: TaskGraph = {
        roots: ["a:build"],
        tasks: {
            "a:build": { id: "a:build", target: { project: "a", target: "build" }, overrides: {}, outputs: [] },
            "b:build": { id: "b:build", target: { project: "b", target: "build" }, overrides: {}, outputs: [] },
            "c:build": { id: "c:build", target: { project: "c", target: "build" }, overrides: {}, outputs: [] },
        },
        dependencies: {
            "a:build": ["b:build"],
            "b:build": ["c:build"],
            "c:build": [],
        },
    };

    const projectGraph: ProjectGraph = {
        nodes: {
            a: { name: "a", type: "application", data: { root: "packages/a" } },
            b: { name: "b", type: "library", data: { root: "packages/b" } },
            c: { name: "c", type: "library", data: { root: "packages/c" } },
        },
        dependencies: {
            a: [{ source: "a", target: "b", type: "static" }],
            b: [{ source: "b", target: "c", type: "static" }],
            c: [],
        },
    };

    return { taskGraph, projectGraph };
};

describe("TaskScheduler", () => {
    it("should return leaf tasks first", () => {
        const { taskGraph, projectGraph } = createTestGraph();
        const scheduler = new TaskScheduler(taskGraph, projectGraph, 3);

        const batch = scheduler.getNextBatch();

        // Only c:build has no dependencies
        expect(batch).toHaveLength(1);
        expect(batch[0]!.id).toBe("c:build");
    });

    it("should release dependent tasks after completion", () => {
        const { taskGraph, projectGraph } = createTestGraph();
        const scheduler = new TaskScheduler(taskGraph, projectGraph, 3);

        // Get and complete c:build
        const batch1 = scheduler.getNextBatch();

        scheduler.startTask(batch1[0]!.id);
        scheduler.completeTask(batch1[0]!.id);

        // Now b:build should be available
        const batch2 = scheduler.getNextBatch();

        expect(batch2).toHaveLength(1);
        expect(batch2[0]!.id).toBe("b:build");
    });

    it("should respect maxParallel limit", () => {
        const taskGraph: TaskGraph = {
            roots: ["a:build", "b:build", "c:build"],
            tasks: {
                "a:build": { id: "a:build", target: { project: "a", target: "build" }, overrides: {}, outputs: [] },
                "b:build": { id: "b:build", target: { project: "b", target: "build" }, overrides: {}, outputs: [] },
                "c:build": { id: "c:build", target: { project: "c", target: "build" }, overrides: {}, outputs: [] },
            },
            dependencies: {
                "a:build": [],
                "b:build": [],
                "c:build": [],
            },
        };

        const projectGraph: ProjectGraph = {
            nodes: {
                a: { name: "a", type: "library", data: { root: "a" } },
                b: { name: "b", type: "library", data: { root: "b" } },
                c: { name: "c", type: "library", data: { root: "c" } },
            },
            dependencies: { a: [], b: [], c: [] },
        };

        const scheduler = new TaskScheduler(taskGraph, projectGraph, 2);
        const batch = scheduler.getNextBatch();

        expect(batch).toHaveLength(2);
    });

    it("should report isComplete correctly", () => {
        const { taskGraph, projectGraph } = createTestGraph();
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
        const { taskGraph, projectGraph } = createTestGraph();
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
        const { taskGraph, projectGraph } = createTestGraph();
        const scheduler = new TaskScheduler(taskGraph, projectGraph, 1);

        const batch = scheduler.getNextBatch();

        scheduler.startTask(batch[0]!.id);

        // With maxParallel=1 and one running, should return empty
        const batch2 = scheduler.getNextBatch();

        expect(batch2).toHaveLength(0);
    });
});
