import { describe, expect, it } from "vitest";

import { resolveSyncTagGroups } from "../../../src/release/core/group-tags";
import type { VisReleaseConfig } from "../../../src/release/types";

const pub = (...entries: [string, string][]): { name: string; version: string }[] => entries.map(([name, version]) => { return { name, version }; });

describe("group-tags: resolveSyncTagGroups", () => {
    it("returns nothing when no group sets syncGitTag", () => {
        expect.hasAssertions();

        const config: VisReleaseConfig = { fixed: [{ packages: ["@scope/*"] }] };
        const result = resolveSyncTagGroups(config, pub(["@scope/a", "1.1.0"]));

        expect(result.groups).toStrictEqual([]);
        expect(result.grouped.size).toBe(0);
    });

    it("collapses a syncGitTag group to one tag at the highest member version", () => {
        expect.hasAssertions();

        const config: VisReleaseConfig = { fixed: [{ name: "acme", packages: ["@acme/*"], syncGitTag: true }] };
        const result = resolveSyncTagGroups(config, pub(["@acme/ui", "1.2.0"], ["@acme/utils", "1.3.0"], ["@other/x", "9.0.0"]));

        expect(result.groups).toHaveLength(1);
        expect(result.groups[0]).toStrictEqual({
            members: ["@acme/ui", "@acme/utils"],
            name: "acme",
            tag: "acme@1.3.0",
            version: "1.3.0",
        });
        // Only matched members are grouped; @other/x keeps its per-package tag.
        expect([...result.grouped]).toStrictEqual(["@acme/ui", "@acme/utils"]);
    });

    it("honours a custom tagPattern", () => {
        expect.hasAssertions();

        const config: VisReleaseConfig = { fixed: [{ name: "acme", packages: ["@acme/*"], syncGitTag: true, tagPattern: "v{version}" }] };
        const result = resolveSyncTagGroups(config, pub(["@acme/ui", "2.0.0"]));

        expect(result.groups[0]?.tag).toBe("v2.0.0");
    });

    it("only includes published members", () => {
        expect.hasAssertions();

        const config: VisReleaseConfig = { fixed: [{ name: "acme", packages: ["@acme/ui", "@acme/utils"], syncGitTag: true }] };
        const result = resolveSyncTagGroups(config, pub(["@acme/ui", "1.0.0"]));

        expect(result.groups[0]?.members).toStrictEqual(["@acme/ui"]);
    });

    it("skips a group with no published members", () => {
        expect.hasAssertions();

        const config: VisReleaseConfig = { fixed: [{ name: "acme", packages: ["@acme/*"], syncGitTag: true }] };
        const result = resolveSyncTagGroups(config, pub(["@other/x", "1.0.0"]));

        expect(result.groups).toStrictEqual([]);
    });

    it("first group claims an overlapping member (fixed before linked)", () => {
        expect.hasAssertions();

        const config: VisReleaseConfig = {
            fixed: [{ name: "core", packages: ["@acme/ui"], syncGitTag: true }],
            linked: [{ name: "all", packages: ["@acme/*"], syncGitTag: true }],
        };
        const result = resolveSyncTagGroups(config, pub(["@acme/ui", "1.0.0"], ["@acme/utils", "1.0.0"]));

        expect(result.groups.find((g) => g.name === "core")?.members).toStrictEqual(["@acme/ui"]);
        expect(result.groups.find((g) => g.name === "all")?.members).toStrictEqual(["@acme/utils"]);
    });

    it("defaults the group name to group-<index> when unnamed", () => {
        expect.hasAssertions();

        const config: VisReleaseConfig = { fixed: [{ packages: ["@acme/*"], syncGitTag: true }] };
        const result = resolveSyncTagGroups(config, pub(["@acme/ui", "1.0.0"]));

        expect(result.groups[0]?.name).toBe("group-0");
        expect(result.groups[0]?.tag).toBe("group-0@1.0.0");
    });
});
