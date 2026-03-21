import { describe, it, expect } from "vitest";

import {
    toGraphvizDot,
    toGraphJson,
    toGraphHtml,
    toGraphAscii,
    projectGraphToDot,
} from "../src/graph-visualizer";
import type { TaskGraph, ProjectGraph } from "../src/types";

const createTaskGraph = (): TaskGraph => ({
    roots: ["app:build"],
    tasks: {
        "app:build": { id: "app:build", target: { project: "app", target: "build" }, overrides: {}, outputs: [] },
        "lib-a:build": { id: "lib-a:build", target: { project: "lib-a", target: "build" }, overrides: {}, outputs: [] },
        "lib-b:build": { id: "lib-b:build", target: { project: "lib-b", target: "build" }, overrides: {}, outputs: [] },
        "lib-core:build": { id: "lib-core:build", target: { project: "lib-core", target: "build" }, overrides: {}, outputs: [] },
    },
    dependencies: {
        "app:build": ["lib-a:build", "lib-b:build"],
        "lib-a:build": ["lib-core:build"],
        "lib-b:build": ["lib-core:build"],
        "lib-core:build": [],
    },
});

const createProjectGraph = (): ProjectGraph => ({
    nodes: {
        app: { name: "app", type: "application", data: { root: "apps/app" } },
        "lib-a": { name: "lib-a", type: "library", data: { root: "packages/lib-a" } },
        "lib-b": { name: "lib-b", type: "library", data: { root: "packages/lib-b" } },
    },
    dependencies: {
        app: [
            { source: "app", target: "lib-a", type: "static" },
            { source: "app", target: "lib-b", type: "implicit" },
        ],
        "lib-a": [],
        "lib-b": [],
    },
});

describe("toGraphvizDot", () => {
    it("should generate valid DOT output", () => {
        const dot = toGraphvizDot(createTaskGraph());

        expect(dot).toContain("digraph TaskGraph");
        expect(dot).toContain('"app:build"');
        expect(dot).toContain('"app:build" -> "lib-a:build"');
        expect(dot).toContain('"app:build" -> "lib-b:build"');
    });

    it("should group by project in subgraphs", () => {
        const dot = toGraphvizDot(createTaskGraph(), { groupByProject: true });

        expect(dot).toContain('cluster_app');
        expect(dot).toContain('cluster_lib-a');
    });

    it("should highlight focused tasks", () => {
        const dot = toGraphvizDot(createTaskGraph(), {
            focusedTasks: ["app:build", "lib-a:build"],
        });

        // Focused tasks should have non-grey color
        expect(dot).toContain('"app:build"');
        // Non-focused should be grey
        expect(dot).toContain('#eeeeee');
    });

    it("should color nodes by status", () => {
        const statuses = new Map([
            ["app:build", "success"],
            ["lib-a:build", "local-cache"],
            ["lib-b:build", "failure"],
        ]);

        const dot = toGraphvizDot(createTaskGraph(), { taskStatuses: statuses as any });

        expect(dot).toContain("#90EE90"); // success green
        expect(dot).toContain("#87CEEB"); // cache blue
        expect(dot).toContain("#FFB6C1"); // failure pink
    });
});

describe("toGraphJson", () => {
    it("should export nodes and edges", () => {
        const json = toGraphJson(createTaskGraph());

        expect(json.nodes).toHaveLength(4);
        expect(json.edges).toHaveLength(4);
        expect(json.roots).toEqual(["app:build"]);
    });

    it("should include project and target in nodes", () => {
        const json = toGraphJson(createTaskGraph());
        const appNode = json.nodes.find((n) => n.id === "app:build");

        expect(appNode?.project).toBe("app");
        expect(appNode?.target).toBe("build");
    });

    it("should include task statuses when provided", () => {
        const statuses = new Map([["app:build", "success"]]);
        const json = toGraphJson(createTaskGraph(), statuses);
        const appNode = json.nodes.find((n) => n.id === "app:build");

        expect(appNode?.status).toBe("success");
    });
});

describe("toGraphHtml", () => {
    it("should generate a self-contained HTML page", () => {
        const html = toGraphHtml(createTaskGraph());

        expect(html).toContain("<!DOCTYPE html>");
        expect(html).toContain("<svg");
        expect(html).toContain(">4</b> tasks");
        expect(html).toContain(">4</b> dependencies");
    });

    it("should embed the graph data as JSON", () => {
        const html = toGraphHtml(createTaskGraph());

        expect(html).toContain('"app:build"');
        expect(html).toContain('"lib-core:build"');
    });
});

describe("toGraphAscii", () => {
    it("should render a tree structure", () => {
        const ascii = toGraphAscii(createTaskGraph());

        expect(ascii).toContain("Task Graph (4 tasks, 4 dependencies)");
        expect(ascii).toContain("app:build");
        expect(ascii).toContain("lib-a:build");
        expect(ascii).toContain("lib-core:build");
    });

    it("should mark duplicate nodes with (*)", () => {
        const ascii = toGraphAscii(createTaskGraph());

        // lib-core:build appears as dep of both lib-a and lib-b
        expect(ascii).toContain("(*)");
    });

    it("should show status icons", () => {
        const statuses = new Map([
            ["app:build", "success"],
            ["lib-a:build", "local-cache"],
            ["lib-b:build", "failure"],
        ]);

        const ascii = toGraphAscii(createTaskGraph(), { taskStatuses: statuses as any });

        expect(ascii).toContain("[ok]");
        expect(ascii).toContain("[cache]");
        expect(ascii).toContain("[FAIL]");
    });
});

describe("projectGraphToDot", () => {
    it("should generate DOT for project graph", () => {
        const dot = projectGraphToDot(createProjectGraph());

        expect(dot).toContain("digraph ProjectGraph");
        expect(dot).toContain('"app"');
        expect(dot).toContain('"lib-a"');
        expect(dot).toContain('"app" -> "lib-a"');
    });

    it("should use different colors for applications and libraries", () => {
        const dot = projectGraphToDot(createProjectGraph());

        expect(dot).toContain("#FFD700"); // application = gold
        expect(dot).toContain("#87CEEB"); // library = blue
    });

    it("should style implicit deps as dashed", () => {
        const dot = projectGraphToDot(createProjectGraph());

        expect(dot).toContain("style=dashed");
        expect(dot).toContain("style=solid");
    });
});
