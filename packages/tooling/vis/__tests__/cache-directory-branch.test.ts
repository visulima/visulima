import { describe, expect, it } from "vitest";

import { applyBranchScope, sanitizeBranchSegment } from "../src/cache/cache-directory";

describe(sanitizeBranchSegment, () => {
    it("keeps safe characters intact", () => {
        expect.assertions(1);
        expect(sanitizeBranchSegment("feat-123_v2")).toBe("feat-123_v2");
    });

    it("collapses slashes and unsafe characters into dashes", () => {
        expect.assertions(1);
        expect(sanitizeBranchSegment("user/long/feat-name")).toBe("user-long-feat-name");
    });

    it("strips leading and trailing dashes", () => {
        expect.assertions(1);
        expect(sanitizeBranchSegment("/weird/")).toBe("weird");
    });

    it("truncates to 64 characters", () => {
        expect.assertions(1);
        expect(sanitizeBranchSegment("a".repeat(120))).toHaveLength(64);
    });

    it("returns empty string when every character is disallowed", () => {
        expect.assertions(2);
        // A branch consisting entirely of `/` or special chars sanitises to "" —
        // applyBranchScope must NOT then resolve `<cache>/branches/` (collision
        // with the base cache dir).
        expect(sanitizeBranchSegment("@#!*&")).toBe("");
        expect(sanitizeBranchSegment("///")).toBe("");
    });
});

describe(applyBranchScope, () => {
    it("is a pass-through when branchScopedCache is undefined", () => {
        expect.assertions(1);
        expect(applyBranchScope("/tmp/cache", "/workspace", undefined)).toBe("/tmp/cache");
    });

    it("is a pass-through when branchScopedCache is false", () => {
        expect.assertions(1);
        expect(applyBranchScope("/tmp/cache", "/workspace", false)).toBe("/tmp/cache");
    });

    // We don't exercise the enabled=true branch here because it shells out to
    // `git rev-parse`. Integration tests cover that path against a real repo;
    // the unit-level guarantee we want is that the "off" path is inert.
});
