import type { LockFileEntry } from "@visulima/package";
import { describe, expect, it } from "vitest";

import type { LockfileGraph } from "../../src/security/dependency-paths";
import { buildDependencyPaths } from "../../src/security/dependency-paths";

const entry = (name: string, version: string, dependencies?: Record<string, string[]>): LockFileEntry => {
    return { dependencies, name, version };
};

const graph = (entries: LockFileEntry[], roots: { name: string; version: string }[]): LockfileGraph => {
    return { entries, roots };
};

describe(buildDependencyPaths, () => {
    it("should return the direct edge for a root dependency", () => {
        expect.assertions(1);

        const g = graph([entry("lodash", "4.17.20"), entry("app", "1.0.0", { lodash: ["^4.17.0"] })], [{ name: "app", version: "1.0.0" }]);

        const paths = buildDependencyPaths(g, { name: "lodash", version: "4.17.20" });

        expect(paths).toStrictEqual([
            [
                { name: "app", version: "1.0.0" },
                { name: "lodash", version: "4.17.20" },
            ],
        ]);
    });

    it("should walk a multi-level transitive chain", () => {
        expect.assertions(2);

        const g = graph(
            [
                entry("app", "1.0.0", { express: ["4.18.0"] }),
                entry("express", "4.18.0", { qs: ["6.10.0"] }),
                entry("qs", "6.10.0", { "side-channel": ["1.0.4"] }),
                entry("side-channel", "1.0.4"),
            ],
            [{ name: "app", version: "1.0.0" }],
        );

        const paths = buildDependencyPaths(g, { name: "side-channel", version: "1.0.4" });

        expect(paths).toHaveLength(1);
        expect(paths[0]?.map((n) => `${n.name}@${n.version}`)).toStrictEqual(["app@1.0.0", "express@4.18.0", "qs@6.10.0", "side-channel@1.0.4"]);
    });

    it("should return multiple paths when the target is reachable through several roots", () => {
        expect.assertions(2);

        const g = graph(
            [entry("app-a", "1.0.0", { lodash: ["4.17.20"] }), entry("app-b", "1.0.0", { lodash: ["4.17.20"] }), entry("lodash", "4.17.20")],
            [
                { name: "app-a", version: "1.0.0" },
                { name: "app-b", version: "1.0.0" },
            ],
        );

        const paths = buildDependencyPaths(g, { name: "lodash", version: "4.17.20" });

        expect(paths).toHaveLength(2);
        expect(paths.map((p) => p[0]?.name).sort()).toStrictEqual(["app-a", "app-b"]);
    });

    it("should resolve a semver-range specifier to an installed version", () => {
        expect.assertions(2);

        const g = graph([entry("app", "1.0.0", { axios: ["^0.21.0"] }), entry("axios", "0.21.4")], [{ name: "app", version: "1.0.0" }]);

        const paths = buildDependencyPaths(g, { name: "axios", version: "0.21.4" });

        expect(paths).toHaveLength(1);
        expect(paths[0]?.[1]).toStrictEqual({ name: "axios", version: "0.21.4" });
    });

    it("should handle pnpm-style multi-edge dep maps", () => {
        expect.assertions(2);

        // Same dep name resolved to two versions under different peer contexts.
        const g = graph(
            [entry("app", "1.0.0", { react: ["18.2.0", "17.0.2"] }), entry("react", "17.0.2"), entry("react", "18.2.0")],
            [{ name: "app", version: "1.0.0" }],
        );

        const paths17 = buildDependencyPaths(g, { name: "react", version: "17.0.2" });
        const paths18 = buildDependencyPaths(g, { name: "react", version: "18.2.0" });

        expect(paths17).toHaveLength(1);
        expect(paths18).toHaveLength(1);
    });

    it("should skip a cycle without infinite looping", () => {
        expect.assertions(1);

        // a → b → a → b … must terminate; only the a→b path is yielded.
        const g = graph([entry("a", "1.0.0", { b: ["1.0.0"] }), entry("b", "1.0.0", { a: ["1.0.0"] })], [{ name: "a", version: "1.0.0" }]);

        const paths = buildDependencyPaths(g, { name: "b", version: "1.0.0" });

        expect(paths.map((p) => p.map((n) => n.name).join("→"))).toStrictEqual(["a→b"]);
    });

    it("should cap results at maxPathsPerTarget", () => {
        expect.assertions(1);

        const g = graph(
            [
                entry("r1", "1.0.0", { leaf: ["1.0.0"] }),
                entry("r2", "1.0.0", { leaf: ["1.0.0"] }),
                entry("r3", "1.0.0", { leaf: ["1.0.0"] }),
                entry("leaf", "1.0.0"),
            ],
            [
                { name: "r1", version: "1.0.0" },
                { name: "r2", version: "1.0.0" },
                { name: "r3", version: "1.0.0" },
            ],
        );

        const paths = buildDependencyPaths(g, { name: "leaf", version: "1.0.0" }, { maxPathsPerTarget: 2 });

        expect(paths).toHaveLength(2);
    });

    it("should order paths by length (shortest first)", () => {
        expect.assertions(2);

        const g = graph(
            [
                entry("app", "1.0.0", { direct: ["1.0.0"], indirect: ["1.0.0"] }),
                entry("direct", "1.0.0", { target: ["1.0.0"] }),
                entry("indirect", "1.0.0", { mid: ["1.0.0"] }),
                entry("mid", "1.0.0", { target: ["1.0.0"] }),
                entry("target", "1.0.0"),
            ],
            [{ name: "app", version: "1.0.0" }],
        );

        const paths = buildDependencyPaths(g, { name: "target", version: "1.0.0" });

        // Direct path (length 3: app→direct→target) before indirect (length 4).
        expect(paths[0]?.length).toBe(3);
        expect(paths[1]?.length).toBe(4);
    });

    it("should return an empty array when the target is unreachable", () => {
        expect.assertions(1);

        const g = graph([entry("app", "1.0.0"), entry("orphan", "1.0.0")], [{ name: "app", version: "1.0.0" }]);

        const paths = buildDependencyPaths(g, { name: "orphan", version: "1.0.0" });

        expect(paths).toStrictEqual([]);
    });

    it("should union edges across peer-context variants sharing one name@version key", () => {
        expect.assertions(3);

        // pnpm v9+ emits one LockFileEntry per peer-context variant. Two
        // entries with identical `name@version` but different `dependencies`
        // maps must both contribute to the adjacency — the second must NOT
        // overwrite the first.
        const g = graph(
            [
                entry("app", "1.0.0", { shared: ["1.0.0"] }),
                // Two variants of shared@1.0.0 with disjoint dep maps:
                entry("shared", "1.0.0", { "leaf-a": ["1.0.0"] }),
                entry("shared", "1.0.0", { "leaf-b": ["1.0.0"] }),
                entry("leaf-a", "1.0.0"),
                entry("leaf-b", "1.0.0"),
            ],
            [{ name: "app", version: "1.0.0" }],
        );

        const pathsToA = buildDependencyPaths(g, { name: "leaf-a", version: "1.0.0" });
        const pathsToB = buildDependencyPaths(g, { name: "leaf-b", version: "1.0.0" });

        expect(pathsToA).toHaveLength(1);
        expect(pathsToB).toHaveLength(1);
        // Both leaves must be reachable through `shared@1.0.0`.
        expect([pathsToA[0]?.map((n) => n.name).join("→"), pathsToB[0]?.map((n) => n.name).join("→")]).toStrictEqual([
            "app→shared→leaf-a",
            "app→shared→leaf-b",
        ]);
    });

    it("should yield the shortest path first even when a long root is enumerated before a short one", () => {
        expect.assertions(2);

        // Catch the regression where DFS exhausted maxPaths via the first
        // root before reaching a shorter path under the second.
        const g = graph(
            [
                // Long root: depth-4 path to target via a chain.
                entry("long-root", "1.0.0", { mid1: ["1.0.0"] }),
                entry("mid1", "1.0.0", { mid2: ["1.0.0"] }),
                entry("mid2", "1.0.0", { mid3: ["1.0.0"] }),
                entry("mid3", "1.0.0", { target: ["1.0.0"] }),
                // Short root: length-2 direct edge.
                entry("short-root", "1.0.0", { target: ["1.0.0"] }),
                entry("target", "1.0.0"),
            ],
            [
                { name: "long-root", version: "1.0.0" },
                { name: "short-root", version: "1.0.0" },
            ],
        );

        const paths = buildDependencyPaths(g, { name: "target", version: "1.0.0" }, { maxPathsPerTarget: 1 });

        expect(paths).toHaveLength(1);
        // Shortest path is `short-root → target` (length 2); must be picked
        // even though long-root is enumerated first.
        expect(paths[0]?.length).toBe(2);
    });

    it("should ignore an unknown root with no installed candidate", () => {
        expect.assertions(1);

        const g = graph([entry("lodash", "4.17.20")], [{ name: "ghost", version: "1.0.0" }]);

        const paths = buildDependencyPaths(g, { name: "lodash", version: "4.17.20" });

        expect(paths).toStrictEqual([]);
    });
});
