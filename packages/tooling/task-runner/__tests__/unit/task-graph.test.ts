import { describe, expect, it } from "vitest";

import { createTaskGraph, getTaskId, parseTaskId } from "../../src/task-graph";
import type { ProjectGraph, Task, WorkspaceConfiguration } from "../../src/types";

describe(getTaskId, () => {
    it("should create task ID from project and target", () => {
        expect.assertions(1);
        expect(getTaskId({ project: "app", target: "build" })).toBe("app:build");
    });

    it("should include configuration in task ID", () => {
        expect.assertions(1);
        expect(getTaskId({ configuration: "prod", project: "app", target: "build" })).toBe("app:build:prod");
    });
});

describe(parseTaskId, () => {
    it("should parse a basic task ID", () => {
        expect.assertions(3);

        const result = parseTaskId("app:build");

        expect(result.project).toBe("app");
        expect(result.target).toBe("build");
        expect(result.configuration).toBeUndefined();
    });

    it("should parse task ID with configuration", () => {
        expect.assertions(3);

        const result = parseTaskId("app:build:prod");

        expect(result.project).toBe("app");
        expect(result.target).toBe("build");
        expect(result.configuration).toBe("prod");
    });

    it("should throw on invalid task ID", () => {
        expect.assertions(1);
        expect(() => parseTaskId("invalid")).toThrow("Invalid task ID");
    });
});

describe(createTaskGraph, () => {
    const workspace: WorkspaceConfiguration = {
        projects: {
            app: {
                root: "apps/app",
                targets: {
                    build: {
                        command: "vite build",
                        dependsOn: ["^build"],
                    },
                },
            },
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
        },
    };

    const projectGraph: ProjectGraph = {
        dependencies: {
            app: [
                { source: "app", target: "lib-a", type: "static" },
                { source: "app", target: "lib-b", type: "static" },
            ],
            "lib-a": [],
            "lib-b": [{ source: "lib-b", target: "lib-a", type: "static" }],
        },
        nodes: {
            app: { data: workspace.projects["app"]!, name: "app", type: "application" },

            "lib-a": { data: workspace.projects["lib-a"]!, name: "lib-a", type: "library" },

            "lib-b": { data: workspace.projects["lib-b"]!, name: "lib-b", type: "library" },
        },
    };

    it("should create a task graph with dependencies", () => {
        expect.assertions(3);

        const appBuild: Task = {
            id: "app:build",
            outputs: ["apps/app/dist"],
            overrides: {},
            projectRoot: "apps/app",
            target: { project: "app", target: "build" },
        };

        const graph = createTaskGraph([appBuild], { projectGraph, workspace });

        expect(Object.keys(graph.tasks)).toContain("app:build");
        expect(Object.keys(graph.tasks)).toContain("lib-a:build");
        expect(Object.keys(graph.tasks)).toContain("lib-b:build");
    });

    it("should resolve dependency ordering", () => {
        expect.assertions(2);

        const appBuild: Task = {
            id: "app:build",
            outputs: [],
            overrides: {},
            target: { project: "app", target: "build" },
        };

        const graph = createTaskGraph([appBuild], { projectGraph, workspace });

        // app:build depends on lib-a:build and lib-b:build
        expect(graph.dependencies["app:build"]).toContain("lib-a:build");
        expect(graph.dependencies["app:build"]).toContain("lib-b:build");
    });

    it("should handle same-project dependencies", () => {
        expect.assertions(1);

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
            dependencies: { app: [] },
            nodes: {
                app: { data: workspaceWithSelf.projects["app"]!, name: "app", type: "application" },
            },
        };

        const testTask: Task = {
            id: "app:test",
            outputs: [],
            overrides: {},
            target: { project: "app", target: "test" },
        };

        const taskGraph = createTaskGraph([testTask], { projectGraph: graph, workspace: workspaceWithSelf });

        expect(taskGraph.dependencies["app:test"]).toContain("app:build");
    });

    it("should identify root tasks", () => {
        expect.assertions(1);

        const task: Task = {
            id: "lib-a:build",
            outputs: [],
            overrides: {},
            target: { project: "lib-a", target: "build" },
        };

        const graph = createTaskGraph([task], { projectGraph, workspace });

        expect(graph.roots).toContain("lib-a:build");
    });

    it("passes { auto: true } outputs through verbatim and token-replaces string outputs", () => {
        expect.assertions(2);

        const workspaceWithOutputs: WorkspaceConfiguration = {
            projects: {
                app: {
                    root: "apps/app",
                    targets: {
                        build: {
                            command: "vite build",
                            dependsOn: ["^build"],
                        },
                    },
                },
                "lib-a": {
                    root: "packages/lib-a",
                    targets: {
                        build: {
                            command: "tsc",
                            outputs: [{ auto: true }, "{projectRoot}/dist", "{projectName}.tsbuildinfo"],
                        },
                    },
                },
            },
        };

        const graph: ProjectGraph = {
            dependencies: { app: [{ source: "app", target: "lib-a", type: "static" }], "lib-a": [] },
            nodes: {
                app: { data: workspaceWithOutputs.projects["app"]!, name: "app", type: "application" },

                "lib-a": { data: workspaceWithOutputs.projects["lib-a"]!, name: "lib-a", type: "library" },
            },
        };

        const appBuild: Task = {
            id: "app:build",
            outputs: [],
            overrides: {},
            target: { project: "app", target: "build" },
        };

        const taskGraph = createTaskGraph([appBuild], { projectGraph: graph, workspace: workspaceWithOutputs });

        expect(taskGraph.tasks["lib-a:build"]?.outputs).toStrictEqual([{ auto: true }, "packages/lib-a/dist", "lib-a.tsbuildinfo"]);
        expect(taskGraph.tasks["app:build"]?.outputs).toStrictEqual([]);
    });

    it("does not propagate overrides to string-form dependsOn deps", () => {
        expect.assertions(2);

        const task: Task = {
            id: "app:build",
            outputs: [],
            overrides: { visForwardedArgs: ["--filter=foo"] },
            target: { project: "app", target: "build" },
        };

        const graph = createTaskGraph([task], { projectGraph, workspace });

        // Dep tasks are added via "^build" — they must not inherit overrides.
        expect(graph.tasks["lib-a:build"]?.overrides).toStrictEqual({});
        expect(graph.tasks["lib-b:build"]?.overrides).toStrictEqual({});
    });
});
