import { describe, expect, it } from "vitest";

import type { ChangelogContext } from "../../../src/release/core/changelog/api";
import { createDefaultFormatter, defaultFormatter } from "../../../src/release/core/changelog/default";
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

describe(defaultFormatter, () => {
    it("renders header + sub date for changelog target", async () => {
        const result = await defaultFormatter(mkCtx());

        expect(result).toContain("## 1.1.0");
        expect(result).toContain("<sub>2026-05-02</sub>");
    });

    it("strips version heading for github-release target", async () => {
        const result = await defaultFormatter(mkCtx({ target: "github-release" }));

        expect(result).not.toContain("## 1.1.0");
        expect(result).not.toContain("<sub>");
    });

    it("renders change-file body lines as bullets", async () => {
        const result = await defaultFormatter(
            mkCtx({
                changeFiles: [
                    {
                        body: "Added a feature\nFixed a bug",
                        id: "x",
                        path: "x.md",
                        payload: { bumps: { "@scope/pkg": "minor" } },
                    },
                ],
            }),
        );

        expect(result).toContain("- Added a feature");
        expect(result).toContain("- Fixed a bug");
    });

    it("preserves existing bullet markers", async () => {
        const result = await defaultFormatter(
            mkCtx({
                changeFiles: [
                    { body: "- Already a bullet\n* Also a bullet", id: "x", path: "x.md", payload: { bumps: { "@scope/pkg": "minor" } } },
                ],
            }),
        );

        expect(result).toContain("- Already a bullet");
        expect(result).toContain("* Also a bullet");
        expect(result).not.toContain("- - Already");
    });

    it("emits 'Cascade from' line for cascade bumps", async () => {
        const result = await defaultFormatter(
            mkCtx({
                release: mkRelease({
                    isCascadeBump: true,
                    sources: [{ bumpType: "minor", name: "@scope/core", newVersion: "2.0.0" }],
                }),
            }),
        );

        expect(result).toContain("Cascade from @scope/core@2.0.0");
    });

    it("emits 'Group bump with' line for group bumps", async () => {
        const result = await defaultFormatter(
            mkCtx({
                release: mkRelease({
                    isGroupBump: true,
                    sources: [{ bumpType: "minor", name: "@scope/sibling", newVersion: "2.0.0" }],
                }),
            }),
        );

        expect(result).toContain("Group bump with @scope/sibling@2.0.0");
    });

    it("emits 'Updated dependency' line for pure dep bumps with no change file", async () => {
        const result = await defaultFormatter(
            mkCtx({
                release: mkRelease({
                    isDependencyBump: true,
                    sources: [{ bumpType: "minor", name: "@scope/dep", newVersion: "2.0.0" }],
                }),
            }),
        );

        expect(result).toContain("Updated dependency @scope/dep@2.0.0");
    });
});

describe("default formatter: authorCredit option", () => {
    it("appends `(@user)` when the option is enabled and the change file has author meta", async () => {
        const formatter = createDefaultFormatter({ authorCredit: true });
        const result = await formatter(mkCtx({
            changeFiles: [
                {
                    body: "Add tab completion",
                    file: "/repo/.vis/release/abc.md",
                    id: "abc",
                    meta: { author: "@alice" },
                    payload: { bumps: { "@scope/pkg": "minor" } },
                },
            ],
        }));

        expect(result).toContain("- Add tab completion (@alice)");
    });

    it("does NOT append author when the option is off (default behaviour)", async () => {
        const result = await defaultFormatter(mkCtx({
            changeFiles: [
                {
                    body: "Add tab completion",
                    file: "/repo/.vis/release/abc.md",
                    id: "abc",
                    meta: { author: "@alice" },
                    payload: { bumps: { "@scope/pkg": "minor" } },
                },
            ],
        }));

        expect(result).toContain("- Add tab completion");
        expect(result).not.toContain("@alice");
    });

    it("normalises authors without leading @", async () => {
        const formatter = createDefaultFormatter({ authorCredit: true });
        const result = await formatter(mkCtx({
            changeFiles: [
                {
                    body: "Fix a thing",
                    file: "/repo/.vis/release/x.md",
                    id: "x",
                    meta: { author: "bob" },
                    payload: { bumps: { "@scope/pkg": "patch" } },
                },
            ],
        }));

        expect(result).toContain("(@bob)");
    });

    it("skips credit when no author meta is present (silent)", async () => {
        const formatter = createDefaultFormatter({ authorCredit: true });
        const result = await formatter(mkCtx({
            changeFiles: [
                {
                    body: "Anonymous improvement",
                    file: "/repo/.vis/release/x.md",
                    id: "x",
                    payload: { bumps: { "@scope/pkg": "patch" } },
                },
            ],
        }));

        expect(result).toContain("- Anonymous improvement");
        expect(result).not.toContain("(");
    });
});

describe("default formatter: sections option (release-please parity)", () => {
    const mkFile = (body: string) => {
        return {
            body,
            file: "/x.md",
            id: "x",
            payload: { bumps: { "@scope/pkg": "minor" as const } },
        };
    };

    it("emits a flat list when `sections` is omitted (legacy default)", async () => {
        const formatter = createDefaultFormatter();
        const result = await formatter(mkCtx({
            changeFiles: [mkFile("feat: add tab completion\nfix: handle empty input")],
        }));

        expect(result).not.toContain("### Features");
        expect(result).not.toContain("### Bug Fixes");
        expect(result).toContain("- feat: add tab completion");
    });

    it("groups entries under inferred conventional-commit sections when `sections: []`", async () => {
        const formatter = createDefaultFormatter({ sections: [] });
        const result = await formatter(mkCtx({
            changeFiles: [mkFile("feat: add tab completion\nfix: handle empty input")],
        }));

        expect(result).toContain("### Features");
        expect(result).toContain("### Bug Fixes");
        expect(result.indexOf("### Features")).toBeLessThan(result.indexOf("### Bug Fixes"));
    });

    it("treats `feat!:` as a breaking change", async () => {
        const formatter = createDefaultFormatter({ sections: [] });
        const result = await formatter(mkCtx({
            changeFiles: [mkFile("feat!: drop legacy API")],
        }));

        expect(result).toContain("### Breaking Changes");
        expect(result).not.toContain("### Features");
    });

    it("hidden types are dropped entirely from the output", async () => {
        const formatter = createDefaultFormatter({ sections: [] });
        const result = await formatter(mkCtx({
            changeFiles: [mkFile("chore: bump linter\nfeat: real feature")],
        }));

        expect(result).not.toContain("chore: bump linter");
        expect(result).toContain("### Features");
        expect(result).toContain("feat: real feature");
    });

    it("custom sections override the default mapping", async () => {
        const formatter = createDefaultFormatter({
            sections: [
                { section: "Headlines", type: "feat" },
                { hidden: true, section: "Internal", type: "fix" },
            ],
        });
        const result = await formatter(mkCtx({
            changeFiles: [mkFile("feat: feature\nfix: internal")],
        }));

        expect(result).toContain("### Headlines");
        expect(result).not.toContain("### Internal");
        expect(result).not.toContain("fix: internal");
    });

    it("lines without a conventional prefix go to a `Miscellaneous` section", async () => {
        const formatter = createDefaultFormatter({ sections: [] });
        const result = await formatter(mkCtx({
            changeFiles: [mkFile("feat: typed thing\nUntagged note here.")],
        }));

        expect(result).toContain("### Features");
        expect(result).toContain("### Miscellaneous");
        expect(result).toContain("- Untagged note here.");
    });
});
