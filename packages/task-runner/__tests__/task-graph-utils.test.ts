import { describe, it, expect } from "vitest";

import {
    findCycle,
    findCycles,
    walkTaskGraph,
    reverseTaskGraph,
    getLeafTasks,
    makeAcyclic,
    getDependentTasks,
    getTransitiveDependencies,
} from "../src/task-graph-utils";
import type { TaskGraph } from "../src/types";

const createSimpleGraph = (): TaskGraph => ({
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
});

const createCyclicGraph = (): TaskGraph => ({
    roots: [],
    tasks: {
        "a:build": { id: "a:build", target: { project: "a", target: "build" }, overrides: {}, outputs: [] },
        "b:build": { id: "b:build", target: { project: "b", target: "build" }, overrides: {}, outputs: [] },
    },
    dependencies: {
        "a:build": ["b:build"],
        "b:build": ["a:build"],
    },
});

describe("findCycle", () => {
    it("should return null for acyclic graph", () => {
        expect(findCycle(createSimpleGraph())).toBeNull();
    });

    it("should find a cycle in cyclic graph", () => {
        const cycle = findCycle(createCyclicGraph());

        expect(cycle).not.toBeNull();
        expect(cycle!.length).toBeGreaterThan(2);
    });
});

describe("findCycles", () => {
    it("should return empty array for acyclic graph", () => {
        expect(findCycles(createSimpleGraph())).toEqual([]);
    });

    it("should find cycles in cyclic graph", () => {
        const cycles = findCycles(createCyclicGraph());

        expect(cycles.length).toBeGreaterThan(0);
    });
});

describe("walkTaskGraph", () => {
    it("should visit tasks in topological order", () => {
        const visited: string[] = [];

        walkTaskGraph(createSimpleGraph(), (taskId) => {
            visited.push(taskId);
        });

        // a:build should be visited before b:build, which is before c:build
        const aIndex = visited.indexOf("a:build");
        const bIndex = visited.indexOf("b:build");
        const cIndex = visited.indexOf("c:build");

        expect(aIndex).toBeLessThan(bIndex);
        expect(bIndex).toBeLessThan(cIndex);
    });

    it("should visit all tasks", () => {
        const visited: string[] = [];

        walkTaskGraph(createSimpleGraph(), (taskId) => {
            visited.push(taskId);
        });

        expect(visited).toHaveLength(3);
    });
});

describe("reverseTaskGraph", () => {
    it("should reverse edge directions", () => {
        const reversed = reverseTaskGraph(createSimpleGraph());

        // Original: a -> b -> c
        // Reversed: c -> b -> a
        expect(reversed.dependencies["c:build"]).toContain("b:build");
        expect(reversed.dependencies["b:build"]).toContain("a:build");
        expect(reversed.dependencies["a:build"]).toEqual([]);
    });
});

describe("getLeafTasks", () => {
    it("should return tasks with no dependencies", () => {
        const leaves = getLeafTasks(createSimpleGraph());

        expect(leaves).toEqual(["c:build"]);
    });
});

describe("makeAcyclic", () => {
    it("should remove cycle-forming edges", () => {
        const acyclic = makeAcyclic(createCyclicGraph());

        expect(findCycle(acyclic)).toBeNull();
    });

    it("should not modify acyclic graphs", () => {
        const original = createSimpleGraph();
        const result = makeAcyclic(original);

        expect(result.dependencies).toEqual(original.dependencies);
    });
});

describe("getDependentTasks", () => {
    it("should find all tasks that depend on a task", () => {
        const dependents = getDependentTasks(createSimpleGraph(), "c:build");

        expect(dependents).toContain("b:build");
        expect(dependents).toContain("a:build");
    });

    it("should return empty for root tasks with no dependents", () => {
        const dependents = getDependentTasks(createSimpleGraph(), "a:build");

        expect(dependents).toEqual([]);
    });
});

describe("getTransitiveDependencies", () => {
    it("should find all transitive dependencies", () => {
        const deps = getTransitiveDependencies(createSimpleGraph(), "a:build");

        expect(deps).toContain("b:build");
        expect(deps).toContain("c:build");
    });

    it("should return empty for leaf tasks", () => {
        const deps = getTransitiveDependencies(createSimpleGraph(), "c:build");

        expect(deps).toEqual([]);
    });
});
