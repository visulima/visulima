import { describe, expect, it } from "vitest";

import { projectGraphToDot, toGraphAscii, toGraphHtml, toGraphJson, toGraphvizDot } from "../../src/graph-visualizer";
import type { ProjectGraph, TaskGraph } from "../../src/types";

const createTaskGraph = (): TaskGraph => {
    return {
        dependencies: {
            "app:build": ["lib-a:build", "lib-b:build"],
            "lib-a:build": ["lib-core:build"],
            "lib-b:build": ["lib-core:build"],
            "lib-core:build": [],
        },
        roots: ["app:build"],
        tasks: {
            "app:build": { id: "app:build", outputs: [], overrides: {}, target: { project: "app", target: "build" } },
            "lib-a:build": { id: "lib-a:build", outputs: [], overrides: {}, target: { project: "lib-a", target: "build" } },
            "lib-b:build": { id: "lib-b:build", outputs: [], overrides: {}, target: { project: "lib-b", target: "build" } },
            "lib-core:build": { id: "lib-core:build", outputs: [], overrides: {}, target: { project: "lib-core", target: "build" } },
        },
    };
};

const createProjectGraph = (): ProjectGraph => {
    return {
        dependencies: {
            app: [
                { source: "app", target: "lib-a", type: "static" },
                { source: "app", target: "lib-b", type: "implicit" },
            ],
            "lib-a": [],
            "lib-b": [],
        },
        nodes: {
            app: { data: { root: "apps/app" }, name: "app", type: "application" },
            "lib-a": { data: { root: "packages/lib-a" }, name: "lib-a", type: "library" },
            "lib-b": { data: { root: "packages/lib-b" }, name: "lib-b", type: "library" },
        },
    };
};

describe(toGraphvizDot, () => {
    it("should generate valid DOT output", () => {
        expect.assertions(4);

        const dot = toGraphvizDot(createTaskGraph());

        expect(dot).toContain("digraph TaskGraph");
        expect(dot).toContain('"app:build"');
        expect(dot).toContain('"app:build" -> "lib-a:build"');
        expect(dot).toContain('"app:build" -> "lib-b:build"');
    });

    it("should group by project in subgraphs", () => {
        expect.assertions(2);

        const dot = toGraphvizDot(createTaskGraph(), { groupByProject: true });

        expect(dot).toContain("cluster_app");
        expect(dot).toContain("cluster_lib-a");
    });

    it("should highlight focused tasks", () => {
        expect.assertions(2);

        const dot = toGraphvizDot(createTaskGraph(), {
            focusedTasks: ["app:build", "lib-a:build"],
        });

        // Focused tasks should have non-grey color
        expect(dot).toContain('"app:build"');
        // Non-focused should be grey
        expect(dot).toContain("#eeeeee");
    });

    it("should color nodes by status", () => {
        expect.assertions(3);

        const statuses = new Map([
            ["app:build", "success"],
            ["lib-a:build", "local-cache"],
            ["lib-b:build", "failure"],
        ]);

        const dot = toGraphvizDot(createTaskGraph(), { taskStatuses: statuses as Map<string, "success" | "failure" | "local-cache"> });

        expect(dot).toContain("#90EE90"); // success green
        expect(dot).toContain("#87CEEB"); // cache blue
        expect(dot).toContain("#FFB6C1"); // failure pink
    });
});

describe(toGraphJson, () => {
    it("should export nodes and edges", () => {
        expect.assertions(3);

        const json = toGraphJson(createTaskGraph());

        expect(json.nodes).toHaveLength(4);
        expect(json.edges).toHaveLength(4);
        expect(json.roots).toStrictEqual(["app:build"]);
    });

    it("should include project and target in nodes", () => {
        expect.assertions(2);

        const json = toGraphJson(createTaskGraph());
        const appNode = json.nodes.find((n) => n.id === "app:build");

        expect(appNode?.project).toBe("app");
        expect(appNode?.target).toBe("build");
    });

    it("should include task statuses when provided", () => {
        expect.assertions(1);

        const statuses = new Map([["app:build", "success"]]);
        const json = toGraphJson(createTaskGraph(), statuses);
        const appNode = json.nodes.find((n) => n.id === "app:build");

        expect(appNode?.status).toBe("success");
    });
});

describe(toGraphHtml, () => {
    it("should generate a self-contained HTML page", () => {
        expect.assertions(4);

        const html = toGraphHtml(createTaskGraph());

        expect(html).toContain("<!DOCTYPE html>");
        expect(html).toContain("<svg");
        expect(html).toContain(">4</b> tasks");
        expect(html).toContain(">4</b> dependencies");
    });

    it("should embed the graph data as JSON", () => {
        expect.assertions(2);

        const html = toGraphHtml(createTaskGraph());

        expect(html).toContain('"app:build"');
        expect(html).toContain('"lib-core:build"');
    });
});

describe(toGraphAscii, () => {
    it("should render a tree structure", () => {
        expect.assertions(4);

        const ascii = toGraphAscii(createTaskGraph());

        expect(ascii).toContain("Task Graph (4 tasks, 4 dependencies)");
        expect(ascii).toContain("app:build");
        expect(ascii).toContain("lib-a:build");
        expect(ascii).toContain("lib-core:build");
    });

    it("should mark duplicate nodes with (*)", () => {
        expect.assertions(1);

        const ascii = toGraphAscii(createTaskGraph());

        // lib-core:build appears as dep of both lib-a and lib-b
        expect(ascii).toContain("(*)");
    });

    it("should show status icons", () => {
        expect.assertions(3);

        const statuses = new Map([
            ["app:build", "success"],
            ["lib-a:build", "local-cache"],
            ["lib-b:build", "failure"],
        ]);

        const ascii = toGraphAscii(createTaskGraph(), { taskStatuses: statuses as Map<string, "success" | "failure" | "local-cache"> });

        expect(ascii).toContain("[ok]");
        expect(ascii).toContain("[cache]");
        expect(ascii).toContain("[FAIL]");
    });
});

describe(projectGraphToDot, () => {
    it("should generate DOT for project graph", () => {
        expect.assertions(4);

        const dot = projectGraphToDot(createProjectGraph());

        expect(dot).toContain("digraph ProjectGraph");
        expect(dot).toContain('"app"');
        expect(dot).toContain('"lib-a"');
        expect(dot).toContain('"app" -> "lib-a"');
    });

    it("should use different colors for applications and libraries", () => {
        expect.assertions(2);

        const dot = projectGraphToDot(createProjectGraph());

        expect(dot).toContain("#FFD700"); // application = gold
        expect(dot).toContain("#87CEEB"); // library = blue
    });

    it("should style implicit deps as dashed", () => {
        expect.assertions(2);

        const dot = projectGraphToDot(createProjectGraph());

        expect(dot).toContain("style=dashed");
        expect(dot).toContain("style=solid");
    });
});
