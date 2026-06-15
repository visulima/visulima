import { describe, expect, it } from "vitest";

import type { ChangelogContext, ChangelogFormatter } from "../../../src/release/core/changelog/api";
import {
    renderWorkspaceChangelog,
    resolveGroupChangelogRouting,
    workspaceChangelogPath,
} from "../../../src/release/core/changelog/workspace";
import type { PlannedRelease, VisReleaseConfig, WorkspacePackage } from "../../../src/release/types";

const mkRelease = (name: string, version: string): PlannedRelease => {
    return {
        changeFiles: [],
        isCascadeBump: false,
        isDependencyBump: false,
        isGroupBump: false,
        name,
        newVersion: version,
        oldVersion: "1.0.0",
        reasons: ["EXPLICIT"],
        sources: [],
        type: "minor",
    };
};

const stubFormatter: ChangelogFormatter = (ctx: ChangelogContext): string => `Body for ${ctx.release.name}`;

describe(workspaceChangelogPath, () => {
    it("defaults to CHANGELOG.md at workspace root", () => {
        expect(workspaceChangelogPath("/r")).toBe("/r/CHANGELOG.md");
    });

    it("respects custom file option", () => {
        expect(workspaceChangelogPath("/r", { file: "RELEASES.md" })).toBe("/r/RELEASES.md");
    });

    it("preserves absolute paths", () => {
        expect(workspaceChangelogPath("/r", { file: "/elsewhere/log.md" })).toBe("/elsewhere/log.md");
    });
});

describe(renderWorkspaceChangelog, () => {
    it("emits a heading + per-release sections", async () => {
        const releases = [mkRelease("@scope/a", "1.1.0"), mkRelease("@scope/b", "2.1.0")];
        const out = await renderWorkspaceChangelog(releases, "2026-05-02", stubFormatter);

        expect(out).toContain("Release wave 2026-05-02 (2 packages)");
        expect(out).toContain("### @scope/a → 1.1.0");
        expect(out).toContain("### @scope/b → 2.1.0");
        expect(out).toContain("Body for @scope/a");
        expect(out).toContain("Body for @scope/b");
    });

    it("supports {date} and {count} tokens in custom waveHeading", async () => {
        const releases = [mkRelease("a", "1.1.0")];
        const out = await renderWorkspaceChangelog(releases, "2026-05-02", stubFormatter, {
            waveHeading: "## My release on {date} — {count} bumps",
        });

        expect(out).toContain("## My release on 2026-05-02 — 1 bumps");
    });

    it("emits placeholder when a per-release formatter returns empty", async () => {
        const emptyFormatter: ChangelogFormatter = () => "";
        const releases = [mkRelease("a", "1.1.0")];
        const out = await renderWorkspaceChangelog(releases, "2026-05-02", emptyFormatter);

        expect(out).toContain("_No changelog entries._");
    });

    it("forwards the github-release target so per-release formatter strips its version heading", async () => {
        let captured: ChangelogContext | undefined;
        const captureFormatter: ChangelogFormatter = (ctx) => {
            captured = ctx;

            return "captured";
        };

        await renderWorkspaceChangelog([mkRelease("a", "1.1.0")], "2026-05-02", captureFormatter);

        expect(captured?.target).toBe("github-release");
    });
});

// ── Shared group changelog routing (changesets #1059) ─────────────

const mkPkg = (name: string, dir: string): WorkspacePackage => {
    return {
        dir,
        manifest: { name, version: "1.0.0" },
        manifestPath: `${dir}/package.json`,
        name,
        private: false,
        version: "1.0.0",
    };
};

describe(resolveGroupChangelogRouting, () => {
    const packages = [
        mkPkg("@scope/a", "/r/packages/a"),
        mkPkg("@scope/b", "/r/packages/b"),
        mkPkg("@scope/c", "/r/packages/c"),
    ];

    it("returns an empty map when no group opts into shared mode", () => {
        const config: VisReleaseConfig = {
            fixed: [["@scope/a", "@scope/b"]],
        };

        const routing = resolveGroupChangelogRouting(config, packages, "/r");

        expect(routing.size).toBe(0);
    });

    it("routes shared fixed-group members to a single default path", () => {
        const config: VisReleaseConfig = {
            fixed: [
                {
                    changelog: { mode: "shared" },
                    packages: ["@scope/a", "@scope/b"],
                },
            ],
        };

        const routing = resolveGroupChangelogRouting(config, packages, "/r");

        // Default: lexicographically-first member's dir + GROUP-CHANGELOG.md.
        expect(routing.get("@scope/a")).toBe("/r/packages/a/GROUP-CHANGELOG.md");
        expect(routing.get("@scope/b")).toBe("/r/packages/a/GROUP-CHANGELOG.md");
    });

    it("honours an explicit `path` override (relative)", () => {
        const config: VisReleaseConfig = {
            fixed: [
                {
                    changelog: { mode: "shared", path: "CHANGELOG-GROUP.md" },
                    packages: ["@scope/a", "@scope/b"],
                },
            ],
        };

        const routing = resolveGroupChangelogRouting(config, packages, "/r");

        expect(routing.get("@scope/a")).toBe("/r/CHANGELOG-GROUP.md");
        expect(routing.get("@scope/b")).toBe("/r/CHANGELOG-GROUP.md");
    });

    it("honours an explicit `path` override (absolute)", () => {
        const config: VisReleaseConfig = {
            linked: [
                {
                    changelog: { mode: "shared", path: "/elsewhere/G.md" },
                    packages: ["@scope/a", "@scope/c"],
                },
            ],
        };

        const routing = resolveGroupChangelogRouting(config, packages, "/r");

        expect(routing.get("@scope/a")).toBe("/elsewhere/G.md");
        expect(routing.get("@scope/c")).toBe("/elsewhere/G.md");
    });

    it("keeps backward compat: a bare string[] group is per-package (no routing)", () => {
        const config: VisReleaseConfig = {
            fixed: [["@scope/a", "@scope/b"]],
            linked: [["@scope/c"]],
        };

        const routing = resolveGroupChangelogRouting(config, packages, "/r");

        expect(routing.size).toBe(0);
    });
});
