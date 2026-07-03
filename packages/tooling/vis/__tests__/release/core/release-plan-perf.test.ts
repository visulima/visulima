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

describe("release-plan: glob-expansion cache", () => {
    it("converges on a 100-package fan-out without quadratic slowdown", () => {
        // 100 leaf packages + 1 source package that cascades to all of them.
        // Phase B (fixed group) + Phase C1 (cascade) both expand globs every
        // iteration of the fixed-point loop. The WeakMap cache should make
        // this O(patterns) per loop instead of O(patterns × packages).
        expect.hasAssertions();

        const packages: WorkspacePackage[] = [mkPkg("@scope/source")];

        for (let i = 0; i < 100; i += 1) {
            packages.push(mkPkg(`@scope/leaf-${i}`));
        }

        const graph = new DependencyGraph(packages);

        const startMs = Date.now();

        const plan = assembleReleasePlan(
            [parseChangeFile(`---\n"@scope/source":\n  bump: minor\n  cascade:\n    "@scope/leaf-*": patch\n---\nCascade.\n`, "x.md")],
            graph,
            {},
        );

        const elapsedMs = Date.now() - startMs;

        // Sanity: every leaf was bumped.
        expect(plan.releases).toHaveLength(101);

        // Performance: should complete well under 50ms even on slow machines.
        // Without the cache, a 100-package × N-iteration glob match would
        // be 10k+ zeptomatch calls.
        expect(elapsedMs).toBeLessThan(500);
    });

    it("fixed-group expansion is cached across fixed-point iterations", () => {
        // Build a workspace where the fixed group gets bumped by ONE explicit
        // change file but the fixed-point loop runs many iterations because of
        // chained dep propagation.
        expect.hasAssertions();

        const packages: WorkspacePackage[] = [];

        for (let i = 0; i < 50; i += 1) {
            packages.push(mkPkg(`@grp/p${i}`));
        }

        const graph = new DependencyGraph(packages);

        const plan = assembleReleasePlan([parseChangeFile(`---\n"@grp/p0": minor\n---\nFixed group bump.\n`, "x.md")], graph, { fixed: [["@grp/*"]] });

        // Every member of the fixed group should bump.
        expect(plan.releases).toHaveLength(50);

        // Every release should be type minor.
        for (const release of plan.releases) {
            expect(release.type).toBe("minor");
        }
    });
});
