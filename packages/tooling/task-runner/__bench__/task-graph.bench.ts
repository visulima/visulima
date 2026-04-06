/**
 * Benchmark: Task graph operations
 *
 * Measures the performance of graph algorithms:
 * - Topological walk (scheduling order)
 * - Cycle detection
 * - Graph visualization (DOT, JSON, ASCII)
 * - Affected filtering
 *
 * These operations run once per invocation so they need to be
 * fast even on large graphs. Nx and Turborepo use similar
 * topological scheduling.
 */
import { bench, describe } from "vitest";

import { filterAffectedTasks } from "../src/affected";
import { toGraphAscii, toGraphJson, toGraphvizDot } from "../src/graph-visualizer";
import { findCycle, findCycles, getDependentTasks, getLeafTasks, makeAcyclic, walkTaskGraph } from "../src/task-graph-utils";
import type { TaskGraph } from "../src/types";
import { buildTaskGraph } from "./setup";

// ─── Topological walk ───────────────────────────────────────────────

describe("walkTaskGraph - linear chain", () => {
    const small = buildTaskGraph(10);
    const medium = buildTaskGraph(50);
    const large = buildTaskGraph(200);

    bench("10 tasks", () => {
        walkTaskGraph(small, () => {});
    });

    bench("50 tasks", () => {
        walkTaskGraph(medium, () => {});
    });

    bench("200 tasks", () => {
        walkTaskGraph(large, () => {});
    });
});

// ─── Diamond graph (more realistic) ────────────────────────────────

const buildDiamondGraph = (layers: number, breadth: number): TaskGraph => {
    const tasks: TaskGraph["tasks"] = {};
    const dependencies: TaskGraph["dependencies"] = {};

    // Layer 0: leaf tasks
    for (let b = 0; b < breadth; b++) {
        const id = `L0-${b}:build`;

        tasks[id] = {
            id,
            outputs: [],
            overrides: {},
            target: { project: `L0-${b}`, target: "build" },
        };
        dependencies[id] = [];
    }

    // Layers 1..N: each task depends on all tasks in the previous layer
    for (let layer = 1; layer < layers; layer++) {
        for (let b = 0; b < breadth; b++) {
            const id = `L${layer}-${b}:build`;

            tasks[id] = {
                id,
                outputs: [],
                overrides: {},
                target: { project: `L${layer}-${b}`, target: "build" },
            };

            const deps: string[] = [];

            for (let prevB = 0; prevB < breadth; prevB++) {
                deps.push(`L${layer - 1}-${prevB}:build`);
            }

            dependencies[id] = deps;
        }
    }

    const roots = Object.keys(tasks).filter((id) => !Object.values(dependencies).some((deps) => deps.includes(id)));

    return { dependencies, roots, tasks };
};

describe("walkTaskGraph - diamond graph", () => {
    const small = buildDiamondGraph(3, 5); // 15 tasks
    const medium = buildDiamondGraph(5, 10); // 50 tasks
    const large = buildDiamondGraph(5, 40); // 200 tasks

    bench("15 tasks (3×5)", () => {
        walkTaskGraph(small, () => {});
    });

    bench("50 tasks (5×10)", () => {
        walkTaskGraph(medium, () => {});
    });

    bench("200 tasks (5×40)", () => {
        walkTaskGraph(large, () => {});
    });
});

// ─── Cycle detection ────────────────────────────────────────────────

describe("findCycle", () => {
    const acyclic50 = buildTaskGraph(50);
    const acyclic200 = buildTaskGraph(200);

    // Create a cyclic graph
    const cyclic: TaskGraph = {
        dependencies: {
            "a:build": ["b:build"],
            "b:build": ["c:build"],
            "c:build": ["a:build"],
        },
        roots: [],
        tasks: {
            "a:build": { id: "a:build", outputs: [], overrides: {}, target: { project: "a", target: "build" } },
            "b:build": { id: "b:build", outputs: [], overrides: {}, target: { project: "b", target: "build" } },
            "c:build": { id: "c:build", outputs: [], overrides: {}, target: { project: "c", target: "build" } },
        },
    };

    bench("acyclic 50 tasks (no cycle)", () => {
        findCycle(acyclic50);
    });

    bench("acyclic 200 tasks (no cycle)", () => {
        findCycle(acyclic200);
    });

    bench("cyclic 3 tasks", () => {
        findCycle(cyclic);
    });
});

describe("findCycles (find all)", () => {
    const acyclic200 = buildTaskGraph(200);

    bench("acyclic 200 tasks", () => {
        findCycles(acyclic200);
    });
});

// ─── Graph utility operations ───────────────────────────────────────

describe("graph utilities - 200 task graph", () => {
    const graph = buildTaskGraph(200);

    bench("getLeafTasks", () => {
        getLeafTasks(graph);
    });

    bench("getDependentTasks (middle node)", () => {
        getDependentTasks(graph, "pkg-100:build");
    });

    bench("makeAcyclic", () => {
        makeAcyclic(graph);
    });
});

// ─── Graph visualization ────────────────────────────────────────────

describe("graph visualization - 50 tasks", () => {
    const graph = buildTaskGraph(50);

    bench("toGraphvizDot", () => {
        toGraphvizDot(graph);
    });

    bench("toGraphvizDot (grouped by project)", () => {
        toGraphvizDot(graph, { groupByProject: true });
    });

    bench("toGraphJson", () => {
        toGraphJson(graph);
    });

    bench("toGraphAscii", () => {
        toGraphAscii(graph);
    });
});

// ─── Affected filtering ────────────────────────────────────────────

describe("filterAffectedTasks", () => {
    const taskIds200 = Array.from({ length: 200 }, (_, i) => `pkg-${i}:build`);
    const affected10 = new Set(Array.from({ length: 10 }, (_, i) => `pkg-${i * 20}`));
    const affected100 = new Set(Array.from({ length: 100 }, (_, i) => `pkg-${i * 2}`));
    const affectedAll = new Set(Array.from({ length: 200 }, (_, i) => `pkg-${i}`));

    bench("200 tasks, 10 affected", () => {
        filterAffectedTasks(taskIds200, affected10);
    });

    bench("200 tasks, 100 affected", () => {
        filterAffectedTasks(taskIds200, affected100);
    });

    bench("200 tasks, all affected", () => {
        filterAffectedTasks(taskIds200, affectedAll);
    });
});
