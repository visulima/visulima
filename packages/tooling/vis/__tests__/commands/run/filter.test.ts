import type { ProjectConfiguration, ProjectGraph, ProjectGraphDependency } from "@visulima/task-runner";
import { describe, expect, it } from "vitest";

import type { ApplyFiltersContext } from "../../../src/commands/run/filter";
import { applyFilters, applyFilterStrings, parseFilter } from "../../../src/commands/run/filter";

/**
 * Builds a minimal {@link ProjectGraph} from a project → dependency-name
 * map. `roots` lets a test override the per-project `data.root` (defaults
 * to `packages/&lt;name>`), and `packageNames` lets a test attach a
 * `package.json#name` for name-glob assertions.
 */
const makeGraph = (deps: Record<string, string[]>, options: { roots?: Record<string, string> } = {}): ProjectGraph => {
    const nodes: ProjectGraph["nodes"] = {};
    const dependencies: ProjectGraph["dependencies"] = {};

    for (const name of Object.keys(deps)) {
        const root = options.roots?.[name] ?? `packages/${name}`;

        nodes[name] = {
            data: { name, root } as ProjectConfiguration,
            name,
            type: "library",
        };

        dependencies[name] = (deps[name] ?? []).map((target): ProjectGraphDependency => {
            return { source: name, target, type: "static" };
        });
    }

    return { dependencies, nodes };
};

describe(parseFilter, () => {
    it("should return undefined for an empty selector", () => {
        expect.assertions(2);

        expect(parseFilter("")).toBeUndefined();
        expect(parseFilter("   ")).toBeUndefined();
    });

    it("should parse a plain package name", () => {
        expect.assertions(1);

        expect(parseFilter("@org/web")).toStrictEqual({
            changedSince: undefined,
            excludeSelf: false,
            includeDependencies: false,
            includeDependents: false,
            isPath: false,
            pattern: "@org/web",
        });
    });

    it("should parse a name glob", () => {
        expect.assertions(2);

        const result = parseFilter("@org/*");

        expect(result?.pattern).toBe("@org/*");
        expect(result?.isPath).toBe(false);
    });

    it("should parse leading `...` as include-dependents", () => {
        expect.assertions(3);

        const result = parseFilter("...@org/web");

        expect(result?.pattern).toBe("@org/web");
        expect(result?.includeDependents).toBe(true);
        expect(result?.includeDependencies).toBe(false);
    });

    it("should parse trailing `...` as include-dependencies", () => {
        expect.assertions(3);

        const result = parseFilter("@org/web...");

        expect(result?.pattern).toBe("@org/web");
        expect(result?.includeDependencies).toBe(true);
        expect(result?.includeDependents).toBe(false);
    });

    it("should parse `...^pkg` as dependents-only (exclude self)", () => {
        expect.assertions(3);

        const result = parseFilter("...^@org/web");

        expect(result?.pattern).toBe("@org/web");
        expect(result?.includeDependents).toBe(true);
        expect(result?.excludeSelf).toBe(true);
    });

    it("should parse `pkg^...` as dependencies-only (exclude self)", () => {
        expect.assertions(3);

        const result = parseFilter("@org/web^...");

        expect(result?.pattern).toBe("@org/web");
        expect(result?.includeDependencies).toBe(true);
        expect(result?.excludeSelf).toBe(true);
    });

    it("should parse a bare changed-since `[main]`", () => {
        expect.assertions(3);

        const result = parseFilter("[main]");

        expect(result?.pattern).toBe("");
        expect(result?.changedSince).toBe("main");
        expect(result?.includeDependents).toBe(false);
    });

    it("should parse changed-since with a remote ref", () => {
        expect.assertions(1);

        expect(parseFilter("[origin/main]")?.changedSince).toBe("origin/main");
    });

    it("should parse an empty changed-since `[]` as empty string", () => {
        expect.assertions(2);

        const result = parseFilter("[]");

        expect(result?.pattern).toBe("");
        expect(result?.changedSince).toBe("");
    });

    it("should combine `...` with changed-since `...[main]`", () => {
        expect.assertions(3);

        const result = parseFilter("...[main]");

        expect(result?.pattern).toBe("");
        expect(result?.changedSince).toBe("main");
        expect(result?.includeDependents).toBe(true);
    });

    it("should combine a name with changed-since `pkg[main]`", () => {
        expect.assertions(2);

        const result = parseFilter("@org/web[main]");

        expect(result?.pattern).toBe("@org/web");
        expect(result?.changedSince).toBe("main");
    });

    it("should parse an explicit path glob `./packages/*`", () => {
        expect.assertions(2);

        const result = parseFilter("./packages/*");

        expect(result?.isPath).toBe(true);
        expect(result?.pattern).toBe("./packages/*");
    });

    it("should parse a brace path glob `{packages/*}`", () => {
        expect.assertions(2);

        const result = parseFilter("{packages/*}");

        expect(result?.isPath).toBe(true);
        expect(result?.pattern).toBe("packages/*");
    });

    it("should not treat a scoped name as a path", () => {
        expect.assertions(1);

        expect(parseFilter("@org/web")?.isPath).toBe(false);
    });
});

describe(applyFilters, () => {
    // a <- b <- c : c depends on b, b depends on a.
    const graph = makeGraph({
        a: [],
        b: ["a"],
        c: ["b"],
        d: [],
    });

    const baseContext: ApplyFiltersContext = { projectGraph: graph };

    it("should match a single package by exact name", async () => {
        expect.assertions(1);

        const result = await applyFilters([parseFilter("b")!], baseContext);

        expect(result.toSorted()).toStrictEqual(["b"]);
    });

    it("should match packages by name glob", async () => {
        expect.assertions(1);

        const result = await applyFilters([parseFilter("*")!], baseContext);

        expect(result.toSorted()).toStrictEqual(["a", "b", "c", "d"]);
    });

    it("should include dependents with leading `...`", async () => {
        expect.assertions(1);

        // a + everything that (transitively) depends on a → a, b, c.
        const result = await applyFilters([parseFilter("...a")!], baseContext);

        expect(result.toSorted()).toStrictEqual(["a", "b", "c"]);
    });

    it("should include dependencies with trailing `...`", async () => {
        expect.assertions(1);

        // c + everything it (transitively) depends on → c, b, a.
        const result = await applyFilters([parseFilter("c...")!], baseContext);

        expect(result.toSorted()).toStrictEqual(["a", "b", "c"]);
    });

    it("should exclude self with `...^pkg`", async () => {
        expect.assertions(1);

        // dependents of a only → b, c (not a).
        const result = await applyFilters([parseFilter("...^a")!], baseContext);

        expect(result.toSorted()).toStrictEqual(["b", "c"]);
    });

    it("should exclude self with `pkg^...`", async () => {
        expect.assertions(1);

        // dependencies of c only → a, b (not c).
        const result = await applyFilters([parseFilter("c^...")!], baseContext);

        expect(result.toSorted()).toStrictEqual(["a", "b"]);
    });

    it("should match packages by path glob", async () => {
        expect.assertions(1);

        const pathGraph = makeGraph({ api: [], web: [] }, { roots: { api: "services/api", web: "apps/web" } });

        const result = await applyFilters([parseFilter("./apps/*")!], { projectGraph: pathGraph });

        expect(result.toSorted()).toStrictEqual(["web"]);
    });

    it("should match a brace path glob", async () => {
        expect.assertions(1);

        const pathGraph = makeGraph({ api: [], web: [] }, { roots: { api: "services/api", web: "apps/web" } });

        const result = await applyFilters([parseFilter("{services/*}")!], { projectGraph: pathGraph });

        expect(result.toSorted()).toStrictEqual(["api"]);
    });

    it("should match by package.json name via packageNameByProject", async () => {
        expect.assertions(1);

        const context: ApplyFiltersContext = {
            packageNameByProject: new Map([
                ["a", "@org/alpha"],
                ["b", "@org/beta"],
                ["c", "@other/gamma"],
                ["d", undefined],
            ]),
            projectGraph: graph,
        };

        const result = await applyFilters([parseFilter("@org/*")!], context);

        expect(result.toSorted()).toStrictEqual(["a", "b"]);
    });

    it("should resolve a bare changed-since selector to the changed set", async () => {
        expect.assertions(2);

        const seen: string[] = [];
        const context: ApplyFiltersContext = {
            changedProjectsForRef: (reference) => {
                seen.push(reference);

                return ["b"];
            },
            projectGraph: graph,
        };

        const result = await applyFilters([parseFilter("[main]")!], context);

        expect(result.toSorted()).toStrictEqual(["b"]);
        expect(seen).toStrictEqual(["main"]);
    });

    it("should expand changed-since with dependents via `...[main]`", async () => {
        expect.assertions(1);

        const context: ApplyFiltersContext = {
            changedProjectsForRef: () => ["a"],
            projectGraph: graph,
        };

        const result = await applyFilters([parseFilter("...[main]")!], context);

        expect(result.toSorted()).toStrictEqual(["a", "b", "c"]);
    });

    it("should intersect a name pattern with changed-since `pkg[main]`", async () => {
        expect.assertions(1);

        const context: ApplyFiltersContext = {
            changedProjectsForRef: () => ["b", "c"],
            projectGraph: graph,
        };

        // pattern matches a,b,c,d via glob; changed set is b,c → b,c.
        const result = await applyFilters([parseFilter("*[main]")!], context);

        expect(result.toSorted()).toStrictEqual(["b", "c"]);
    });

    it("should fall back to defaultBase for a bare `[]` selector", async () => {
        expect.assertions(1);

        const seen: string[] = [];
        const context: ApplyFiltersContext = {
            changedProjectsForRef: (reference) => {
                seen.push(reference);

                return [];
            },
            defaultBase: "develop",
            projectGraph: graph,
        };

        await applyFilters([parseFilter("[]")!], context);

        expect(seen).toStrictEqual(["develop"]);
    });

    it("should union multiple filters", async () => {
        expect.assertions(1);

        const result = await applyFilters([parseFilter("a")!, parseFilter("d")!], baseContext);

        expect(result.toSorted()).toStrictEqual(["a", "d"]);
    });

    it("should return an empty set when nothing matches", async () => {
        expect.assertions(1);

        const result = await applyFilters([parseFilter("does-not-exist")!], baseContext);

        expect(result).toStrictEqual([]);
    });
});

describe(applyFilterStrings, () => {
    const graph = makeGraph({ a: [], b: ["a"] });

    it("should parse and apply raw selector strings", async () => {
        expect.assertions(1);

        const result = await applyFilterStrings(["...a"], { projectGraph: graph });

        expect(result.toSorted()).toStrictEqual(["a", "b"]);
    });

    it("should skip empty selectors", async () => {
        expect.assertions(1);

        const result = await applyFilterStrings(["", "  ", "a"], { projectGraph: graph });

        expect(result.toSorted()).toStrictEqual(["a"]);
    });
});
