import { describe, expect, it } from "vitest";

import { DependencyGraph } from "../../../src/release/core/dep-graph";
import { VisReleaseError } from "../../../src/release/errors";
import type { WorkspacePackage } from "../../../src/release/types";

const makePkg = (
    name: string,
    extras: Partial<WorkspacePackage["manifest"]> = {},
): WorkspacePackage => {
    return {
        dir: `/repo/packages/${name}`,
        manifest: { name, version: "1.0.0", ...extras },
        manifestPath: `/repo/packages/${name}/package.json`,
        name,
        private: false,
        version: "1.0.0",
    };
};

describe("dep-graph: build inverted index", () => {
    it("indexes a simple workspace dep", () => {
        expect.hasAssertions();

        const a = makePkg("a", { dependencies: { b: "^1.0.0" } });
        const b = makePkg("b");
        const graph = new DependencyGraph([a, b]);

        expect(graph.getDependents("b")).toStrictEqual([{ kind: "dependencies", name: "a", range: "^1.0.0" }]);
        expect(graph.getDependents("a")).toStrictEqual([]);
        expect(graph.getDependencies("a")).toStrictEqual([{ kind: "dependencies", name: "b", range: "^1.0.0" }]);
    });

    it("indexes peerDependencies, devDependencies, and optionalDependencies separately", () => {
        expect.hasAssertions();

        const a = makePkg("a", {
            devDependencies: { b: "*" },
            optionalDependencies: { d: "~1.0.0" },
            peerDependencies: { c: "^1.0.0" },
        });
        const graph = new DependencyGraph([a, makePkg("b"), makePkg("c"), makePkg("d")]);

        expect(graph.getDependents("b")[0]?.kind).toBe("devDependencies");
        expect(graph.getDependents("c")[0]?.kind).toBe("peerDependencies");
        expect(graph.getDependents("d")[0]?.kind).toBe("optionalDependencies");
    });

    it("ignores external (non-workspace) deps", () => {
        expect.hasAssertions();

        const a = makePkg("a", { dependencies: { b: "^1.0.0", lodash: "^4.0.0" } });
        const graph = new DependencyGraph([a, makePkg("b")]);

        // b should still get a dependent; lodash should not appear at all.
        expect(graph.getDependents("b")).toHaveLength(1);
        expect(graph.isInternal("lodash")).toBe(false);
    });

    it("preserves the original range string (incl. workspace: / catalog: prefixes)", () => {
        expect.hasAssertions();

        const a = makePkg("a", { dependencies: { b: "workspace:^1.0.0", c: "catalog:dev" } });
        const graph = new DependencyGraph([a, makePkg("b"), makePkg("c")]);

        expect(graph.getDependents("b")[0]?.range).toBe("workspace:^1.0.0");
        expect(graph.getDependents("c")[0]?.range).toBe("catalog:dev");
    });

    it("rejects duplicate package names", () => {
        expect.hasAssertions();

        const a1 = makePkg("a");
        const a2 = { ...makePkg("a"), dir: "/repo/packages/elsewhere" };

        expect(() => new DependencyGraph([a1, a2])).toThrow(VisReleaseError);

        let caught: unknown;

        try {
            // eslint-disable-next-line no-new
            new DependencyGraph([a1, a2]);
        } catch (error) {
            caught = error;
        }

        expect((caught as VisReleaseError).code).toBe("DUPLICATE_PACKAGE_NAME");
    });
});

describe("dep-graph: topologicalSort", () => {
    it("sorts a linear chain a → b → c (deps before dependents)", () => {
        expect.hasAssertions();

        const c = makePkg("c");
        const b = makePkg("b", { dependencies: { c: "^1.0.0" } });
        const a = makePkg("a", { dependencies: { b: "^1.0.0" } });
        const graph = new DependencyGraph([a, b, c]);

        const sorted = graph.topologicalSort();

        expect(sorted.indexOf("c")).toBeLessThan(sorted.indexOf("b"));
        expect(sorted.indexOf("b")).toBeLessThan(sorted.indexOf("a"));
    });

    it("sorts a fan-out graph correctly", () => {
        // shared depended on by a, b, c
        expect.hasAssertions();

        const shared = makePkg("shared");
        const a = makePkg("a", { dependencies: { shared: "^1.0.0" } });
        const b = makePkg("b", { dependencies: { shared: "^1.0.0" } });
        const c = makePkg("c", { dependencies: { shared: "^1.0.0" } });
        const graph = new DependencyGraph([a, b, c, shared]);

        const sorted = graph.topologicalSort();

        expect(sorted.indexOf("shared")).toBeLessThan(sorted.indexOf("a"));
        expect(sorted.indexOf("shared")).toBeLessThan(sorted.indexOf("b"));
        expect(sorted.indexOf("shared")).toBeLessThan(sorted.indexOf("c"));
    });

    it("detects cyclic dependencies (non-dev)", () => {
        expect.hasAssertions();

        const a = makePkg("a", { dependencies: { b: "^1.0.0" } });
        const b = makePkg("b", { dependencies: { a: "^1.0.0" } });
        const graph = new DependencyGraph([a, b]);

        expect(() => graph.topologicalSort()).toThrow(VisReleaseError);

        let caught: unknown;

        try {
            graph.topologicalSort();
        } catch (error) {
            caught = error;
        }

        expect((caught as VisReleaseError).code).toBe("CYCLIC_DEPENDENCY");
        expect((caught as Error).message).toMatch(/Cyclic/);
    });

    it("tolerates devDependency cycles", () => {
        expect.hasAssertions();

        const a = makePkg("a", { devDependencies: { b: "^1.0.0" } });
        const b = makePkg("b", { devDependencies: { a: "^1.0.0" } });
        const graph = new DependencyGraph([a, b]);

        const sorted = graph.topologicalSort();

        expect(sorted).toHaveLength(2);
        expect(sorted).toContain("a");
        expect(sorted).toContain("b");
    });

    it("respects subset filter — only sorts requested packages", () => {
        expect.hasAssertions();

        const c = makePkg("c");
        const b = makePkg("b", { dependencies: { c: "^1.0.0" } });
        const a = makePkg("a", { dependencies: { b: "^1.0.0" } });
        const graph = new DependencyGraph([a, b, c]);

        const sorted = graph.topologicalSort(["a", "b"]);

        expect(sorted).toHaveLength(2);
        expect(sorted).toContain("a");
        expect(sorted).toContain("b");
        expect(sorted).not.toContain("c");
    });
});

describe("dep-graph: helpers", () => {
    it("size returns total package count", () => {
        expect.hasAssertions();

        const graph = new DependencyGraph([makePkg("a"), makePkg("b"), makePkg("c")]);

        expect(graph.size).toBe(3);
    });

    it("getPackage returns the workspace entry", () => {
        expect.hasAssertions();

        const a = makePkg("a");
        const graph = new DependencyGraph([a]);

        expect(graph.getPackage("a")).toBe(a);
        expect(graph.getPackage("does-not-exist")).toBeUndefined();
    });

    it("isInternal reports membership", () => {
        expect.hasAssertions();

        const graph = new DependencyGraph([makePkg("a"), makePkg("b")]);

        expect(graph.isInternal("a")).toBe(true);
        expect(graph.isInternal("c")).toBe(false);
    });
});
