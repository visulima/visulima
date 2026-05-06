import type { WorkspaceConfiguration } from "@visulima/task-runner";
import { describe, expect, it } from "vitest";

import type { VisProjectConfiguration } from "../../src/config/workspace";
import { resolveSkipCachePatterns } from "../../src/task/skip-cache";

const makeWorkspace = (projects: Record<string, Partial<VisProjectConfiguration>>): WorkspaceConfiguration => {
    const full: Record<string, VisProjectConfiguration> = {};

    for (const [name, partial] of Object.entries(projects)) {
        full[name] = { root: partial.root ?? `packages/${name}`, ...partial };
    }

    return { projects: full };
};

const workspace = makeWorkspace({
    "@scope/api": { tags: ["backend"] },
    app: { tags: ["frontend", "flaky"] },
    lib: { tags: ["frontend"] },
});

const graphTaskIds = ["app:test", "app:build", "lib:test", "lib:build", "@scope/api:test"];

describe(resolveSkipCachePatterns, () => {
    it("should return an empty set when no patterns are supplied", () => {
        expect.assertions(2);

        const result = resolveSkipCachePatterns(undefined, workspace, graphTaskIds);

        expect(result.skipTaskIds.size).toBe(0);
        expect(result.unmatchedPatterns).toStrictEqual([]);
    });

    it("should return an empty set when patterns are empty/whitespace", () => {
        expect.assertions(1);

        const result = resolveSkipCachePatterns("   ,  , ", workspace, graphTaskIds);

        expect(result.skipTaskIds.size).toBe(0);
    });

    it("should match a single explicit project:target pair", () => {
        expect.assertions(2);

        const result = resolveSkipCachePatterns("app:test", workspace, graphTaskIds);

        expect([...result.skipTaskIds]).toStrictEqual(["app:test"]);
        expect(result.unmatchedPatterns).toStrictEqual([]);
    });

    it("should match scoped package names", () => {
        expect.assertions(1);

        const result = resolveSkipCachePatterns("@scope/api:test", workspace, graphTaskIds);

        expect([...result.skipTaskIds]).toStrictEqual(["@scope/api:test"]);
    });

    it("should match every project's target with the `:target` form", () => {
        expect.assertions(1);

        const result = resolveSkipCachePatterns(":test", workspace, graphTaskIds);

        expect([...result.skipTaskIds].toSorted()).toStrictEqual(["@scope/api:test", "app:test", "lib:test"]);
    });

    it("should match the bare `target` form like `:target`", () => {
        expect.assertions(1);

        const result = resolveSkipCachePatterns("build", workspace, graphTaskIds);

        expect([...result.skipTaskIds].toSorted()).toStrictEqual(["app:build", "lib:build"]);
    });

    it("should match by tag with the `#tag:target` form", () => {
        expect.assertions(1);

        const result = resolveSkipCachePatterns("#frontend:test", workspace, graphTaskIds);

        expect([...result.skipTaskIds].toSorted()).toStrictEqual(["app:test", "lib:test"]);
    });

    it("should accept multiple comma-separated patterns and union the matches", () => {
        expect.assertions(1);

        const result = resolveSkipCachePatterns("app:test, #frontend:build", workspace, graphTaskIds);

        expect([...result.skipTaskIds].toSorted()).toStrictEqual(["app:build", "app:test", "lib:build"]);
    });

    it("should report patterns that match nothing in the graph", () => {
        expect.assertions(2);

        const result = resolveSkipCachePatterns("ghost:test, app:test", workspace, graphTaskIds);

        expect([...result.skipTaskIds]).toStrictEqual(["app:test"]);
        expect(result.unmatchedPatterns).toStrictEqual(["ghost:test"]);
    });

    it("should treat tag patterns with no matching projects as unmatched", () => {
        expect.assertions(2);

        const result = resolveSkipCachePatterns("#unknown:test", workspace, graphTaskIds);

        expect(result.skipTaskIds.size).toBe(0);
        expect(result.unmatchedPatterns).toStrictEqual(["#unknown:test"]);
    });

    it("should reject the closest-project selector `~:`", () => {
        expect.assertions(1);

        expect(() => resolveSkipCachePatterns("~:test", workspace, graphTaskIds)).toThrow(/closest-project selector/);
    });

    it("should ignore tasks whose project was pruned from the graph (e.g. by --projects)", () => {
        expect.assertions(2);

        // Same pattern, but graph contains only `app:test`. Expect just app:test, no false positives for lib.
        const result = resolveSkipCachePatterns(":test", workspace, ["app:test"]);

        expect([...result.skipTaskIds]).toStrictEqual(["app:test"]);
        expect(result.unmatchedPatterns).toStrictEqual([]);
    });
});
