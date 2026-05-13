import { describe, expect, it } from "vitest";

import { enforceProjectConstraints } from "../../src/project-constraints";
import type { ConstraintsConfig, ProjectGraph } from "../../src/types";

const makeGraph = (overrides?: Partial<ProjectGraph>): ProjectGraph => {
    return {
        dependencies: {
            app: [{ source: "app", target: "lib-ui", type: "static" }],
            "lib-api": [{ source: "lib-api", target: "lib-shared", type: "static" }],
            "lib-shared": [],
            "lib-ui": [
                { source: "lib-ui", target: "lib-shared", type: "static" },
                { source: "lib-ui", target: "lib-api", type: "static" },
            ],
        },
        nodes: {
            app: { data: { root: "packages/app", tags: ["frontend"] }, name: "app", type: "application" },
            "lib-api": { data: { root: "packages/lib-api", tags: ["backend", "shared"] }, name: "lib-api", type: "library" },
            "lib-shared": { data: { root: "packages/lib-shared", tags: ["shared"] }, name: "lib-shared", type: "library" },
            "lib-ui": { data: { root: "packages/lib-ui", tags: ["frontend"] }, name: "lib-ui", type: "library" },
        },
        ...overrides,
    };
};

describe(enforceProjectConstraints, () => {
    describe("no constraints", () => {
        it("should return no violations when constraints are empty", () => {
            expect.assertions(1);

            const violations = enforceProjectConstraints(makeGraph(), {});

            expect(violations).toStrictEqual([]);
        });

        it("should return no violations when no tag relationships or type boundaries are set", () => {
            expect.assertions(1);

            const violations = enforceProjectConstraints(makeGraph(), {
                tagRelationships: {},
            });

            expect(violations).toStrictEqual([]);
        });
    });

    describe("tag relationships", () => {
        it("should detect tag relationship violations", () => {
            expect.assertions(1);

            const constraints: ConstraintsConfig = {
                tagRelationships: {
                    // frontend projects can only depend on frontend or shared
                    frontend: ["frontend", "shared"],
                },
            };

            const violations = enforceProjectConstraints(makeGraph(), constraints);

            // lib-ui (frontend) depends on lib-api (backend, shared) — should pass because lib-api has "shared"
            // All other deps should pass
            expect(violations).toHaveLength(0);
        });

        it("should report violation when dependency lacks required tags", () => {
            expect.assertions(4);

            const graph = makeGraph();

            // Remove "shared" tag from lib-api so it only has "backend"
            graph.nodes["lib-api"] = {
                data: { root: "packages/lib-api", tags: ["backend"] },
                name: "lib-api",
                type: "library",
            };

            const constraints: ConstraintsConfig = {
                tagRelationships: {
                    frontend: ["frontend", "shared"],
                },
            };

            const violations = enforceProjectConstraints(graph, constraints);

            // lib-ui (frontend) → lib-api (backend only) — violation
            expect(violations).toHaveLength(1);
            expect(violations[0]?.rule).toBe("tag-relationship");
            expect(violations[0]?.sourceProject).toBe("lib-ui");
            expect(violations[0]?.dependencyProject).toBe("lib-api");
        });

        it("should not apply tag rules to projects without the source tag", () => {
            expect.assertions(1);

            const constraints: ConstraintsConfig = {
                tagRelationships: {
                    // Only "admin" tagged projects have restrictions
                    admin: ["admin"],
                },
            };

            // No project has "admin" tag, so no violations
            const violations = enforceProjectConstraints(makeGraph(), constraints);

            expect(violations).toHaveLength(0);
        });

        it("should handle projects with no tags", () => {
            expect.assertions(1);

            const graph = makeGraph();

            graph.nodes["lib-notags"] = {
                data: { root: "packages/lib-notags" }, // no tags
                name: "lib-notags",
                type: "library",
            };
            graph.dependencies["lib-notags"] = [{ source: "lib-notags", target: "lib-shared", type: "static" }];

            const constraints: ConstraintsConfig = {
                tagRelationships: {
                    frontend: ["frontend", "shared"],
                },
            };

            const violations = enforceProjectConstraints(graph, constraints);

            // lib-notags has no tags, so tag relationships don't apply to it
            expect(violations).toHaveLength(0);
        });

        it("should report violation when dependency has no tags but source requires them", () => {
            expect.assertions(3);

            const graph = makeGraph();

            graph.nodes["lib-notags"] = {
                data: { root: "packages/lib-notags" }, // no tags
                name: "lib-notags",
                type: "library",
            };
            // frontend project depends on untagged project
            graph.dependencies.app = [{ source: "app", target: "lib-notags", type: "static" }];

            const constraints: ConstraintsConfig = {
                tagRelationships: {
                    frontend: ["frontend", "shared"],
                },
            };

            const violations = enforceProjectConstraints(graph, constraints);

            // app (frontend) → lib-notags (no tags) — violation
            expect(violations).toHaveLength(1);
            expect(violations[0]?.sourceProject).toBe("app");
            expect(violations[0]?.dependencyProject).toBe("lib-notags");
        });

        it("should check multiple source tags independently", () => {
            expect.assertions(1);

            const graph: ProjectGraph = {
                dependencies: {
                    dep: [],
                    multi: [{ source: "multi", target: "dep", type: "static" }],
                },
                nodes: {
                    dep: { data: { root: "packages/dep", tags: ["shared"] }, name: "dep", type: "library" },
                    multi: { data: { root: "packages/multi", tags: ["frontend", "backend"] }, name: "multi", type: "library" },
                },
            };

            const constraints: ConstraintsConfig = {
                tagRelationships: {
                    backend: ["backend", "shared"],
                    frontend: ["frontend", "shared"],
                },
            };

            // dep has "shared" → satisfies both frontend and backend rules
            const violations = enforceProjectConstraints(graph, constraints);

            expect(violations).toHaveLength(0);
        });
    });

    describe("type boundaries", () => {
        it("should detect application boundary violations", () => {
            expect.assertions(4);

            const graph = makeGraph();

            // Make lib-ui depend on app (which is an application)
            graph.dependencies["lib-ui"] = [...graph.dependencies["lib-ui"]!, { source: "lib-ui", target: "app", type: "static" }];

            const constraints: ConstraintsConfig = {
                typeBoundaries: {
                    enforceApplicationBoundary: true,
                },
            };

            const violations = enforceProjectConstraints(graph, constraints);

            expect(violations).toHaveLength(1);
            expect(violations[0]?.rule).toBe("type-boundary");
            expect(violations[0]?.sourceProject).toBe("lib-ui");
            expect(violations[0]?.dependencyProject).toBe("app");
        });

        it("should enforce application boundary by default", () => {
            expect.assertions(1);

            const graph = makeGraph();

            graph.dependencies["lib-ui"] = [...graph.dependencies["lib-ui"]!, { source: "lib-ui", target: "app", type: "static" }];

            // typeBoundaries present but enforceApplicationBoundary not explicitly set
            const violations = enforceProjectConstraints(graph, {
                typeBoundaries: {},
            });

            // enforceApplicationBoundary defaults to true
            expect(violations).toHaveLength(1);
        });

        it("should skip application boundary when disabled", () => {
            expect.assertions(1);

            const graph = makeGraph();

            graph.dependencies["lib-ui"] = [...graph.dependencies["lib-ui"]!, { source: "lib-ui", target: "app", type: "static" }];

            const violations = enforceProjectConstraints(graph, {
                typeBoundaries: {
                    enforceApplicationBoundary: false,
                },
            });

            expect(violations).toHaveLength(0);
        });

        it("should treat service and tool projects as deployment targets under enforceApplicationBoundary", () => {
            expect.assertions(4);

            const graph: ProjectGraph = {
                dependencies: {
                    cli: [],
                    "lib-a": [{ source: "lib-a", target: "svc", type: "static" }],
                    "lib-b": [{ source: "lib-b", target: "cli", type: "static" }],
                    svc: [],
                },
                nodes: {
                    cli: { data: { root: "tools/cli" }, name: "cli", type: "tool" },
                    "lib-a": { data: { root: "packages/lib-a" }, name: "lib-a", type: "library" },
                    "lib-b": { data: { root: "packages/lib-b" }, name: "lib-b", type: "library" },
                    svc: { data: { root: "services/svc" }, name: "svc", type: "service" },
                },
            };

            const violations = enforceProjectConstraints(graph, {
                typeBoundaries: { enforceApplicationBoundary: true },
            });

            expect(violations).toHaveLength(2);
            expect(violations.map((v) => v.dependencyProject).sort()).toStrictEqual(["cli", "svc"]);
            expect(violations.every((v) => v.rule === "type-boundary")).toBe(true);
            // Message references the actual deployment-target type, not just "application".
            expect(violations.find((v) => v.dependencyProject === "svc")?.message).toContain("service");
        });

        it("should enforce custom allowedDependencyTypes", () => {
            expect.assertions(1);

            const constraints: ConstraintsConfig = {
                typeBoundaries: {
                    // applications can only depend on libraries
                    allowedDependencyTypes: {
                        application: ["library"],
                    },
                    enforceApplicationBoundary: false, // disable default check
                },
            };

            // app (application) → lib-ui (library) — should pass
            const violations = enforceProjectConstraints(makeGraph(), constraints);

            expect(violations).toHaveLength(0);
        });

        it("should report custom type boundary violation", () => {
            expect.assertions(2);

            const graph: ProjectGraph = {
                dependencies: {
                    app1: [{ source: "app1", target: "app2", type: "static" }],
                    app2: [],
                },
                nodes: {
                    app1: { data: { root: "packages/app1" }, name: "app1", type: "application" },
                    app2: { data: { root: "packages/app2" }, name: "app2", type: "application" },
                },
            };

            const constraints: ConstraintsConfig = {
                typeBoundaries: {
                    allowedDependencyTypes: {
                        application: ["library"],
                    },
                    enforceApplicationBoundary: false,
                },
            };

            const violations = enforceProjectConstraints(graph, constraints);

            // app1 (application) → app2 (application) — violation because only "library" allowed
            expect(violations).toHaveLength(1);
            expect(violations[0]?.rule).toBe("type-boundary");
        });
    });

    describe("combined constraints", () => {
        it("should report both tag and type violations", () => {
            expect.assertions(3);

            const graph = makeGraph();

            // lib-ui depends on app (application boundary violation)
            graph.dependencies["lib-ui"] = [...graph.dependencies["lib-ui"]!, { source: "lib-ui", target: "app", type: "static" }];

            // Remove "shared" from lib-api (tag violation)
            graph.nodes["lib-api"] = {
                data: { root: "packages/lib-api", tags: ["backend"] },
                name: "lib-api",
                type: "library",
            };

            const constraints: ConstraintsConfig = {
                tagRelationships: {
                    frontend: ["frontend", "shared"],
                },
                typeBoundaries: {
                    enforceApplicationBoundary: true,
                },
            };

            const violations = enforceProjectConstraints(graph, constraints);

            // 1. lib-ui (frontend) → lib-api (backend) — tag violation
            // 2. lib-ui → app — type boundary violation
            const tagViolations = violations.filter((v) => v.rule === "tag-relationship");
            const typeViolations = violations.filter((v) => v.rule === "type-boundary");

            expect(tagViolations).toHaveLength(1);
            expect(typeViolations).toHaveLength(1);
            expect(violations).toHaveLength(2);
        });
    });

    describe("edge cases", () => {
        it("should handle empty graph", () => {
            expect.assertions(1);

            const graph: ProjectGraph = { dependencies: {}, nodes: {} };

            const violations = enforceProjectConstraints(graph, {
                tagRelationships: { frontend: ["shared"] },
                typeBoundaries: { enforceApplicationBoundary: true },
            });

            expect(violations).toStrictEqual([]);
        });

        it("should handle self-dependency edges", () => {
            expect.assertions(1);

            const graph: ProjectGraph = {
                dependencies: {
                    a: [{ source: "a", target: "a", type: "static" }],
                },
                nodes: {
                    a: { data: { root: "packages/a", tags: ["frontend"] }, name: "a", type: "library" },
                },
            };

            const violations = enforceProjectConstraints(graph, {
                tagRelationships: { frontend: ["frontend"] },
                typeBoundaries: { enforceApplicationBoundary: true },
            });

            // Self-dependency: "a" (frontend) depends on "a" (frontend) — tag check passes
            // "a" is a library, not application — type boundary passes
            expect(violations).toHaveLength(0);
        });

        it("should not produce duplicate violations for application boundary + allowedDependencyTypes", () => {
            expect.assertions(2);

            const graph: ProjectGraph = {
                dependencies: {
                    app: [],
                    lib: [{ source: "lib", target: "app", type: "static" }],
                },
                nodes: {
                    app: { data: { root: "packages/app" }, name: "app", type: "application" },
                    lib: { data: { root: "packages/lib" }, name: "lib", type: "library" },
                },
            };

            const violations = enforceProjectConstraints(graph, {
                typeBoundaries: {
                    allowedDependencyTypes: { library: ["library"] },
                    enforceApplicationBoundary: true,
                },
            });

            // lib → app: should produce only ONE violation (application boundary), not two
            expect(violations).toHaveLength(1);
            expect(violations[0]?.message).toContain("application");
        });

        it("should handle missing dependency nodes gracefully", () => {
            expect.assertions(1);

            const graph: ProjectGraph = {
                dependencies: {
                    a: [{ source: "a", target: "nonexistent", type: "static" }],
                },
                nodes: {
                    a: { data: { root: "packages/a", tags: ["frontend"] }, name: "a", type: "library" },
                },
            };

            const violations = enforceProjectConstraints(graph, {
                tagRelationships: { frontend: ["shared"] },
            });

            // nonexistent node is skipped, not an error
            expect(violations).toStrictEqual([]);
        });
    });

    describe("dependency kind rules", () => {
        it("should detect production dependency on application", () => {
            expect.assertions(3);

            const graph: ProjectGraph = {
                dependencies: {
                    app: [],
                    lib: [{ source: "lib", target: "app", type: "static" }],
                },
                nodes: {
                    app: { data: { root: "packages/app" }, name: "app", type: "application" },
                    lib: { data: { root: "packages/lib" }, name: "lib", type: "library" },
                },
            };

            const violations = enforceProjectConstraints(graph, {
                dependencyKindRules: { noProductionDependencyOnApplication: true },
            });

            expect(violations).toHaveLength(1);
            expect(violations[0]?.rule).toBe("dependency-kind");
            expect(violations[0]?.message).toContain("production dependency");
        });

        it("should allow devDependency on application when noProductionDependencyOnApplication is set", () => {
            expect.assertions(1);

            const graph: ProjectGraph = {
                dependencies: {
                    app: [],
                    lib: [{ source: "lib", target: "app", type: "devDependency" }],
                },
                nodes: {
                    app: { data: { root: "packages/app" }, name: "app", type: "application" },
                    lib: { data: { root: "packages/lib" }, name: "lib", type: "library" },
                },
            };

            const violations = enforceProjectConstraints(graph, {
                dependencyKindRules: { noProductionDependencyOnApplication: true },
            });

            expect(violations).toHaveLength(0);
        });

        it("should detect devDependency that duplicates a production dependency", () => {
            expect.assertions(3);

            const graph: ProjectGraph = {
                dependencies: {
                    lib: [
                        { source: "lib", target: "shared", type: "static" },
                        { source: "lib", target: "shared", type: "devDependency" },
                    ],
                    shared: [],
                },
                nodes: {
                    lib: { data: { root: "packages/lib" }, name: "lib", type: "library" },
                    shared: { data: { root: "packages/shared" }, name: "shared", type: "library" },
                },
            };

            const violations = enforceProjectConstraints(graph, {
                dependencyKindRules: { noDevDependencyOnProductionDep: true },
            });

            expect(violations).toHaveLength(1);
            expect(violations[0]?.rule).toBe("dependency-kind");
            expect(violations[0]?.message).toContain("both dependencies and devDependencies");
        });

        it("should not flag devDependency that is not also a production dependency", () => {
            expect.assertions(1);

            const graph: ProjectGraph = {
                dependencies: {
                    lib: [{ source: "lib", target: "test-utils", type: "devDependency" }],
                    "test-utils": [],
                },
                nodes: {
                    lib: { data: { root: "packages/lib" }, name: "lib", type: "library" },
                    "test-utils": { data: { root: "packages/test-utils" }, name: "test-utils", type: "library" },
                },
            };

            const violations = enforceProjectConstraints(graph, {
                dependencyKindRules: { noDevDependencyOnProductionDep: true },
            });

            expect(violations).toHaveLength(0);
        });

        it("should only apply noDevDependencyOnProductionDep to library projects", () => {
            expect.assertions(1);

            const graph: ProjectGraph = {
                dependencies: {
                    app: [
                        { source: "app", target: "shared", type: "static" },
                        { source: "app", target: "shared", type: "devDependency" },
                    ],
                    shared: [],
                },
                nodes: {
                    app: { data: { root: "packages/app" }, name: "app", type: "application" },
                    shared: { data: { root: "packages/shared" }, name: "shared", type: "library" },
                },
            };

            const violations = enforceProjectConstraints(graph, {
                dependencyKindRules: { noDevDependencyOnProductionDep: true },
            });

            // Application projects are not checked for this rule
            expect(violations).toHaveLength(0);
        });

        it("should return no violations when no dependency kind rules are set", () => {
            expect.assertions(1);

            const graph: ProjectGraph = {
                dependencies: {
                    app: [],
                    lib: [{ source: "lib", target: "app", type: "static" }],
                },
                nodes: {
                    app: { data: { root: "packages/app" }, name: "app", type: "application" },
                    lib: { data: { root: "packages/lib" }, name: "lib", type: "library" },
                },
            };

            const violations = enforceProjectConstraints(graph, {
                dependencyKindRules: {},
            });

            expect(violations).toHaveLength(0);
        });
    });
});
