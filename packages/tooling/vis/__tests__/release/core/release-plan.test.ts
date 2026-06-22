import { describe, expect, it } from "vitest";

import { parseChangeFile } from "../../../src/release/core/change-file";
import { DependencyGraph } from "../../../src/release/core/dep-graph";
import { assembleReleasePlan } from "../../../src/release/core/release-plan";
import type { ChangeFile, VisReleaseConfig, WorkspacePackage } from "../../../src/release/types";

const mkPkg = (
    name: string,
    extras: Partial<WorkspacePackage["manifest"]> & { version?: string } = {},
): WorkspacePackage => {
    const { version = "1.0.0", ...rest } = extras;

    return {
        dir: `/repo/packages/${name}`,
        manifest: { name, version, ...rest },
        manifestPath: `/repo/packages/${name}/package.json`,
        name,
        private: false,
        version,
    };
};

const cf = (content: string, file = "f.md"): ChangeFile => parseChangeFile(content, file);

const findRelease = (plan: ReturnType<typeof assembleReleasePlan>, name: string) => plan.releases.find((r) => r.name === name);

// ── Phase A — out-of-range fix ─────────────────────────────────────

describe("release-plan: phase A — out-of-range fix", () => {
    it("propagates patch to dependent when explicit minor bump breaks range", () => {
        expect.hasAssertions();

        const a = mkPkg("a", { version: "1.0.0" });
        const b = mkPkg("b", { dependencies: { a: "~1.0.0" } });
        const graph = new DependencyGraph([a, b]);

        const files = [cf(`---\na: minor\n---\n`)];
        const plan = assembleReleasePlan(files, graph, {});

        const releaseB = findRelease(plan, "b");

        expect(releaseB).toBeDefined();
        expect(releaseB?.type).toBe("patch");
        expect(releaseB?.isDependencyBump).toBe(true);
        expect(releaseB?.reasons).toContain("DEPENDENCY_OUT_OF_RANGE");
    });

    it("does NOT propagate when range still satisfies new version", () => {
        expect.hasAssertions();

        const a = mkPkg("a");
        const b = mkPkg("b", { dependencies: { a: "^1.0.0" } });
        const graph = new DependencyGraph([a, b]);

        // a@1.0.0 → 1.1.0 (minor) — still satisfies ^1.0.0
        const plan = assembleReleasePlan([cf(`---\na: minor\n---\n`)], graph, {});

        expect(findRelease(plan, "b")).toBeUndefined();
    });

    it("peer deps inherit source bump level (no major escalation)", () => {
        expect.hasAssertions();

        const a = mkPkg("a");
        const b = mkPkg("b", { peerDependencies: { a: "~1.0.0" } });
        const graph = new DependencyGraph([a, b]);

        const plan = assembleReleasePlan([cf(`---\na: minor\n---\n`)], graph, {});

        const releaseB = findRelease(plan, "b");

        expect(releaseB?.type).toBe("minor"); // matches source, NOT major
        expect(releaseB?.reasons).toContain("PEER_DEP_MATCH");
    });

    it("ignores devDependencies", () => {
        expect.hasAssertions();

        const a = mkPkg("a");
        const b = mkPkg("b", { devDependencies: { a: "~1.0.0" } });
        const graph = new DependencyGraph([a, b]);

        const plan = assembleReleasePlan([cf(`---\na: major\n---\n`)], graph, {});

        expect(findRelease(plan, "b")).toBeUndefined();
    });

    it("treats workspace:* and catalog: as always satisfied (no out-of-range trigger)", () => {
        expect.hasAssertions();

        const a = mkPkg("a");
        const b = mkPkg("b", { dependencies: { a: "workspace:*" } });
        const c = mkPkg("c", { dependencies: { a: "catalog:" } });
        const graph = new DependencyGraph([a, b, c]);

        const plan = assembleReleasePlan([cf(`---\na: major\n---\n`)], graph, {});

        // Out-of-range mode: workspace:* and catalog: are skipped.
        expect(findRelease(plan, "b")).toBeUndefined();
        expect(findRelease(plan, "c")).toBeUndefined();
    });

    it("warns on ^0.x peer dep producing non-patch propagation", () => {
        expect.hasAssertions();

        const a = mkPkg("a", { version: "0.5.0" });
        const b = mkPkg("b", { peerDependencies: { a: "^0.5.0" } });
        const graph = new DependencyGraph([a, b]);

        const plan = assembleReleasePlan([cf(`---\na: minor\n---\n`)], graph, {});

        expect(plan.warnings.some((w) => w.includes("^0.x peer dep"))).toBe(true);
    });

    // Devdep-cascade opt-in (changesets #944): default off, true cascades
    // every source, an allow-list narrows to specific source packages.
    it("cascades devDependency consumers as patch when bumpDevDependencies is true", () => {
        expect.hasAssertions();

        const a = mkPkg("a");
        const b = mkPkg("b", { devDependencies: { a: "~1.0.0" } });
        const graph = new DependencyGraph([a, b]);

        const plan = assembleReleasePlan(
            [cf(`---\na: minor\n---\n`)],
            graph,
            { bumpDevDependencies: true },
        );

        const releaseB = findRelease(plan, "b");

        expect(releaseB?.type).toBe("patch");
        expect(releaseB?.isDependencyBump).toBe(true);
        expect(releaseB?.reasons).toContain("DEVDEPENDENCY_BUMPED");
    });

    it("narrows devDependency cascade to the bumpDevDependencies allow-list", () => {
        expect.hasAssertions();

        const a = mkPkg("a");
        const c = mkPkg("c");
        const b = mkPkg("b", { devDependencies: { a: "~1.0.0", c: "~1.0.0" } });
        const graph = new DependencyGraph([a, b, c]);

        // Only `a` is in the allow-list, so a→b cascades but c→b doesn't.
        const plan = assembleReleasePlan(
            [cf(`---\na: minor\nc: minor\n---\n`)],
            graph,
            { bumpDevDependencies: ["a"] },
        );

        const releaseB = findRelease(plan, "b");

        expect(releaseB?.type).toBe("patch");
        expect(releaseB?.reasons).toContain("DEVDEPENDENCY_BUMPED");
        // The release is attributed to `a` (cascade source), not `c`.
        expect(releaseB?.sources.map((s) => s.name)).toContain("a");
    });

    it("still ignores devDependencies when bumpDevDependencies is omitted", () => {
        expect.hasAssertions();

        const a = mkPkg("a");
        const b = mkPkg("b", { devDependencies: { a: "~1.0.0" } });
        const graph = new DependencyGraph([a, b]);

        const plan = assembleReleasePlan([cf(`---\na: major\n---\n`)], graph, {});

        expect(findRelease(plan, "b")).toBeUndefined();
    });
});

// ── Phase B — fixed / linked groups ────────────────────────────────

describe("release-plan: phase B — fixed groups", () => {
    it("max-bumps every member of a fixed group", () => {
        expect.hasAssertions();

        const a = mkPkg("a");
        const b = mkPkg("b");
        const c = mkPkg("c");
        const graph = new DependencyGraph([a, b, c]);

        const config: VisReleaseConfig = { fixed: [["a", "b", "c"]] };
        const plan = assembleReleasePlan([cf(`---\na: minor\n---\n`)], graph, config);

        expect(findRelease(plan, "a")?.type).toBe("minor");
        expect(findRelease(plan, "b")?.type).toBe("minor");
        expect(findRelease(plan, "c")?.type).toBe("minor");
        expect(findRelease(plan, "b")?.isGroupBump).toBe(true);
    });

    it("expands glob patterns within fixed groups", () => {
        expect.hasAssertions();

        const a = mkPkg("@scope/core");
        const b = mkPkg("@scope/plugin-foo");
        const c = mkPkg("@scope/plugin-bar");
        const graph = new DependencyGraph([a, b, c]);

        const config: VisReleaseConfig = { fixed: [["@scope/core", "@scope/plugin-*"]] };
        const plan = assembleReleasePlan([cf(`---\n"@scope/core": minor\n---\n`)], graph, config);

        expect(findRelease(plan, "@scope/plugin-foo")?.type).toBe("minor");
        expect(findRelease(plan, "@scope/plugin-bar")?.type).toBe("minor");
    });
});

describe("release-plan: phase B — linked groups", () => {
    it("max-bumps only already-planned members (no pull-in of new packages)", () => {
        expect.hasAssertions();

        const a = mkPkg("a");
        const b = mkPkg("b");
        const c = mkPkg("c");
        const graph = new DependencyGraph([a, b, c]);

        // Linked: only a + b are planned (via change file); c is in the group but unchanged.
        const config: VisReleaseConfig = { linked: [["a", "b", "c"]] };
        const plan = assembleReleasePlan([cf(`---\na: minor\nb: patch\n---\n`)], graph, config);

        expect(findRelease(plan, "a")?.type).toBe("minor");
        expect(findRelease(plan, "b")?.type).toBe("minor"); // upgraded to match max
        expect(findRelease(plan, "c")).toBeUndefined(); // NOT pulled in
    });
});

// ── Phase C — proactive propagation ────────────────────────────────

describe("release-plan: phase C1 — bump-file cascade", () => {
    it("cascades to globbed packages from nested change file", () => {
        expect.hasAssertions();

        const a = mkPkg("@scope/core");
        const b = mkPkg("@scope/plugin-foo");
        const c = mkPkg("@scope/plugin-bar");
        const d = mkPkg("@scope/unrelated");
        const graph = new DependencyGraph([a, b, c, d]);

        const file = cf(`---\n"@scope/core":\n  bump: minor\n  cascade:\n    "@scope/plugin-*": patch\n---\n`);
        const plan = assembleReleasePlan([file], graph, {});

        expect(findRelease(plan, "@scope/plugin-foo")?.type).toBe("patch");
        expect(findRelease(plan, "@scope/plugin-bar")?.type).toBe("patch");
        expect(findRelease(plan, "@scope/unrelated")).toBeUndefined();
        expect(findRelease(plan, "@scope/plugin-foo")?.isCascadeBump).toBe(true);
    });

    it("runs cascade even in out-of-range mode", () => {
        expect.hasAssertions();

        const a = mkPkg("a");
        const b = mkPkg("b"); // not depending on a — pure cascade
        const graph = new DependencyGraph([a, b]);

        const file = cf(`---\na:\n  bump: minor\n  cascade:\n    b: patch\n---\n`);
        const plan = assembleReleasePlan([file], graph, { updateInternalDependencies: "out-of-range" });

        expect(findRelease(plan, "b")?.type).toBe("patch");
    });
});

describe("release-plan: phase C2 — cascadeTo from per-pkg config", () => {
    it("triggers cascadeTo when source bump meets trigger", () => {
        expect.hasAssertions();

        const a = mkPkg("a");
        const b = mkPkg("b");
        const graph = new DependencyGraph([a, b]);

        const plan = assembleReleasePlan(
            [cf(`---\na: minor\n---\n`)],
            graph,
            {},
            {
                perPackageConfig: new Map([
                    ["a", { cascadeTo: { b: { bumpAs: "patch", trigger: "minor" } } }],
                ]),
            },
        );

        expect(findRelease(plan, "b")?.type).toBe("patch");
        expect(findRelease(plan, "b")?.isCascadeBump).toBe(true);
    });

    it("does not trigger cascadeTo when source bump is below trigger", () => {
        expect.hasAssertions();

        const a = mkPkg("a");
        const b = mkPkg("b");
        const graph = new DependencyGraph([a, b]);

        const plan = assembleReleasePlan(
            [cf(`---\na: patch\n---\n`)],
            graph,
            {},
            {
                perPackageConfig: new Map([
                    ["a", { cascadeTo: { b: { bumpAs: "patch", trigger: "minor" } } }],
                ]),
            },
        );

        expect(findRelease(plan, "b")).toBeUndefined();
    });

    it("supports bumpAs: 'match' to inherit source level", () => {
        expect.hasAssertions();

        const a = mkPkg("a");
        const b = mkPkg("b");
        const graph = new DependencyGraph([a, b]);

        const plan = assembleReleasePlan(
            [cf(`---\na: major\n---\n`)],
            graph,
            {},
            {
                perPackageConfig: new Map([
                    ["a", { cascadeTo: { b: { bumpAs: "match", trigger: "patch" } } }],
                ]),
            },
        );

        expect(findRelease(plan, "b")?.type).toBe("major");
    });
});

describe("release-plan: phase C3 — dep-graph rules (gated by mode)", () => {
    it("does NOT run dep-graph rules in out-of-range mode", () => {
        expect.hasAssertions();

        const a = mkPkg("a");
        const b = mkPkg("b", { dependencies: { a: "^1.0.0" } });
        const graph = new DependencyGraph([a, b]);

        // a 1.0.0 → 1.1.0 stays in ^1.0.0, so out-of-range wouldn't trigger.
        const plan = assembleReleasePlan(
            [cf(`---\na: minor\n---\n`)],
            graph,
            { updateInternalDependencies: "out-of-range" },
        );

        expect(findRelease(plan, "b")).toBeUndefined();
    });

    it("runs dep-graph rules in patch mode (default rule: deps:patch:patch)", () => {
        expect.hasAssertions();

        const a = mkPkg("a");
        const b = mkPkg("b", { dependencies: { a: "^1.0.0" } });
        const graph = new DependencyGraph([a, b]);

        const plan = assembleReleasePlan(
            [cf(`---\na: patch\n---\n`)],
            graph,
            { updateInternalDependencies: "patch" },
        );

        expect(findRelease(plan, "b")?.type).toBe("patch");
        expect(findRelease(plan, "b")?.reasons).toContain("DEPENDENCY_BUMPED");
    });

    it("respects minor-mode threshold — patch source does not trigger", () => {
        expect.hasAssertions();

        const a = mkPkg("a");
        const b = mkPkg("b", { dependencies: { a: "^1.0.0" } });
        const graph = new DependencyGraph([a, b]);

        const plan = assembleReleasePlan(
            [cf(`---\na: patch\n---\n`)],
            graph,
            { updateInternalDependencies: "minor" },
        );

        // patch < minor threshold → no propagation in this mode
        expect(findRelease(plan, "b")).toBeUndefined();
    });
});

// ── Combined scenarios ────────────────────────────────────────────

describe("release-plan: combined scenarios", () => {
    it("max-merges multiple change files for the same package", () => {
        expect.hasAssertions();

        const a = mkPkg("a");
        const graph = new DependencyGraph([a]);

        const files = [
            cf(`---\na: patch\n---\n`, "1.md"),
            cf(`---\na: minor\n---\n`, "2.md"),
            cf(`---\na: patch\n---\n`, "3.md"),
        ];

        const plan = assembleReleasePlan(files, graph, {});

        expect(findRelease(plan, "a")?.type).toBe("minor");
        expect(findRelease(plan, "a")?.changeFiles).toHaveLength(3);
    });

    it("`none` entries are recorded but produce no release", () => {
        expect.hasAssertions();

        const a = mkPkg("a");
        const b = mkPkg("b");
        const graph = new DependencyGraph([a, b]);

        const plan = assembleReleasePlan([cf(`---\na: none\nb: patch\n---\n`)], graph, {});

        expect(findRelease(plan, "a")).toBeUndefined();
        expect(findRelease(plan, "b")?.type).toBe("patch");
    });

    it("warns about non-workspace package references", () => {
        expect.hasAssertions();

        const a = mkPkg("a");
        const graph = new DependencyGraph([a]);

        const plan = assembleReleasePlan([cf(`---\nnonexistent-pkg: minor\n---\n`)], graph, {});

        expect(plan.warnings.some((w) => w.includes("nonexistent-pkg"))).toBe(true);
        expect(plan.releases).toHaveLength(0);
    });

    it("returns deterministic alphabetical ordering", () => {
        expect.hasAssertions();

        const c = mkPkg("c");
        const a = mkPkg("a");
        const b = mkPkg("b");
        const graph = new DependencyGraph([c, a, b]);

        const plan = assembleReleasePlan([cf(`---\na: minor\nb: minor\nc: minor\n---\n`)], graph, {});

        expect(plan.releases.map((r) => r.name)).toStrictEqual(["a", "b", "c"]);
    });
});

// ── Channel-aware version computation ──────────────────────────────

describe("release-plan: channel-aware version computation", () => {
    it("opens prerelease line when prerelease option is set", () => {
        expect.hasAssertions();

        const a = mkPkg("a", { version: "1.2.3" });
        const graph = new DependencyGraph([a]);

        const plan = assembleReleasePlan([cf(`---\na: minor\n---\n`)], graph, {}, { prerelease: "alpha" });

        expect(findRelease(plan, "a")?.newVersion).toBe("1.3.0-alpha.0");
    });

    it("computes plain semver when no prerelease option is set", () => {
        expect.hasAssertions();

        const a = mkPkg("a", { version: "1.2.3" });
        const graph = new DependencyGraph([a]);

        const plan = assembleReleasePlan([cf(`---\na: minor\n---\n`)], graph, {});

        expect(findRelease(plan, "a")?.newVersion).toBe("1.3.0");
    });

    it("computes prerelease versions for cascaded dep bumps too", () => {
        expect.hasAssertions();

        const a = mkPkg("a", { version: "1.0.0" });
        const b = mkPkg("b", { dependencies: { a: "~1.0.0" }, version: "2.0.0" });
        const graph = new DependencyGraph([a, b]);

        const plan = assembleReleasePlan([cf(`---\na: minor\n---\n`)], graph, {}, { prerelease: "alpha" });

        expect(findRelease(plan, "a")?.newVersion).toBe("1.1.0-alpha.0");
        expect(findRelease(plan, "b")?.newVersion).toBe("2.0.1-alpha.0");
    });
});

// ── catalogConsumers cascade (changesets #1707) ─────────────────────

describe("release-plan: catalog change cascade", () => {
    it("seeds a patch bump on every consumer fed in via catalogConsumers", () => {
        // The orchestrator passes a pre-computed list of "this catalog
        // dep moved → these consumer packages need a patch bump". The
        // plan assembler just upserts them and lets the rest of the
        // pipeline do its thing.
        expect.hasAssertions();

        const consumer = mkPkg("consumer", { dependencies: { react: "catalog:" } });
        const graph = new DependencyGraph([consumer]);

        const plan = assembleReleasePlan([], graph, {}, {
            catalogConsumers: [
                {
                    catalog: "",
                    dep: "react",
                    newVersion: "^18.3.0",
                    oldVersion: "^18.2.0",
                    packageName: "consumer",
                },
            ],
        });

        const release = findRelease(plan, "consumer");

        expect(release).toBeDefined();
        expect(release?.type).toBe("patch");
        expect(release?.reasons).toContain("CATALOG_CHANGED");
        expect(release?.isDependencyBump).toBe(true);
    });

    it("does not bump consumers that aren't part of the workspace dep-graph (ignore/include filter)", () => {
        // A consumer registered in pnpm-workspace.yaml but excluded
        // from the workspace dep-graph (e.g. via `release.ignore`)
        // should be silently skipped — operators who filtered the
        // package out don't want it back.
        expect.hasAssertions();

        const present = mkPkg("present", { dependencies: { react: "catalog:" } });
        const graph = new DependencyGraph([present]);

        const plan = assembleReleasePlan([], graph, {}, {
            catalogConsumers: [
                { catalog: "", dep: "react", newVersion: "^18.3.0", oldVersion: "^18.2.0", packageName: "present" },
                { catalog: "", dep: "react", newVersion: "^18.3.0", oldVersion: "^18.2.0", packageName: "filtered" },
            ],
        });

        expect(plan.releases.map((r) => r.name)).toStrictEqual(["present"]);
    });

    it("composes with explicit bumps — CATALOG_CHANGED appears alongside other reasons when both fire", () => {
        // A consumer with both an explicit bump from a change file AND
        // a catalog cascade should have both reasons attributed. The
        // bump level is the max of the two (minor > patch).
        expect.hasAssertions();

        const consumer = mkPkg("consumer", { dependencies: { react: "catalog:" } });
        const graph = new DependencyGraph([consumer]);

        const plan = assembleReleasePlan(
            [cf(`---\nconsumer: minor\n---\n`)],
            graph,
            {},
            {
                catalogConsumers: [
                    { catalog: "", dep: "react", newVersion: "^18.3.0", oldVersion: "^18.2.0", packageName: "consumer" },
                ],
            },
        );

        const release = findRelease(plan, "consumer");

        expect(release?.type).toBe("minor");
        expect(release?.reasons.sort()).toStrictEqual(["CATALOG_CHANGED", "EXPLICIT"]);
    });

    it("cascades through Phase A — out-of-range dependents of a catalog-bumped consumer get pulled in too", () => {
        // a consumes `react` via catalog; b depends on a with a tight
        // range. When the catalog cascade bumps a (patch), Phase A
        // notices b's range no longer satisfies the new version and
        // pulls b into the plan as a dependency bump.
        expect.hasAssertions();

        const a = mkPkg("a", { dependencies: { react: "catalog:" }, version: "1.0.0" });
        const b = mkPkg("b", { dependencies: { a: "1.0.0" }, version: "1.0.0" });
        const graph = new DependencyGraph([a, b]);

        const plan = assembleReleasePlan([], graph, {}, {
            catalogConsumers: [
                { catalog: "", dep: "react", newVersion: "^18.3.0", oldVersion: "^18.2.0", packageName: "a" },
            ],
        });

        expect(findRelease(plan, "a")?.reasons).toContain("CATALOG_CHANGED");
        // b was pulled in by Phase A because a's new version broke its tight range.
        expect(findRelease(plan, "b")).toBeDefined();
        expect(findRelease(plan, "b")?.reasons).toContain("DEPENDENCY_OUT_OF_RANGE");
    });

    it("no-ops when catalogConsumers is empty / undefined (backwards compat)", () => {
        expect.hasAssertions();

        const a = mkPkg("a");
        const graph = new DependencyGraph([a]);

        const plan = assembleReleasePlan([], graph, {}, {});

        expect(plan.releases).toStrictEqual([]);
    });

    // F13: every CATALOG_CHANGED entry must record a `source` so the
    // default changelog formatter has something to render. Without it,
    // the formatter walks an empty `sources` array and emits a blank
    // dependency-bump line.
    it("records a synthetic catalog source on each CATALOG_CHANGED entry", () => {
        expect.hasAssertions();

        const consumer = mkPkg("consumer", { dependencies: { lodash: "catalog:" } });
        const graph = new DependencyGraph([consumer]);

        const plan = assembleReleasePlan([], graph, {}, {
            catalogConsumers: [
                {
                    catalog: "",
                    dep: "lodash",
                    newVersion: "4.17.21",
                    oldVersion: "4.17.20",
                    packageName: "consumer",
                },
            ],
        });

        const release = findRelease(plan, "consumer");

        expect(release).toBeDefined();
        expect(release?.sources).toHaveLength(1);
        expect(release?.sources[0]?.name).toBe("catalog:/lodash");
        expect(release?.sources[0]?.bumpType).toBe("patch");
        expect(release?.sources[0]?.newVersion).toBe("4.17.21");
    });

    it("records the named-catalog source verbatim (catalog:dev/vitest)", () => {
        expect.hasAssertions();

        const consumer = mkPkg("consumer", { devDependencies: { vitest: "catalog:dev" } });
        const graph = new DependencyGraph([consumer]);

        const plan = assembleReleasePlan([], graph, {}, {
            catalogConsumers: [
                {
                    catalog: "dev",
                    dep: "vitest",
                    newVersion: "^2.1.0",
                    oldVersion: "^2.0.0",
                    packageName: "consumer",
                },
            ],
        });

        const release = findRelease(plan, "consumer");

        expect(release?.sources[0]?.name).toBe("catalog:dev/vitest");
        expect(release?.sources[0]?.newVersion).toBe("^2.1.0");
    });

    it("falls back to empty string when the catalog entry was removed (newVersion undefined)", () => {
        expect.hasAssertions();

        const consumer = mkPkg("consumer", { dependencies: { legacy: "catalog:" } });
        const graph = new DependencyGraph([consumer]);

        const plan = assembleReleasePlan([], graph, {}, {
            catalogConsumers: [
                {
                    catalog: "",
                    dep: "legacy",
                    newVersion: undefined,
                    oldVersion: "1.0.0",
                    packageName: "consumer",
                },
            ],
        });

        const release = findRelease(plan, "consumer");

        expect(release?.sources[0]?.name).toBe("catalog:/legacy");
        expect(release?.sources[0]?.newVersion).toBe("");
    });
});

// ── F12: bumpDevDependencies wide-fanout warning ───────────────────

describe("release-plan: bumpDevDependencies fanout warning (F12)", () => {
    it("warns when `bumpDevDependencies: true` triggers > 10 patch-cascades from a single source", () => {
        // 11 devdep consumers of the same source — one above the
        // threshold. The warning calls out the source name so operators
        // can decide whether to narrow to the array form.
        expect.hasAssertions();

        const source = mkPkg("source");
        const consumers = Array.from({ length: 11 }, (_, i) => mkPkg(`consumer-${i}`, { devDependencies: { source: "1.0.0" } }));
        const graph = new DependencyGraph([source, ...consumers]);

        const plan = assembleReleasePlan(
            [cf(`---\nsource: minor\n---\n`)],
            graph,
            { bumpDevDependencies: true },
        );

        const fanoutWarning = plan.warnings.find((w) => w.includes("patch-cascades"));

        expect(fanoutWarning).toBeDefined();
        expect(fanoutWarning).toContain("source");
        expect(fanoutWarning).toContain("array form");
        // Threshold (10) + 1 must appear in the message — exactly 11 cascades.
        expect(fanoutWarning).toContain("11");
    });

    it("does NOT warn when the fanout sits at-or-below the threshold", () => {
        expect.hasAssertions();

        const source = mkPkg("source");
        // 10 consumers — at the threshold, not above it.
        const consumers = Array.from({ length: 10 }, (_, i) => mkPkg(`consumer-${i}`, { devDependencies: { source: "1.0.0" } }));
        const graph = new DependencyGraph([source, ...consumers]);

        const plan = assembleReleasePlan(
            [cf(`---\nsource: minor\n---\n`)],
            graph,
            { bumpDevDependencies: true },
        );

        expect(plan.warnings.some((w) => w.includes("patch-cascades"))).toBe(false);
    });

    it("does NOT warn when `bumpDevDependencies` is an array (operator already opted into narrow scope)", () => {
        // Same wide fanout, but the operator explicitly listed the
        // source — no nudge needed because the cascade is intentional.
        expect.hasAssertions();

        const source = mkPkg("source");
        const consumers = Array.from({ length: 20 }, (_, i) => mkPkg(`consumer-${i}`, { devDependencies: { source: "1.0.0" } }));
        const graph = new DependencyGraph([source, ...consumers]);

        const plan = assembleReleasePlan(
            [cf(`---\nsource: minor\n---\n`)],
            graph,
            { bumpDevDependencies: ["source"] },
        );

        expect(plan.warnings.some((w) => w.includes("patch-cascades"))).toBe(false);
    });

    it("emits a single warning per source after the fixed-point loop with the final count", () => {
        // 12 consumers — well above the threshold. The warning text
        // reflects the FINAL fanout (12), not whatever count happened to
        // trip the threshold mid-loop.
        expect.hasAssertions();

        const source = mkPkg("source");
        const consumers = Array.from({ length: 12 }, (_, i) => mkPkg(`consumer-${i}`, { devDependencies: { source: "1.0.0" } }));
        const graph = new DependencyGraph([source, ...consumers]);

        const plan = assembleReleasePlan(
            [cf(`---\nsource: minor\n---\n`)],
            graph,
            { bumpDevDependencies: true },
        );

        const fanoutWarnings = plan.warnings.filter((w) => w.includes("patch-cascades"));

        expect(fanoutWarnings).toHaveLength(1);
        expect(fanoutWarnings[0]).toContain("12 patch-cascades");
    });
});
