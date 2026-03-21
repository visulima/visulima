import { describe, it, expect } from "vitest";

import { createTaskGraph, getTaskId, parseTaskId } from "../src/task-graph";
import type { Task, WorkspaceConfiguration, ProjectGraph } from "../src/types";

describe("getTaskId", () => {
    it("should create task ID from project and target", () => {
        expect(getTaskId({ project: "app", target: "build" })).toBe("app:build");
    });

    it("should include configuration in task ID", () => {
        expect(getTaskId({ project: "app", target: "build", configuration: "prod" })).toBe("app:build:prod");
    });
});

describe("parseTaskId", () => {
    it("should parse a basic task ID", () => {
        const result = parseTaskId("app:build");

        expect(result.project).toBe("app");
        expect(result.target).toBe("build");
        expect(result.configuration).toBeUndefined();
    });

    it("should parse task ID with configuration", () => {
        const result = parseTaskId("app:build:prod");

        expect(result.project).toBe("app");
        expect(result.target).toBe("build");
        expect(result.configuration).toBe("prod");
    });

    it("should throw on invalid task ID", () => {
        expect(() => parseTaskId("invalid")).toThrow("Invalid task ID");
    });
});

describe("createTaskGraph", () => {
    const workspace: WorkspaceConfiguration = {
        projects: {
            "lib-a": {
                root: "packages/lib-a",
                targets: {
                    build: { command: "tsc" },
                },
            },
            "lib-b": {
                root: "packages/lib-b",
                targets: {
                    build: {
                        command: "tsc",
                        dependsOn: ["^build"],
                    },
                },
            },
            app: {
                root: "apps/app",
                targets: {
                    build: {
                        command: "vite build",
                        dependsOn: ["^build"],
                    },
                },
            },
        },
    };

    const projectGraph: ProjectGraph = {
        nodes: {
            "lib-a": { name: "lib-a", type: "library", data: workspace.projects["lib-a"]! },
            "lib-b": { name: "lib-b", type: "library", data: workspace.projects["lib-b"]! },
            app: { name: "app", type: "application", data: workspace.projects["app"]! },
        },
        dependencies: {
            "lib-a": [],
            "lib-b": [{ source: "lib-b", target: "lib-a", type: "static" }],
            app: [
                { source: "app", target: "lib-a", type: "static" },
                { source: "app", target: "lib-b", type: "static" },
            ],
        },
    };

    it("should create a task graph with dependencies", () => {
        const appBuild: Task = {
            id: "app:build",
            target: { project: "app", target: "build" },
            overrides: {},
            outputs: ["apps/app/dist"],
            projectRoot: "apps/app",
        };

        const graph = createTaskGraph([appBuild], { workspace, projectGraph });

        expect(Object.keys(graph.tasks)).toContain("app:build");
        expect(Object.keys(graph.tasks)).toContain("lib-a:build");
        expect(Object.keys(graph.tasks)).toContain("lib-b:build");
    });

    it("should resolve dependency ordering", () => {
        const appBuild: Task = {
            id: "app:build",
            target: { project: "app", target: "build" },
            overrides: {},
            outputs: [],
        };

        const graph = createTaskGraph([appBuild], { workspace, projectGraph });

        // app:build depends on lib-a:build and lib-b:build
        expect(graph.dependencies["app:build"]).toContain("lib-a:build");
        expect(graph.dependencies["app:build"]).toContain("lib-b:build");
    });

    it("should handle same-project dependencies", () => {
        const workspaceWithSelf: WorkspaceConfiguration = {
            projects: {
                app: {
                    root: "apps/app",
                    targets: {
                        build: { command: "tsc" },
                        test: {
                            command: "vitest",
                            dependsOn: ["build"],
                        },
                    },
                },
            },
        };

        const graph: ProjectGraph = {
            nodes: {
                app: { name: "app", type: "application", data: workspaceWithSelf.projects["app"]! },
            },
            dependencies: { app: [] },
        };

        const testTask: Task = {
            id: "app:test",
            target: { project: "app", target: "test" },
            overrides: {},
            outputs: [],
        };

        const taskGraph = createTaskGraph([testTask], { workspace: workspaceWithSelf, projectGraph: graph });

        expect(taskGraph.dependencies["app:test"]).toContain("app:build");
    });

    it("should identify root tasks", () => {
        const task: Task = {
            id: "lib-a:build",
            target: { project: "lib-a", target: "build" },
            overrides: {},
            outputs: [],
        };

        const graph = createTaskGraph([task], { workspace, projectGraph });

        expect(graph.roots).toContain("lib-a:build");
    });
});
