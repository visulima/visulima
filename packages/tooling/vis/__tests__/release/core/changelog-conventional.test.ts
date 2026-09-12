import { afterEach, describe, expect, it, vi } from "vitest";

import type { ChangelogContext } from "../../../src/release/core/changelog/api";
import { createConventionalFormatter } from "../../../src/release/core/changelog/conventional";
import { hasBulletMarker, isBreakingChange, parseConventionalHeader, stripBulletMarker } from "../../../src/release/core/changelog/conventional-header";
import { createDefaultFormatter } from "../../../src/release/core/changelog/default";
import { createGithubFormatter } from "../../../src/release/core/changelog/github";
import { buildCompareUrl, renderReleaseHeading } from "../../../src/release/core/changelog/release-heading";
import { detectRepo } from "../../../src/release/core/changelog/repo-slug";
import { DEFAULT_CONVENTIONAL_TYPES, renderGroupedEntries, withBullet } from "../../../src/release/core/changelog/sections";
import type { CommandRunner } from "../../../src/release/core/package-managers/interface";
import { MockRunner } from "../../../src/release/core/shell-runner";
import type { ChangeFile, PlannedRelease } from "../../../src/release/types";

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

const mkFile = (body: string): ChangeFile => {
    return { body, id: "x", path: "x.md", payload: { bumps: { "@scope/pkg": "minor" } } };
};

/** A runner that answers nothing — exercises the "no repo slug detected" path. */
const noRemoteRunner = (): MockRunner => new MockRunner();

describe(parseConventionalHeader, () => {
    it("splits type, scope and subject", () => {
        expect.hasAssertions();

        expect(parseConventionalHeader("fix(client,react): encode SSR payloads")).toStrictEqual({
            breakingMarker: false,
            breakingNote: false,
            scope: "client,react",
            subject: "encode SSR payloads",
            type: "fix",
        });
    });

    it("returns a scope-less parse for a bare type prefix", () => {
        expect.hasAssertions();

        expect(parseConventionalHeader("feat: add pdf()")).toStrictEqual({
            breakingMarker: false,
            breakingNote: false,
            scope: undefined,
            subject: "add pdf()",
            type: "feat",
        });
    });

    it("reports the `!` marker and an inline BREAKING CHANGE note separately", () => {
        expect.hasAssertions();

        const bang = parseConventionalHeader("feat(api)!: drop v1")!;
        const note = parseConventionalHeader("feat: drop v1 BREAKING CHANGE")!;

        expect(bang.breakingMarker).toBe(true);
        expect(bang.breakingNote).toBe(false);
        expect(note.breakingMarker).toBe(false);
        expect(note.breakingNote).toBe(true);
        expect([bang, note].every((parsed) => isBreakingChange(parsed))).toBe(true);
    });

    it("tolerates a leading bullet marker and a gitmoji prefix", () => {
        expect.hasAssertions();

        expect(parseConventionalHeader("- 🚀 feat(cli): add tab completion")?.type).toBe("feat");
        expect(parseConventionalHeader("* :rocket: feat(cli): add tab completion")?.scope).toBe("cli");
    });

    it("strips a gitmoji prefix that carries a variation selector, modifier or ZWJ", () => {
        expect.hasAssertions();

        // `🏗️` is U+1F3D7 + U+FE0F. Matching only the base code point left the
        // selector where the separator was expected, so the whole line failed
        // to parse and landed silently in the uncategorized bucket.
        expect(parseConventionalHeader("🏗️ feat: add builder")).toStrictEqual({
            breakingMarker: false,
            breakingNote: false,
            scope: undefined,
            subject: "add builder",
            type: "feat",
        });
        expect(parseConventionalHeader("- 🏗️ feat(cli): add builder")?.scope).toBe("cli");
        // Skin-tone modifier (U+1F44D U+1F3FD) and a ZWJ sequence.
        expect(parseConventionalHeader("👍🏽 fix: guard nulls")?.type).toBe("fix");
        expect(parseConventionalHeader("👨‍💻 docs: rewrite the guide")?.type).toBe("docs");
    });

    it("returns undefined for a non-conventional subject", () => {
        expect.hasAssertions();

        expect(parseConventionalHeader("Untagged note here.")).toBeUndefined();
        expect(parseConventionalHeader("not a type(scope) missing colon")).toBeUndefined();
    });

    it("stays linear on a long run of parens (no catastrophic backtracking)", () => {
        expect.hasAssertions();

        const started = Date.now();

        expect(parseConventionalHeader(`feat${"(".repeat(20_000)}`)).toBeUndefined();
        expect(Date.now() - started).toBeLessThan(1000);
    });
});

describe(renderGroupedEntries, () => {
    it("orders sections by the `types` array, not by input order", () => {
        expect.hasAssertions();

        const lines = renderGroupedEntries([{ line: "perf: reuse the session" }, { line: "fix: handle empty input" }, { line: "feat: add pdf()" }]);
        const text = lines.join("\n");

        expect(text.indexOf("### Features")).toBeLessThan(text.indexOf("### Bug Fixes"));
        expect(text.indexOf("### Bug Fixes")).toBeLessThan(text.indexOf("### Performance Improvements"));
    });

    it("omits hidden types entirely", () => {
        expect.hasAssertions();

        const text = renderGroupedEntries([{ line: "chore: bump linter" }, { line: "feat: real feature" }]).join("\n");

        expect(text).not.toContain("bump linter");
        expect(text).not.toContain("Miscellaneous Chores");
        expect(text).toContain("* real feature");
    });

    it("keeps a hidden-type breaking change under the breaking section", () => {
        expect.hasAssertions();

        const text = renderGroupedEntries([{ line: "chore!: drop node 20" }]).join("\n");

        expect(text).toContain("### ⚠ BREAKING CHANGES");
        expect(text).toContain("* drop node 20");
    });

    it("routes unparseable subjects to the uncategorized bucket verbatim", () => {
        expect.hasAssertions();

        const text = renderGroupedEntries([{ line: "feat: typed thing" }, { line: "- Untagged note here." }]).join("\n");

        expect(text).toContain("### Other Changes");
        expect(text).toContain("* Untagged note here.");
    });

    it("keeps a parsed-but-unmapped type verbatim rather than dropping its prefix", () => {
        expect.hasAssertions();

        const text = renderGroupedEntries([{ line: "banana: peel it" }]).join("\n");

        expect(text).toContain("### Other Changes");
        expect(text).toContain("* banana: peel it");
    });

    it("bolds the lifted scope and drops the `type(scope):` prefix", () => {
        expect.hasAssertions();

        const text = renderGroupedEntries([{ line: "fix(client,react): encode SSR payloads" }]).join("\n");

        expect(text).toContain("* **client,react:** encode SSR payloads");
        expect(text).not.toContain("fix(client,react):");
    });

    it("renders a scope-less commit as the bare subject", () => {
        expect.hasAssertions();

        expect(renderGroupedEntries([{ line: "feat: add pdf() to the rendering surface" }]).join("\n")).toContain("* add pdf() to the rendering surface");
    });

    it("merges types that share a section heading", () => {
        expect.hasAssertions();

        const text = renderGroupedEntries([{ line: "feature: one" }, { line: "feat: two" }]).join("\n");

        expect(text.match(/### Features/g)).toHaveLength(1);
    });

    it("honours a custom `types` table and a custom bullet", () => {
        expect.hasAssertions();

        const text = renderGroupedEntries([{ line: "feat: shown" }, { line: "fix: hidden" }], {
            bullet: "-",
            types: [
                { section: "Headlines", type: "feat" },
                { hidden: true, section: "Internal", type: "fix" },
            ],
        }).join("\n");

        expect(text).toContain("### Headlines");
        expect(text).toContain("- shown");
        expect(text).not.toContain("hidden");
    });

    it("appends the per-entry suffix after the rendered text", () => {
        expect.hasAssertions();

        expect(renderGroupedEntries([{ line: "fix(cli): thing", suffix: " (#42)" }]).join("\n")).toContain("* **cli:** thing (#42)");
    });

    it("hides `docs` by default and shows `deps` as Dependencies", () => {
        expect.hasAssertions();

        const text = renderGroupedEntries([{ line: "docs: tweak readme" }, { line: "deps(@visulima/fs): upgraded to 6.0.8" }]).join("\n");

        expect(text).not.toContain("tweak readme");
        expect(text).toContain("### Dependencies");
        expect(text).toContain("* **@visulima/fs:** upgraded to 6.0.8");
    });

    it("renders a repeated type once instead of appending its bucket twice", () => {
        expect.hasAssertions();

        // Both rendering loops used to walk the raw `types` array, so a table
        // that names the same type twice emitted the bucket once per rule.
        expect(
            renderGroupedEntries([{ line: "feat: add pdf()" }], {
                types: [
                    { section: "Features", type: "feat" },
                    { section: "Features", type: "feat" },
                ],
            }),
        ).toStrictEqual(["### Features", "", "* add pdf()", ""]);
    });

    it("lets the first rule win, so a later visible rule can't unhide a type", () => {
        expect.hasAssertions();

        // `ruleByType` already kept the first rule, but the render loops did
        // not — a trailing visible duplicate resurrected a type the author had
        // explicitly hidden.
        expect(
            renderGroupedEntries([{ line: "feat: add pdf()" }], {
                types: [
                    { hidden: true, section: "Features", type: "feat" },
                    { section: "Features", type: "feat" },
                ],
            }),
        ).toStrictEqual([]);
    });

    it("treats a `+` list marker as an existing bullet", () => {
        expect.hasAssertions();

        // `stripBulletMarker` accepts `*`, `+` and `-`; `withBullet` used to
        // accept only `*` and `-`, so a `+` entry rendered as `* + fix: …`.
        expect(withBullet("+ fix: guard nulls", "*")).toBe("+ fix: guard nulls");
        expect(
            renderGroupedEntries([{ line: "+ fix: guard nulls" }], { entryStyle: "verbatim", types: [{ section: "Bug Fixes", type: "fix" }] }),
        ).toStrictEqual(["### Bug Fixes", "", "+ fix: guard nulls", ""]);

        for (const marker of ["*", "+", "-"]) {
            expect(hasBulletMarker(`${marker} fix: guard nulls`)).toBe(true);
            expect(stripBulletMarker(`${marker} fix: guard nulls`)).toBe("fix: guard nulls");
        }

        // A marker glued to the text is not a list item in Markdown either.
        expect(hasBulletMarker("-v is now the short flag")).toBe(false);
        expect(withBullet("-v is now the short flag", "*")).toBe("* -v is now the short flag");
    });

    it("ships hidden defaults for the repo-specific extra commit types", () => {
        expect.hasAssertions();

        for (const type of ["dx", "types", "wip", "release", "workflow"]) {
            expect(DEFAULT_CONVENTIONAL_TYPES.find((rule) => rule.type === type)?.hidden).toBe(true);
        }

        expect(DEFAULT_CONVENTIONAL_TYPES.find((rule) => rule.type === "deps")?.hidden).toBeUndefined();
    });
});

describe(renderReleaseHeading, () => {
    it("substitutes every token", () => {
        expect.hasAssertions();

        expect(
            renderReleaseHeading("## {name} [{version}]({compareUrl}) ({date})", {
                compareUrl: "https://github.com/o/r/compare/a...b",
                date: "2026-05-02",
                name: "@scope/pkg",
                version: "1.1.0",
            }),
        ).toBe("## @scope/pkg [1.1.0](https://github.com/o/r/compare/a...b) (2026-05-02)");
    });

    it("unwraps the link syntax when there is no compare URL", () => {
        expect.hasAssertions();

        expect(
            renderReleaseHeading("## {name} [{version}]({compareUrl}) ({date})", {
                date: "2026-05-02",
                name: "@scope/pkg",
                version: "1.1.0",
            }),
        ).toBe("## @scope/pkg 1.1.0 (2026-05-02)");
    });

    it("leaves unknown tokens intact so a typo is visible", () => {
        expect.hasAssertions();

        expect(renderReleaseHeading("## {versionn}", { date: "d", name: "n", version: "1.0.0" })).toBe("## {versionn}");
    });

    it("builds a compare URL from repo + tag pattern, and nothing without a previous version", () => {
        expect.hasAssertions();

        expect(buildCompareUrl({ name: "@scope/pkg", newVersion: "1.1.0", oldVersion: "1.0.0", repo: "o/r" })).toBe(
            "https://github.com/o/r/compare/@scope/pkg@1.0.0...@scope/pkg@1.1.0",
        );
        expect(buildCompareUrl({ name: "@scope/pkg", newVersion: "1.1.0", oldVersion: "1.0.0", repo: "o/r", tagPattern: "v{version}" })).toBe(
            "https://github.com/o/r/compare/v1.0.0...v1.1.0",
        );
        expect(buildCompareUrl({ name: "@scope/pkg", newVersion: "1.1.0", oldVersion: "1.0.0" })).toBeUndefined();
        expect(buildCompareUrl({ name: "@scope/pkg", newVersion: "1.0.0", oldVersion: "", repo: "o/r" })).toBeUndefined();
    });

    it("uses the provider's compare path, not github.com, for a GitLab slug", () => {
        expect.hasAssertions();

        expect(buildCompareUrl({ name: "@scope/pkg", newVersion: "1.1.0", oldVersion: "1.0.0", provider: "gitlab", repo: "group/proj" })).toBe(
            "https://gitlab.com/group/proj/-/compare/@scope/pkg@1.0.0...@scope/pkg@1.1.0",
        );
    });
});

describe("conventional formatter", () => {
    it("renders the semantic-release heading + grouped, scope-bolded body", async () => {
        expect.hasAssertions();

        const formatter = createConventionalFormatter({ repo: "visulima/visulima", runner: noRemoteRunner() });
        const result = await formatter(
            mkCtx({
                changeFiles: [
                    mkFile("fix(client,react): encode SSR payloads\nfeat(browser): add pdf() to the rendering surface\nperf(browser): reuse the session"),
                ],
            }),
        );

        expect(result).toBe(
            [
                "## @scope/pkg [1.1.0](https://github.com/visulima/visulima/compare/@scope/pkg@1.0.0...@scope/pkg@1.1.0) (2026-05-02)",
                "",
                "### Features",
                "",
                "* **browser:** add pdf() to the rendering surface",
                "",
                "### Bug Fixes",
                "",
                "* **client,react:** encode SSR payloads",
                "",
                "### Performance Improvements",
                "",
                "* **browser:** reuse the session",
            ].join("\n"),
        );
    });

    it("degrades the heading link when no remote can be detected", async () => {
        expect.hasAssertions();

        const formatter = createConventionalFormatter({ runner: noRemoteRunner() });
        const result = await formatter(mkCtx({ changeFiles: [mkFile("feat: a thing")] }));

        expect(result).toContain("## @scope/pkg 1.1.0 (2026-05-02)");
        expect(result).not.toContain("]()");
    });

    it("degrades the heading link on a first release (no previous version)", async () => {
        expect.hasAssertions();

        const formatter = createConventionalFormatter({ repo: "o/r", runner: noRemoteRunner() });
        const result = await formatter(mkCtx({ changeFiles: [mkFile("feat: a thing")], release: mkRelease({ newVersion: "1.0.0", oldVersion: "" }) }));

        expect(result).toContain("## @scope/pkg 1.0.0 (2026-05-02)");
        expect(result).not.toContain("compare");
    });

    it("honours a custom heading template", async () => {
        expect.hasAssertions();

        const formatter = createConventionalFormatter({ heading: "## v{version} — {date}", runner: noRemoteRunner() });
        const result = await formatter(mkCtx({ changeFiles: [mkFile("feat: a thing")] }));

        expect(result).toContain("## v1.1.0 — 2026-05-02");
    });

    it("drops the heading for the github-release target", async () => {
        expect.hasAssertions();

        const formatter = createConventionalFormatter({ repo: "o/r", runner: noRemoteRunner() });
        const result = await formatter(mkCtx({ changeFiles: [mkFile("feat: a thing")], target: "github-release" }));

        expect(result).not.toContain("1.1.0");
        expect(result.startsWith("### Features")).toBe(true);
    });

    it("renders dependency bumps under Dependencies with the package bolded", async () => {
        expect.hasAssertions();

        const formatter = createConventionalFormatter({ repo: "o/r", runner: noRemoteRunner() });
        const result = await formatter(
            mkCtx({
                release: mkRelease({
                    isDependencyBump: true,
                    sources: [
                        { bumpType: "patch", name: "@visulima/fs", newVersion: "6.0.8" },
                        { bumpType: "patch", name: "@visulima/dropped", newVersion: "" },
                    ],
                }),
            }),
        );

        expect(result).toContain("### Dependencies");
        expect(result).toContain("* **@visulima/fs:** upgraded to 6.0.8");
        expect(result).toContain("* **@visulima/dropped:** removed");
        expect(result).not.toContain("@\n");
    });

    it("linkifies bare issue refs when a repo slug is known", async () => {
        expect.hasAssertions();

        const formatter = createConventionalFormatter({ repo: "visulima/visulima", runner: noRemoteRunner() });
        const result = await formatter(mkCtx({ changeFiles: [mkFile("fix(cli): stop the hang #607")] }));

        expect(result).toContain("[#607](https://github.com/visulima/visulima/issues/607)");
    });
});

describe("opt-in options on the existing formatters", () => {
    it("github: `types` groups + bolds while keeping the PR/commit refs", async () => {
        expect.hasAssertions();

        const formatter = createGithubFormatter({ repo: "o/r", runner: noRemoteRunner(), types: [] });
        const result = await formatter(
            mkCtx({
                changeFiles: [
                    {
                        body: "fix(client,react): encode SSR payloads",
                        id: "x",
                        meta: { author: "@someone", pr: 607 },
                        path: "x.md",
                        payload: { bumps: { "@scope/pkg": "patch" } },
                    },
                ],
            }),
        );

        expect(result).toContain("### Bug Fixes");
        expect(result).toContain("* **client,react:** encode SSR payloads ([#607](https://github.com/o/r/pull/607))");
        expect(result).toContain("Thanks @someone!");
    });

    it("github: `heading` templates the release heading", async () => {
        expect.hasAssertions();

        const formatter = createGithubFormatter({ heading: "## {name} [{version}]({compareUrl}) ({date})", repo: "o/r", runner: noRemoteRunner() });
        const result = await formatter(mkCtx({ changeFiles: [mkFile("feat: a thing")] }));

        expect(result).toContain("## @scope/pkg [1.1.0](https://github.com/o/r/compare/@scope/pkg@1.0.0...@scope/pkg@1.1.0) (2026-05-02)");
        expect(result).not.toContain("<sub>");
    });

    it("github: unconfigured output is unchanged", async () => {
        expect.hasAssertions();

        const formatter = createGithubFormatter({ repo: "o/r", runner: noRemoteRunner() });
        const result = await formatter(mkCtx({ changeFiles: [mkFile("fix(client,react): encode SSR payloads")] }));

        expect(result).toBe(["## 1.1.0", "<sub>2026-05-02</sub>", "", "- fix(client,react): encode SSR payloads"].join("\n"));
    });

    it("default: `heading` templates the release heading", async () => {
        expect.hasAssertions();

        const formatter = createDefaultFormatter({ heading: "## {name} [{version}]({compareUrl}) ({date})", repo: "o/r" });
        const result = await formatter(mkCtx({ changeFiles: [mkFile("feat: a thing")] }));

        expect(result).toContain("## @scope/pkg [1.1.0](https://github.com/o/r/compare/@scope/pkg@1.0.0...@scope/pkg@1.1.0) (2026-05-02)");
    });

    it("default: unconfigured output is unchanged", async () => {
        expect.hasAssertions();

        const formatter = createDefaultFormatter();
        const result = await formatter(mkCtx({ changeFiles: [mkFile("fix(client,react): encode SSR payloads")] }));

        expect(result).toBe(["## 1.1.0", "<sub>2026-05-02</sub>", "", "- fix(client,react): encode SSR payloads"].join("\n"));
    });
});

describe("custom `types` tables never swallow entries (the documented Other-Changes guarantee)", () => {
    /** The exact table the `release` guide prints as its `types` example. */
    const DOCS_TYPES = [
        { section: "Features", type: "feat" },
        { section: "Bug Fixes", type: "fix" },
        { hidden: true, section: "Internal", type: "refactor" },
    ];

    it("keeps unparseable lines, unmapped types and dependency bumps when the table has no `other` rule", () => {
        expect.hasAssertions();

        const text = renderGroupedEntries(
            [
                { line: "feat(cli): add flag" },
                { line: "chore: bump ci image" },
                { line: "Fix a typo in the docs" },
                { line: "deps(@visulima/fs): upgraded to 6.0.8" },
            ],
            { types: DOCS_TYPES },
        ).join("\n");

        expect(text).toContain("### Features");
        expect(text).toContain("* **cli:** add flag");
        expect(text).toContain("### Other Changes");
        expect(text).toContain("* chore: bump ci image");
        expect(text).toContain("* Fix a typo in the docs");
        expect(text).toContain("* deps(@visulima/fs): upgraded to 6.0.8");
    });

    it("still drops the catch-all when the caller opts out with `{ type: \"other\", hidden: true }`", () => {
        expect.hasAssertions();

        const text = renderGroupedEntries([{ line: "feat: shown" }, { line: "Untagged note here." }], {
            types: [...DOCS_TYPES, { hidden: true, section: "Other Changes", type: "other" }],
        }).join("\n");

        expect(text).toContain("### Features");
        expect(text).not.toContain("Other Changes");
        expect(text).not.toContain("Untagged note here.");
    });

    it("renders the catch-all at the `other` rule's position when the table places one", () => {
        expect.hasAssertions();

        const text = renderGroupedEntries([{ line: "feat: shown" }, { line: "Untagged note here." }], {
            types: [
                { section: "Loose Ends", type: "other" },
                { section: "Features", type: "feat" },
            ],
        }).join("\n");

        expect(text.indexOf("### Loose Ends")).toBeLessThan(text.indexOf("### Features"));
        expect(text).toContain("* Untagged note here.");
    });

    it("keeps non-conventional change-file lines through the conventional formatter with the docs' table", async () => {
        expect.hasAssertions();

        const formatter = createConventionalFormatter({ repo: "o/r", runner: noRemoteRunner(), types: DOCS_TYPES });
        const result = await formatter(mkCtx({ changeFiles: [mkFile("feat(cli): add flag\nFix a typo in the docs")] }));

        expect(result).toContain("### Features");
        expect(result).toContain("### Other Changes");
        expect(result).toContain("* Fix a typo in the docs");
    });

    it("keeps a dependency-only release visible even though the docs' table has no `deps` rule", async () => {
        expect.hasAssertions();

        const formatter = createConventionalFormatter({ repo: "o/r", runner: noRemoteRunner(), types: DOCS_TYPES });
        const result = await formatter(
            mkCtx({
                release: mkRelease({
                    isDependencyBump: true,
                    sources: [{ bumpType: "patch", name: "@visulima/fs", newVersion: "6.0.8" }],
                }),
            }),
        );

        expect(result).toContain("### Other Changes");
        expect(result).toContain("* deps(@visulima/fs): upgraded to 6.0.8");
    });
});

describe("remote-provider-aware links", () => {
    afterEach(() => {
        vi.unstubAllEnvs();
    });

    /** A runner whose every call rejects — no `git`/`gh` on PATH, or a broken repo. */
    const rejectingRunner = (): CommandRunner => {
        return {
            run: async (): Promise<never> => {
                throw new Error("spawn git ENOENT");
            },
        };
    };

    /** A runner that reports a GitLab origin, so provider detection picks `gitlab`. */
    const gitlabRunner = (): MockRunner => {
        const runner = new MockRunner();

        runner.on("git", ["config", "--get", "remote.origin.url"], () => {
            return { exitCode: 0, stderr: "", stdout: "git@gitlab.com:group/proj.git\n" };
        });

        return runner;
    };

    /**
     * `detectRemoteProvider` short-circuits on CI env vars, and
     * `GitlabRemoteClient` prefers `CI_PROJECT_PATH`. Clear all four so the
     * git remote decides — on a workstation and on GitHub Actions alike.
     */
    const forceGitRemoteDetection = (): void => {
        vi.stubEnv("GITHUB_ACTIONS", "");
        vi.stubEnv("GITHUB_REPOSITORY", "");
        vi.stubEnv("GITLAB_CI", "");
        vi.stubEnv("CI_PROJECT_PATH", "");
    };

    it("degrades to no slug when the detection runner rejects", async () => {
        expect.hasAssertions();

        await expect(detectRepo(undefined, rejectingRunner(), "/cwd")).resolves.toStrictEqual({ provider: "github", slug: undefined });
    });

    it("still renders a changelog when the detection runner rejects", async () => {
        expect.hasAssertions();

        // Both built-in formatters await this shared promise before rendering
        // a line, so a rejection used to fail the whole workspace run instead
        // of degrading to the documented link-free plain text.
        const formatter = createConventionalFormatter({ runner: rejectingRunner() });
        const result = await formatter(mkCtx({ changeFiles: [mkFile("feat(cli): add tab completion #607")] }));

        expect(result).toContain("### Features");
        expect(result).toContain("* **cli:** add tab completion #607");
        expect(result).not.toContain("http");
    });

    it("points the conventional formatter's issue and compare links at a GitLab remote", async () => {
        expect.hasAssertions();

        forceGitRemoteDetection();

        const formatter = createConventionalFormatter({ runner: gitlabRunner() });
        const result = await formatter(mkCtx({ changeFiles: [mkFile("fix(cli): stop the hang #607")] }));

        expect(result).toContain("[#607](https://gitlab.com/group/proj/-/issues/607)");
        expect(result).toContain("(https://gitlab.com/group/proj/-/compare/@scope/pkg@1.0.0...@scope/pkg@1.1.0)");
        expect(result).not.toContain("github.com");
    });

    it("points the github formatter's refs at a GitLab remote as merge requests", async () => {
        expect.hasAssertions();

        forceGitRemoteDetection();

        const formatter = createGithubFormatter({ runner: gitlabRunner(), types: [] });
        const result = await formatter(
            mkCtx({
                changeFiles: [
                    {
                        body: "fix(cli): stop the hang #607",
                        id: "x",
                        meta: { commit: "abc1234def", pr: 42 },
                        path: "x.md",
                        payload: { bumps: { "@scope/pkg": "patch" } },
                    },
                ],
            }),
        );

        expect(result).toContain("[#42](https://gitlab.com/group/proj/-/merge_requests/42)");
        expect(result).toContain("[`abc1234`](https://gitlab.com/group/proj/-/commit/abc1234def)");
        expect(result).toContain("[#607](https://gitlab.com/group/proj/-/issues/607)");
        expect(result).not.toContain("github.com");
    });
});

describe("regex complexity (CodeQL polynomial-redos)", () => {
    it("parses a pathological whitespace subject in linear time", () => {
        expect.hasAssertions();

        // CodeQL alert 582. `[ \t]+(.+)$` let both groups match whitespace, so
        // every split had to be tried before the match could be rejected — and
        // it is only rejected when a newline blocks `.`, since `.` matches a
        // tab but not `\n`. Measured on the old regex: 1350 ms at 50k tabs,
        // quadratic from there. The current regex consumes exactly one
        // separator, so there is no split to search.
        const pathological = `fix:${"\t".repeat(50_000)}\nencode SSR payloads`;
        const started = performance.now();
        const parsed = parseConventionalHeader(pathological);
        const elapsed = performance.now() - started;

        expect(elapsed).toBeLessThan(250);
        // A body line containing a newline is not a conventional header.
        expect(parsed).toBeUndefined();
    });

    it("keeps the parse result identical for ordinary multi-space headers", () => {
        expect.hasAssertions();

        // The separator is now a single char, so extra whitespace lands in the
        // subject and is trimmed — the observable result must not change.
        expect(parseConventionalHeader("fix(a,b):   encode SSR payloads")).toStrictEqual({
            breakingMarker: false,
            breakingNote: false,
            scope: "a,b",
            subject: "encode SSR payloads",
            type: "fix",
        });
        expect(parseConventionalHeader("feat!:\t\tadd pdf()")?.subject).toBe("add pdf()");
        expect(parseConventionalHeader("feat!:\t\tadd pdf()")?.breakingMarker).toBe(true);
        // Still requires a separator after the colon.
        expect(parseConventionalHeader("fix:no-space")).toBeUndefined();
    });

    it("bails out of a long emoji ZWJ run in linear time", () => {
        expect.hasAssertions();

        // The gitmoji prefix accepts a ZWJ sequence. Each optional part is one
        // code point from a class disjoint from what may follow it, so a
        // failing match unwinds instead of exploring combinations.
        const started = performance.now();
        const zwjRun = "👨\u200D".repeat(20_000);

        expect(parseConventionalHeader(`${zwjRun}nope`)).toBeUndefined();
        expect(performance.now() - started).toBeLessThan(1000);
    });

    it("strips trailing slashes from a compare-url base in linear time", () => {
        expect.hasAssertions();

        // CodeQL alert 583. `replace(/\/+$/, "")` has an unanchored start, so
        // the engine retries the `+` at every offset when the run is NOT at the
        // end. Measured on the old expression: 1924 ms for 60k interior slashes.
        const started = performance.now();
        const url = buildCompareUrl({
            compareUrlPrefix: `https://git.example.com/${"/".repeat(60_000)}a`,
            name: "@scope/pkg",
            newVersion: "1.1.0",
            oldVersion: "1.0.0",
        });
        const elapsed = performance.now() - started;

        expect(elapsed).toBeLessThan(250);
        expect(url).toBe(`https://git.example.com/${"/".repeat(60_000)}a/compare/@scope/pkg@1.0.0...@scope/pkg@1.1.0`);
    });
});
