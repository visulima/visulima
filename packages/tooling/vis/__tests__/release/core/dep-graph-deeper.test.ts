import { describe, expect, it } from "vitest";

import { DependencyGraph } from "../../../src/release/core/dep-graph";
import type { WorkspacePackage } from "../../../src/release/types";

const pkg = (name: string, deps: Record<string, string> = {}): WorkspacePackage => {
    return {
        dir: `/r/${name}`,
        manifest: { dependencies: Object.keys(deps).length > 0 ? deps : undefined, name, version: "1.0.0" },
        manifestPath: `/r/${name}/package.json`,
        name,
        private: false,
        version: "1.0.0",
    };
};

describe("dependencyGraph — multi-kind indexing", () => {
    it("returns disjoint dependent lists across dep kinds", () => {
        expect.hasAssertions();

        const a = pkg("a");
        const b: WorkspacePackage = {
            ...pkg("b"),
            manifest: {
                dependencies: { a: "^1.0.0" },
                devDependencies: { a: "^1.0.0" },
                name: "b",
                version: "1.0.0",
            },
        };

        const graph = new DependencyGraph([a, b]);
        const dependents = graph.getDependents("a");

        expect(dependents).toHaveLength(2);
        expect(dependents.map((d) => d.kind).sort()).toStrictEqual(["dependencies", "devDependencies"]);
    });

    it("topo-sort with diamond dep graph", () => {
        // d → b → a
        // d → c → a
        expect.hasAssertions();

        const a = pkg("a");
        const b = pkg("b", { a: "^1.0.0" });
        const c = pkg("c", { a: "^1.0.0" });
        const d = pkg("d", { b: "^1.0.0", c: "^1.0.0" });

        const graph = new DependencyGraph([d, c, b, a]);
        const sorted = graph.topologicalSort();

        expect(sorted.indexOf("a")).toBeLessThan(sorted.indexOf("b"));
        expect(sorted.indexOf("a")).toBeLessThan(sorted.indexOf("c"));
        expect(sorted.indexOf("b")).toBeLessThan(sorted.indexOf("d"));
        expect(sorted.indexOf("c")).toBeLessThan(sorted.indexOf("d"));
    });

    it("size + isInternal + getPackage are consistent", () => {
        expect.hasAssertions();

        const graph = new DependencyGraph([pkg("a"), pkg("b")]);

        expect(graph.size).toBe(2);
        expect(graph.isInternal("a")).toBe(true);
        expect(graph.isInternal("missing")).toBe(false);
        expect(graph.getPackage("a")?.name).toBe("a");
        expect(graph.getPackage("missing")).toBeUndefined();
    });
});
