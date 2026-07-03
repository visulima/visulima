import { describe, expect, it } from "vitest";

import { expandAffected, filterAffectedTasks } from "../../src/affected";
import type { ProjectGraph } from "../../src/types";

describe(filterAffectedTasks, () => {
    it("should filter tasks to only affected projects", () => {
        expect.assertions(1);

        const taskIds = ["app:build", "lib-a:build", "lib-b:build", "lib-c:build"];
        const affected = new Set(["app", "lib-a"]);

        const filtered = filterAffectedTasks(taskIds, affected);

        expect(filtered).toStrictEqual(["app:build", "lib-a:build"]);
    });

    it("should return empty when no tasks are affected", () => {
        expect.assertions(1);

        const taskIds = ["lib-c:build"];
        const affected = new Set(["app"]);

        const filtered = filterAffectedTasks(taskIds, affected);

        expect(filtered).toStrictEqual([]);
    });

    it("should return all tasks when all projects are affected", () => {
        expect.assertions(1);

        const taskIds = ["a:build", "b:test"];
        const affected = new Set(["a", "b"]);

        const filtered = filterAffectedTasks(taskIds, affected);

        expect(filtered).toStrictEqual(["a:build", "b:test"]);
    });

    it("should return empty array for empty taskIds", () => {
        expect.assertions(1);

        const filtered = filterAffectedTasks([], new Set(["app"]));

        expect(filtered).toStrictEqual([]);
    });

    it("should return empty array for empty affected set", () => {
        expect.assertions(1);

        const filtered = filterAffectedTasks(["app:build", "lib:test"], new Set());

        expect(filtered).toStrictEqual([]);
    });

    it("should not match task IDs without a colon separator", () => {
        expect.assertions(1);

        const filtered = filterAffectedTasks(["build"], new Set(["build"]));

        expect(filtered).toStrictEqual(["build"]);
    });
});

/**
 * Graph topology used in scope tests:
 *
 *   A depends on B
 *   B depends on C
 *   C depends on D
 *
 * So the dependency chain is: A → B → C → D
 * (A is the "top" consumer, D is the "bottom" library)
 *
 * Downstream (dependents): D ← C ← B ← A
 * Upstream (dependencies):  A → B → C → D
 */
const makeLinearGraph = (): ProjectGraph => {
    return {
        dependencies: {
            A: [{ source: "A", target: "B", type: "static" }],
            B: [{ source: "B", target: "C", type: "static" }],
            C: [{ source: "C", target: "D", type: "static" }],
            D: [],
        },
        nodes: {
            A: { data: { root: "packages/a" }, name: "A", type: "application" },
            B: { data: { root: "packages/b" }, name: "B", type: "library" },
            C: { data: { root: "packages/c" }, name: "C", type: "library" },
            D: { data: { root: "packages/d" }, name: "D", type: "library" },
        },
    };
};

describe(expandAffected, () => {
    describe("downstream scope", () => {
        it("should include all transitive dependents with downstream=deep", () => {
            expect.assertions(3);

            const graph = makeLinearGraph();
            const changed = new Set(["C"]);

            const result = expandAffected(changed, graph, { downstream: "deep", upstream: "none" });

            expect([...result.affected].sort()).toStrictEqual(["A", "B", "C"]);
            expect([...result.downstream].sort()).toStrictEqual(["A", "B"]);
            expect([...result.upstream]).toStrictEqual([]);
        });

        it("should include only direct dependents with downstream=direct", () => {
            expect.assertions(2);

            const graph = makeLinearGraph();
            const changed = new Set(["C"]);

            const result = expandAffected(changed, graph, { downstream: "direct", upstream: "none" });

            expect([...result.affected].sort()).toStrictEqual(["B", "C"]);
            expect([...result.downstream]).toStrictEqual(["B"]);
        });

        it("should include no dependents with downstream=none", () => {
            expect.assertions(2);

            const graph = makeLinearGraph();
            const changed = new Set(["C"]);

            const result = expandAffected(changed, graph, { downstream: "none", upstream: "none" });

            expect([...result.affected]).toStrictEqual(["C"]);
            expect([...result.downstream]).toStrictEqual([]);
        });
    });

    describe("upstream scope", () => {
        it("should include all transitive dependencies with upstream=deep", () => {
            expect.assertions(3);

            const graph = makeLinearGraph();
            const changed = new Set(["B"]);

            const result = expandAffected(changed, graph, { downstream: "none", upstream: "deep" });

            expect([...result.affected].sort()).toStrictEqual(["B", "C", "D"]);
            expect([...result.upstream].sort()).toStrictEqual(["C", "D"]);
            expect([...result.downstream]).toStrictEqual([]);
        });

        it("should include only direct dependencies with upstream=direct", () => {
            expect.assertions(2);

            const graph = makeLinearGraph();
            const changed = new Set(["B"]);

            const result = expandAffected(changed, graph, { downstream: "none", upstream: "direct" });

            expect([...result.affected].sort()).toStrictEqual(["B", "C"]);
            expect([...result.upstream]).toStrictEqual(["C"]);
        });

        it("should include no dependencies with upstream=none", () => {
            expect.assertions(2);

            const graph = makeLinearGraph();
            const changed = new Set(["B"]);

            const result = expandAffected(changed, graph, { downstream: "none", upstream: "none" });

            expect([...result.affected]).toStrictEqual(["B"]);
            expect([...result.upstream]).toStrictEqual([]);
        });
    });

    describe("combined scopes", () => {
        it("should include both directions with deep/deep", () => {
            expect.assertions(3);

            const graph = makeLinearGraph();
            const changed = new Set(["B"]);

            const result = expandAffected(changed, graph, { downstream: "deep", upstream: "deep" });

            expect([...result.affected].sort()).toStrictEqual(["A", "B", "C", "D"]);
            expect([...result.downstream]).toStrictEqual(["A"]);
            expect([...result.upstream].sort()).toStrictEqual(["C", "D"]);
        });

        it("should include both directions with direct/direct", () => {
            expect.assertions(3);

            const graph = makeLinearGraph();
            const changed = new Set(["B"]);

            const result = expandAffected(changed, graph, { downstream: "direct", upstream: "direct" });

            expect([...result.affected].sort()).toStrictEqual(["A", "B", "C"]);
            expect([...result.downstream]).toStrictEqual(["A"]);
            expect([...result.upstream]).toStrictEqual(["C"]);
        });
    });

    describe("edge cases", () => {
        it("should handle leaf project with no dependents", () => {
            expect.assertions(2);

            const graph = makeLinearGraph();
            const changed = new Set(["A"]);

            const result = expandAffected(changed, graph, { downstream: "deep", upstream: "none" });

            // A has no dependents
            expect([...result.affected]).toStrictEqual(["A"]);
            expect([...result.downstream]).toStrictEqual([]);
        });

        it("should handle root project with no dependencies", () => {
            expect.assertions(2);

            const graph = makeLinearGraph();
            const changed = new Set(["D"]);

            const result = expandAffected(changed, graph, { downstream: "none", upstream: "deep" });

            // D has no dependencies
            expect([...result.affected]).toStrictEqual(["D"]);
            expect([...result.upstream]).toStrictEqual([]);
        });

        it("should handle multiple changed projects", () => {
            expect.assertions(2);

            const graph = makeLinearGraph();
            const changed = new Set(["B", "D"]);

            const result = expandAffected(changed, graph, { downstream: "direct", upstream: "none" });

            // B's direct dependent is A, D's direct dependent is C
            expect([...result.affected].sort()).toStrictEqual(["A", "B", "C", "D"]);
            expect([...result.downstream].sort()).toStrictEqual(["A", "C"]);
        });

        it("should handle diamond dependency graph", () => {
            expect.assertions(1);

            const graph: ProjectGraph = {
                dependencies: {
                    A: [
                        { source: "A", target: "B", type: "static" },
                        { source: "A", target: "C", type: "static" },
                    ],
                    B: [{ source: "B", target: "D", type: "static" }],
                    C: [{ source: "C", target: "D", type: "static" }],
                    D: [],
                },
                nodes: {
                    A: { data: { root: "packages/a" }, name: "A", type: "application" },
                    B: { data: { root: "packages/b" }, name: "B", type: "library" },
                    C: { data: { root: "packages/c" }, name: "C", type: "library" },
                    D: { data: { root: "packages/d" }, name: "D", type: "library" },
                },
            };

            // Change D, downstream=deep should reach A through both B and C
            const changed = new Set(["D"]);
            const result = expandAffected(changed, graph, { downstream: "deep", upstream: "none" });

            expect([...result.affected].sort()).toStrictEqual(["A", "B", "C", "D"]);
        });

        it("should handle empty graph", () => {
            expect.assertions(1);

            const graph: ProjectGraph = { dependencies: {}, nodes: {} };
            const changed = new Set(["X"]);

            const result = expandAffected(changed, graph, { downstream: "deep", upstream: "deep" });

            expect([...result.affected]).toStrictEqual(["X"]);
        });
    });

    describe("cycle handling", () => {
        it("should terminate and not infinite-loop on cyclic graphs", () => {
            expect.assertions(1);

            const graph: ProjectGraph = {
                dependencies: {
                    A: [{ source: "A", target: "B", type: "static" }],
                    B: [{ source: "B", target: "C", type: "static" }],
                    C: [{ source: "C", target: "A", type: "static" }], // cycle: A → B → C → A
                },
                nodes: {
                    A: { data: { root: "packages/a" }, name: "A", type: "library" },
                    B: { data: { root: "packages/b" }, name: "B", type: "library" },
                    C: { data: { root: "packages/c" }, name: "C", type: "library" },
                },
            };

            const changed = new Set(["A"]);
            const result = expandAffected(changed, graph, { downstream: "deep", upstream: "deep" });

            // Should include all nodes without hanging
            expect([...result.affected].sort()).toStrictEqual(["A", "B", "C"]);
        });
    });

    describe("backward compatibility", () => {
        it("should match previous behavior with default scopes (downstream=deep, upstream=none)", () => {
            expect.assertions(1);

            const graph = makeLinearGraph();
            const changed = new Set(["C"]);

            const result = expandAffected(changed, graph, { downstream: "deep", upstream: "none" });

            // Previous behavior: C changed, BFS through reverse deps finds B then A
            expect([...result.affected].sort()).toStrictEqual(["A", "B", "C"]);
        });
    });
});
