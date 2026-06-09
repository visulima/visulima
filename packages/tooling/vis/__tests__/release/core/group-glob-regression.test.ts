/**
 * Regression test for the bug fixed in commit b0ccf64:
 * `groupPreVersionCommands` never fired for fixed/linked groups defined
 * with glob patterns (e.g. `["@scope/*"]`).
 *
 * Before the fix, the `groupTouched` check did literal-equality matching
 * which never returned true for glob members. Hooks were silently skipped.
 *
 * This test only exercises the structural pre-check (does the touched-
 * group detection respect globs?). The actual hook execution requires a
 * shell, which the unit test doesn't have access to here.
 */

import { describe, expect, it } from "vitest";

import { parseChangeFile } from "../../../src/release/core/change-file";
import { DependencyGraph } from "../../../src/release/core/dep-graph";
import { assembleReleasePlan } from "../../../src/release/core/release-plan";
import type { WorkspacePackage } from "../../../src/release/types";

const mkPkg = (name: string): WorkspacePackage => {
    return {
        dir: `/r/${name}`,
        manifest: { name, version: "1.0.0" },
        manifestPath: `/r/${name}/package.json`,
        name,
        private: false,
        version: "1.0.0",
    };
};

describe("orchestrator groupPreVersionCommands — glob expansion regression", () => {
    it("a fixed group with glob members is correctly detected as touched when any member is in the plan", () => {
        const packages = [mkPkg("@scope/a"), mkPkg("@scope/b"), mkPkg("@scope/c"), mkPkg("@other/x")];
        const graph = new DependencyGraph(packages);

        // Plan only bumps @scope/a, but the fixed group is `["@scope/*"]`.
        // Phase B should expand the glob and bump every group member.
        const plan = assembleReleasePlan(
            [parseChangeFile(`---\n"@scope/a": minor\n---\n`, "x.md")],
            graph,
            { fixed: [["@scope/*"]] },
        );

        // Every @scope/* member should be bumped → group is "touched"
        // (which is the precondition the orchestrator's
        // groupPreVersionCommands check uses to decide whether to fire).
        const scopeReleases = plan.releases.filter((r) => r.name.startsWith("@scope/"));

        expect(scopeReleases).toHaveLength(3);

        // @other/x should NOT be in the plan — it's outside the group.
        expect(plan.releases.find((r) => r.name === "@other/x")).toBeUndefined();
    });

    it("mixed literal + glob group members all expand correctly", () => {
        const packages = [mkPkg("core"), mkPkg("plugin-foo"), mkPkg("plugin-bar"), mkPkg("unrelated")];
        const graph = new DependencyGraph(packages);

        const plan = assembleReleasePlan(
            [parseChangeFile(`---\ncore: minor\n---\n`, "x.md")],
            graph,
            { fixed: [["core", "plugin-*"]] },
        );

        const planned = new Set(plan.releases.map((r) => r.name));

        expect(planned.has("core")).toBe(true);
        expect(planned.has("plugin-foo")).toBe(true);
        expect(planned.has("plugin-bar")).toBe(true);
        expect(planned.has("unrelated")).toBe(false);
    });
});
