import { describe, expect, it } from "vitest";

import type { ChangelogContext } from "../../../src/release/core/changelog/api";
import { createKeepAChangelogFormatter } from "../../../src/release/core/changelog/keep-a-changelog";
import type { PlannedRelease } from "../../../src/release/types";

const mkRelease = (overrides: Partial<PlannedRelease> = {}): PlannedRelease => {
    return {
        changeFiles: [],
        isCascadeBump: false,
        isDependencyBump: false,
        isGroupBump: false,
        name: "@scope/pkg",
        newVersion: "1.1.0",
        oldVersion: "1.0.0",
        reasons: ["EXPLICIT"],
        sources: [],
        type: "minor",
        ...overrides,
    };
};

const mkCtx = (overrides: Partial<ChangelogContext> = {}): ChangelogContext => {
    return {
        changeFiles: [],
        date: "2026-05-02",
        release: mkRelease(),
        target: "changelog",
        ...overrides,
    };
};

describe("keep-a-changelog formatter", () => {
    it("renders the version+date header per Keep-a-Changelog spec", async () => {
        const fmt = createKeepAChangelogFormatter();

        const result = await fmt(mkCtx());

        expect(result).toContain("## [1.1.0] - 2026-05-02");
    });

    it("strips version heading for github-release target", async () => {
        const fmt = createKeepAChangelogFormatter();

        const result = await fmt(mkCtx({ target: "github-release" }));

        expect(result).not.toContain("## [1.1.0]");
    });

    it("buckets `feat:` lines into Added", async () => {
        const fmt = createKeepAChangelogFormatter();
        const result = await fmt(mkCtx({
            changeFiles: [{ body: "feat: shiny new thing", id: "x", path: "x.md", payload: { bumps: { "@scope/pkg": "minor" } } }],
        }));

        expect(result).toMatch(/### Added\s*\n\s*\n- shiny new thing/);
    });

    it("buckets `fix:` lines into Fixed", async () => {
        const fmt = createKeepAChangelogFormatter();
        const result = await fmt(mkCtx({
            changeFiles: [{ body: "fix: a flaky bug", id: "x", path: "x.md", payload: { bumps: { "@scope/pkg": "patch" } } }],
            release: mkRelease({ newVersion: "1.0.1", oldVersion: "1.0.0", type: "patch" }),
        }));

        expect(result).toMatch(/### Fixed\s*\n\s*\n- a flaky bug/);
    });

    it("respects explicit `[Section]` prefix overrides", async () => {
        const fmt = createKeepAChangelogFormatter();
        const result = await fmt(mkCtx({
            changeFiles: [{ body: "[Security] Patched a CVE\n[Deprecated] old API", id: "x", path: "x.md", payload: { bumps: { "@scope/pkg": "minor" } } }],
        }));

        expect(result).toContain("### Security");
        expect(result).toContain("- Patched a CVE");
        expect(result).toContain("### Deprecated");
        expect(result).toContain("- old API");
    });

    it("falls back to bump-type heuristic when no prefix found", async () => {
        const fmt = createKeepAChangelogFormatter();
        const result = await fmt(mkCtx({
            changeFiles: [{ body: "did stuff", id: "x", path: "x.md", payload: { bumps: { "@scope/pkg": "minor" } } }],
            release: mkRelease({ type: "minor" }),
        }));

        // minor → Added by default heuristic
        expect(result).toMatch(/### Added\s*\n\s*\n- did stuff/);
    });

    it("emits BREAKING CHANGES section for major bumps", async () => {
        const fmt = createKeepAChangelogFormatter();
        const result = await fmt(mkCtx({
            changeFiles: [{ body: "feat!: removed old api", id: "x", path: "x.md", payload: { bumps: { "@scope/pkg": "major" } } }],
            release: mkRelease({ newVersion: "2.0.0", oldVersion: "1.0.0", type: "major" }),
        }));

        expect(result).toContain("### ⚠ BREAKING CHANGES");
        expect(result).toContain("- removed old api");
    });

    it("emits BREAKING CHANGES when body contains BREAKING CHANGE", async () => {
        const fmt = createKeepAChangelogFormatter();
        const result = await fmt(mkCtx({
            changeFiles: [{ body: "feat: added thing\n\nBREAKING CHANGE: caller must update config", id: "x", path: "x.md", payload: { bumps: { "@scope/pkg": "major" } } }],
            release: mkRelease({ type: "minor" }),
        }));

        expect(result).toContain("### ⚠ BREAKING CHANGES");
    });

    it("appends a comparison-link footer when repo is provided", async () => {
        const fmt = createKeepAChangelogFormatter({ repo: "owner/repo" });
        const result = await fmt(mkCtx());

        expect(result).toContain("[1.1.0]: https://github.com/owner/repo/compare/@scope/pkg@1.0.0...@scope/pkg@1.1.0");
    });

    it("supports compareUrlPrefix override (e.g. self-hosted GitLab)", async () => {
        const fmt = createKeepAChangelogFormatter({ compareUrlPrefix: "https://gitlab.example/group/proj" });
        const result = await fmt(mkCtx());

        expect(result).toContain("[1.1.0]: https://gitlab.example/group/proj/compare/@scope/pkg@1.0.0...@scope/pkg@1.1.0");
    });

    it("omits link footer when neither repo nor compareUrlPrefix provided", async () => {
        const fmt = createKeepAChangelogFormatter();
        const result = await fmt(mkCtx());

        expect(result).not.toContain("[1.1.0]:");
    });

    it("emits cascade lines under Changed", async () => {
        const fmt = createKeepAChangelogFormatter();
        const result = await fmt(mkCtx({
            release: mkRelease({
                isCascadeBump: true,
                sources: [{ bumpType: "minor", name: "@scope/core", newVersion: "2.0.0" }],
            }),
        }));

        expect(result).toContain("### Changed");
        expect(result).toContain("Cascade from `@scope/core`@2.0.0");
    });

    it("ignores empty sections", async () => {
        const fmt = createKeepAChangelogFormatter();
        const result = await fmt(mkCtx({
            changeFiles: [{ body: "feat: only an addition", id: "x", path: "x.md", payload: { bumps: { "@scope/pkg": "minor" } } }],
        }));

        expect(result).toContain("### Added");
        expect(result).not.toContain("### Fixed");
        expect(result).not.toContain("### Removed");
        expect(result).not.toContain("### Security");
    });
});
