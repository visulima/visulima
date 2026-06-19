import { describe, expect, it } from "vitest";

import { extractVersionSection, parseGitHubRepo, summarizeChangelog } from "../../src/dlx/changelog";

describe(parseGitHubRepo, () => {
    it("parses a git+https url", () => {
        expect.assertions(1);

        expect(parseGitHubRepo({ url: "git+https://github.com/vitejs/vite.git" })).toStrictEqual({
            directory: undefined,
            owner: "vitejs",
            repo: "vite",
        });
    });

    it("parses a shorthand github: spec string", () => {
        expect.assertions(1);

        expect(parseGitHubRepo("github:owner/repo")).toStrictEqual({ directory: undefined, owner: "owner", repo: "repo" });
    });

    it("parses a git@ ssh url", () => {
        expect.assertions(1);

        expect(parseGitHubRepo("git@github.com:owner/repo.git")).toStrictEqual({ directory: undefined, owner: "owner", repo: "repo" });
    });

    it("keeps the monorepo directory when present", () => {
        expect.assertions(1);

        expect(parseGitHubRepo({ directory: "packages/core", url: "https://github.com/owner/repo" })).toStrictEqual({
            directory: "packages/core",
            owner: "owner",
            repo: "repo",
        });
    });

    it("returns undefined for non-github / missing urls", () => {
        expect.assertions(2);

        expect(parseGitHubRepo(undefined)).toBeUndefined();
        expect(parseGitHubRepo({ url: "https://gitlab.com/owner/repo" })).toBeUndefined();
    });
});

describe(extractVersionSection, () => {
    const markdown = ["# Changelog", "", "## 5.2.0", "", "### Bug Fixes", "- resolve symlinks", "", "## 5.1.9", "", "- older fix"].join("\n");

    it("captures only the matching version section", () => {
        expect.assertions(1);

        expect(extractVersionSection(markdown, "5.2.0")).toStrictEqual(["", "### Bug Fixes", "- resolve symlinks", ""]);
    });

    it("returns undefined when the version is not present", () => {
        expect.assertions(1);

        expect(extractVersionSection(markdown, "9.9.9")).toBeUndefined();
    });
});

describe(summarizeChangelog, () => {
    it("strips markdown headings and bullets, capping the line count", () => {
        expect.assertions(1);

        const lines = summarizeChangelog(["### Bug Fixes", "- one", "* two", "", "- three", "- four", "- five"], 3);

        expect(lines).toStrictEqual(["Bug Fixes", "- one", "- two"]);
    });

    it("drops link-reference definitions", () => {
        expect.assertions(1);

        expect(summarizeChangelog(["[1.0.0]: https://example.com", "- real entry"])).toStrictEqual(["- real entry"]);
    });
});
