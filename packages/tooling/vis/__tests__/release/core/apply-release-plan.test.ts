import { describe, expect, it } from "vitest";

import { applyReleasePlan, prependChangelog, rewriteRangeForVersion } from "../../../src/release/core/apply-release-plan";
import { DependencyGraph } from "../../../src/release/core/dep-graph";
import type { PlannedRelease, ReleasePlan, WorkspacePackage } from "../../../src/release/types";

const mkPkg = (name: string, version = "1.0.0", deps: Record<string, string> = {}): WorkspacePackage => {
    return {
        dir: `/repo/packages/${name}`,
        manifest: { dependencies: Object.keys(deps).length > 0 ? deps : undefined, name, version },
        manifestPath: `/repo/packages/${name}/package.json`,
        name,
        private: false,
        version,
    };
};

const mkRelease = (name: string, oldV: string, newV: string, type: PlannedRelease["type"] = "minor"): PlannedRelease => {
    return {
        changeFiles: [],
        isCascadeBump: false,
        isDependencyBump: false,
        isGroupBump: false,
        name,
        newVersion: newV,
        oldVersion: oldV,
        reasons: ["EXPLICIT"],
        sources: [],
        type,
    };
};

describe("rewriteRangeForVersion — preserves protocol prefixes (RFC §11.1)", () => {
    it("preserves workspace:^ prefix", () => {
        expect(rewriteRangeForVersion("workspace:^1.0.0", "2.0.0")).toBe("workspace:^2.0.0");
    });

    it("preserves workspace:~ prefix", () => {
        expect(rewriteRangeForVersion("workspace:~1.0.0", "2.0.0")).toBe("workspace:~2.0.0");
    });

    it("preserves workspace:* shorthand", () => {
        expect(rewriteRangeForVersion("workspace:*", "2.0.0")).toBe("workspace:*");
    });

    it("preserves workspace:^ shorthand", () => {
        expect(rewriteRangeForVersion("workspace:^", "2.0.0")).toBe("workspace:^");
    });

    it("preserves workspace:~ shorthand", () => {
        expect(rewriteRangeForVersion("workspace:~", "2.0.0")).toBe("workspace:~");
    });

    it("preserves catalog: refs (catalog updates flow elsewhere)", () => {
        expect(rewriteRangeForVersion("catalog:dev", "2.0.0")).toBe("catalog:dev");
        expect(rewriteRangeForVersion("catalog:", "2.0.0")).toBe("catalog:");
    });

    it("rewrites plain ^ ranges", () => {
        expect(rewriteRangeForVersion("^1.0.0", "2.0.0")).toBe("^2.0.0");
    });

    it("rewrites plain ~ ranges", () => {
        expect(rewriteRangeForVersion("~1.0.0", "2.0.0")).toBe("~2.0.0");
    });

    it("preserves >= and other operators", () => {
        expect(rewriteRangeForVersion(">=1.0.0", "2.0.0")).toBe(">=2.0.0");
    });

    it("defaults to ^ when no prefix is present", () => {
        expect(rewriteRangeForVersion("1.0.0", "2.0.0")).toBe("^2.0.0");
    });

    it("rewrites npm: alias inner spec", () => {
        expect(rewriteRangeForVersion("npm:other-pkg@^1.0.0", "2.0.0")).toBe("npm:other-pkg@^2.0.0");
    });

    it("preserves * as-is", () => {
        expect(rewriteRangeForVersion("*", "2.0.0")).toBe("*");
    });
});

describe("prependChangelog — handles 3 RFC §17.4 cases", () => {
    it("inserts after `# Title` when present (bumpy/changesets convention)", () => {
        const existing = `# Changelog\n\n## 1.0.0\n\nold entry\n`;
        const result = prependChangelog("## 1.1.0\n<sub>2026-05-02</sub>\n\n- new", existing);

        expect(result.startsWith("# Changelog\n")).toBe(true);
        expect(result.indexOf("## 1.1.0")).toBeLessThan(result.indexOf("## 1.0.0"));
    });

    it("inserts at top when file starts with `##` (semantic-release convention)", () => {
        const existing = `## @scope/pkg [1.0.0](compare) (2026-04-01)\n\n### Bug Fixes\n\n* old\n`;
        const result = prependChangelog("## 1.1.0\n<sub>2026-05-02</sub>\n\n- new", existing);

        expect(result.startsWith("## 1.1.0")).toBe(true);
        expect(result).toContain("## @scope/pkg [1.0.0]");
    });

    it("creates `# Changelog` header when file is empty/missing", () => {
        const result = prependChangelog("## 1.0.0\n<sub>2026-05-02</sub>\n\n- first", undefined);

        expect(result.startsWith("# Changelog\n")).toBe(true);
        expect(result).toContain("## 1.0.0");
    });

    it("creates header for empty-string file", () => {
        const result = prependChangelog("## 1.0.0\n<sub>2026-05-02</sub>", "");

        expect(result.startsWith("# Changelog")).toBe(true);
    });
});

describe("applyReleasePlan — produces structured AppliedPlan", () => {
    it("emits writes for each released package's manifest + changelog", async () => {
        const a = mkPkg("a", "1.0.0");
        const graph = new DependencyGraph([a]);

        const plan: ReleasePlan = {
            consumedChangeFiles: [],
            releases: [mkRelease("a", "1.0.0", "1.1.0")],
            warnings: [],
        };

        const applied = await applyReleasePlan(plan, graph);

        // Two writes per release: package.json + CHANGELOG.md
        expect(applied.writes).toHaveLength(2);
        expect(applied.writes[0]?.path).toBe(a.manifestPath);
        expect(applied.writes[1]?.path).toBe("/repo/packages/a/CHANGELOG.md");
        expect(applied.writes[0]?.content).toContain("\"version\": \"1.1.0\"");
    });

    it("rewrites internal-dep ranges in dependent's manifest", async () => {
        const a = mkPkg("a", "1.0.0");
        const b = mkPkg("b", "2.0.0", { a: "^1.0.0" });
        const graph = new DependencyGraph([a, b]);

        const plan: ReleasePlan = {
            consumedChangeFiles: [],
            releases: [mkRelease("a", "1.0.0", "1.1.0"), mkRelease("b", "2.0.0", "2.0.1", "patch")],
            warnings: [],
        };

        const applied = await applyReleasePlan(plan, graph);

        const bManifestWrite = applied.writes.find((w) => w.path === b.manifestPath);

        expect(bManifestWrite).toBeDefined();
        expect(bManifestWrite?.content).toContain("\"a\": \"^1.1.0\"");
    });

    it("preserves workspace: prefix when rewriting", async () => {
        const a = mkPkg("a", "1.0.0");
        const b = mkPkg("b", "2.0.0", { a: "workspace:^1.0.0" });
        const graph = new DependencyGraph([a, b]);

        const plan: ReleasePlan = {
            consumedChangeFiles: [],
            releases: [mkRelease("a", "1.0.0", "1.1.0"), mkRelease("b", "2.0.0", "2.0.1", "patch")],
            warnings: [],
        };

        const applied = await applyReleasePlan(plan, graph);
        const bManifestWrite = applied.writes.find((w) => w.path === b.manifestPath);

        expect(bManifestWrite?.content).toContain("\"a\": \"workspace:^1.1.0\"");
    });

    it("propagates change-file deletions into the deletions list", async () => {
        const a = mkPkg("a", "1.0.0");
        const graph = new DependencyGraph([a]);

        const plan: ReleasePlan = {
            consumedChangeFiles: [
                { body: "", id: "abc", path: ".vis/release/abc.md", payload: { bumps: { a: "minor" } } },
            ],
            releases: [mkRelease("a", "1.0.0", "1.1.0")],
            warnings: [],
        };

        const applied = await applyReleasePlan(plan, graph);

        expect(applied.deletions).toEqual([".vis/release/abc.md"]);
    });
});
