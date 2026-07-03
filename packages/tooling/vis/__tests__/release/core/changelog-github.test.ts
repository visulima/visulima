import { describe, expect, it } from "vitest";

import type { ChangelogContext } from "../../../src/release/core/changelog/api";
import { createGithubFormatter } from "../../../src/release/core/changelog/github";
import { MockRunner } from "../../../src/release/core/shell-runner";
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

const repoMockRunner = (repo = "owner/repo"): MockRunner => {
    const runner = new MockRunner();

    runner.on("git", ["config", "--get", "remote.origin.url"], () => {
        return {
            exitCode: 0,
            stderr: "",
            stdout: `https://github.com/${repo}.git\n`,
        };
    });
    runner.on("gh", ["repo", "view", "--json", "nameWithOwner", "-q", ".nameWithOwner"], () => {
        return {
            exitCode: 0,
            stderr: "",
            stdout: `${repo}\n`,
        };
    });

    return runner;
};

describe("github formatter", () => {
    it("renders header + sub date for changelog target", async () => {
        expect.hasAssertions();

        const runner = repoMockRunner();
        const fmt = createGithubFormatter({ repo: "owner/repo", runner });
        const result = await fmt(mkCtx());

        expect(result).toContain("## 1.1.0");
        expect(result).toContain("<sub>2026-05-02</sub>");
    });

    it("strips heading for github-release target", async () => {
        expect.hasAssertions();

        const runner = repoMockRunner();
        const fmt = createGithubFormatter({ repo: "owner/repo", runner });
        const result = await fmt(mkCtx({ target: "github-release" }));

        expect(result).not.toContain("## 1.1.0");
    });

    it("links #N references using the configured repo slug", async () => {
        expect.hasAssertions();

        const runner = repoMockRunner();
        const fmt = createGithubFormatter({ repo: "owner/repo", runner });

        const result = await fmt(
            mkCtx({
                changeFiles: [{ body: "Closes #42 and fixes #101", id: "x", path: "x.md", payload: { bumps: { "@scope/pkg": "minor" } } }],
            }),
        );

        expect(result).toContain("[#42](https://github.com/owner/repo/issues/42)");
        expect(result).toContain("[#101](https://github.com/owner/repo/issues/101)");
    });

    it("appends pr / commit refs from inline meta", async () => {
        expect.hasAssertions();

        const runner = repoMockRunner();
        const fmt = createGithubFormatter({ repo: "owner/repo", runner });

        const result = await fmt(
            mkCtx({
                changeFiles: [
                    {
                        body: "Add tab completion",
                        id: "x",
                        meta: { commit: "abc1234", pr: 42 },
                        path: "x.md",
                        payload: { bumps: { "@scope/pkg": "minor" } },
                    },
                ],
            }),
        );

        expect(result).toContain("[#42](https://github.com/owner/repo/pull/42)");
        expect(result).toContain("https://github.com/owner/repo/commit/abc1234");
    });

    it("emits 'Thanks @user!' when an author is present", async () => {
        expect.hasAssertions();

        const runner = repoMockRunner();
        const fmt = createGithubFormatter({ repo: "owner/repo", runner });

        const result = await fmt(
            mkCtx({
                changeFiles: [
                    {
                        body: "Add tab completion",
                        id: "x",
                        meta: { author: "@external-contributor" },
                        path: "x.md",
                        payload: { bumps: { "@scope/pkg": "minor" } },
                    },
                ],
            }),
        );

        expect(result).toMatch(/Thanks .*external-contributor/);
    });

    it("suppresses thanks for internalAuthors", async () => {
        expect.hasAssertions();

        const runner = repoMockRunner();
        const fmt = createGithubFormatter({
            internalAuthors: ["maintainer"],
            repo: "owner/repo",
            runner,
        });

        const result = await fmt(
            mkCtx({
                changeFiles: [
                    {
                        body: "Internal change",
                        id: "x",
                        meta: { author: "@maintainer" },
                        path: "x.md",
                        payload: { bumps: { "@scope/pkg": "minor" } },
                    },
                ],
            }),
        );

        expect(result).not.toContain("Thanks");
    });

    it("disables thanks when thankContributors is false", async () => {
        expect.hasAssertions();

        const runner = repoMockRunner();
        const fmt = createGithubFormatter({
            repo: "owner/repo",
            runner,
            thankContributors: false,
        });

        const result = await fmt(
            mkCtx({
                changeFiles: [
                    {
                        body: "Change",
                        id: "x",
                        meta: { author: "@anyone" },
                        path: "x.md",
                        payload: { bumps: { "@scope/pkg": "minor" } },
                    },
                ],
            }),
        );

        expect(result).not.toContain("Thanks");
    });

    it("falls back to plain text when no repo can be resolved", async () => {
        // Runner has no git remote handler — detection returns undefined.
        expect.hasAssertions();

        const runner = new MockRunner();
        const fmt = createGithubFormatter({ runner });

        const result = await fmt(
            mkCtx({
                changeFiles: [{ body: "Closes #42", id: "x", path: "x.md", payload: { bumps: { "@scope/pkg": "minor" } } }],
            }),
        );

        // Without a repo slug, #42 stays as bare text.
        expect(result).toContain("Closes #42");
        expect(result).not.toContain("https://github.com");
    });
});
