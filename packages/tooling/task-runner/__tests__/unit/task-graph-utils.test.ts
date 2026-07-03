import { describe, expect, it } from "vitest";

import {
    findCycle,
    findCycles,
    getDependentTasks,
    getLeafTasks,
    getTransitiveDependencies,
    makeAcyclic,
    reverseTaskGraph,
    walkTaskGraph,
} from "../../src/task-graph-utils";
import type { TaskGraph } from "../../src/types";

const createSimpleGraph = (): TaskGraph => {
    return {
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
};

const createCyclicGraph = (): TaskGraph => {
    return {
        dependencies: {
            "a:build": ["b:build"],
            "b:build": ["a:build"],
        },
        roots: [],
        tasks: {
            "a:build": { id: "a:build", outputs: [], overrides: {}, target: { project: "a", target: "build" } },
            "b:build": { id: "b:build", outputs: [], overrides: {}, target: { project: "b", target: "build" } },
        },
    };
};

describe(findCycle, () => {
    it("should return null for acyclic graph", () => {
        expect.assertions(1);
        expect(findCycle(createSimpleGraph())).toBeUndefined();
    });

    it("should find a cycle in cyclic graph", () => {
        expect.assertions(2);

        const cycle = findCycle(createCyclicGraph());

        expect(cycle).toBeDefined();
        expect((cycle as string[]).length).toBeGreaterThan(2);
    });
});

describe(findCycles, () => {
    it("should return empty array for acyclic graph", () => {
        expect.assertions(1);
        expect(findCycles(createSimpleGraph())).toStrictEqual([]);
    });

    it("should find cycles in cyclic graph", () => {
        expect.assertions(1);

        const cycles = findCycles(createCyclicGraph());

        expect(cycles.length).toBeGreaterThan(0);
    });
});

describe(walkTaskGraph, () => {
    it("should visit tasks in topological order", () => {
        expect.assertions(2);

        const visited: string[] = [];

        walkTaskGraph(createSimpleGraph(), (taskId) => {
            visited.push(taskId);
        });

        // Dependencies first: c:build (no deps) before b:build before a:build
        const aIndex = visited.indexOf("a:build");
        const bIndex = visited.indexOf("b:build");
        const cIndex = visited.indexOf("c:build");

        expect(cIndex).toBeLessThan(bIndex);
        expect(bIndex).toBeLessThan(aIndex);
    });

    it("should visit all tasks", () => {
        expect.assertions(1);

        const visited: string[] = [];

        walkTaskGraph(createSimpleGraph(), (taskId) => {
            visited.push(taskId);
        });

        expect(visited).toHaveLength(3);
    });
});

describe(reverseTaskGraph, () => {
    it("should reverse edge directions", () => {
        expect.assertions(3);

        const reversed = reverseTaskGraph(createSimpleGraph());

        // Original: a -> b -> c
        // Reversed: c -> b -> a
        expect(reversed.dependencies["c:build"]).toContain("b:build");
        expect(reversed.dependencies["b:build"]).toContain("a:build");
        expect(reversed.dependencies["a:build"]).toStrictEqual([]);
    });
});

describe(getLeafTasks, () => {
    it("should return tasks with no dependencies", () => {
        expect.assertions(1);

        const leaves = getLeafTasks(createSimpleGraph());

        expect(leaves).toStrictEqual(["c:build"]);
    });
});

describe(makeAcyclic, () => {
    it("should remove cycle-forming edges", () => {
        expect.assertions(1);

        const acyclic = makeAcyclic(createCyclicGraph());

        expect(findCycle(acyclic)).toBeUndefined();
    });

    it("should not modify acyclic graphs", () => {
        expect.assertions(1);

        const original = createSimpleGraph();
        const result = makeAcyclic(original);

        expect(result.dependencies).toStrictEqual(original.dependencies);
    });
});

describe(getDependentTasks, () => {
    it("should find all tasks that depend on a task", () => {
        expect.assertions(2);

        const dependents = getDependentTasks(createSimpleGraph(), "c:build");

        expect(dependents).toContain("b:build");
        expect(dependents).toContain("a:build");
    });

    it("should return empty for root tasks with no dependents", () => {
        expect.assertions(1);

        const dependents = getDependentTasks(createSimpleGraph(), "a:build");

        expect(dependents).toStrictEqual([]);
    });
});

describe(getTransitiveDependencies, () => {
    it("should find all transitive dependencies", () => {
        expect.assertions(2);

        const deps = getTransitiveDependencies(createSimpleGraph(), "a:build");

        expect(deps).toContain("b:build");
        expect(deps).toContain("c:build");
    });

    it("should return empty for leaf tasks", () => {
        expect.assertions(1);

        const deps = getTransitiveDependencies(createSimpleGraph(), "c:build");

        expect(deps).toStrictEqual([]);
    });
});
