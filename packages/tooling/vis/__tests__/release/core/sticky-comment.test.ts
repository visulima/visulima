import { describe, expect, it } from "vitest";

import { detectPullRequestNumber } from "../../../src/release/core/sticky-comment";

describe(detectPullRequestNumber, () => {
    it("parses pull_request event GITHUB_REF (refs/pull/N/merge)", () => {
        expect(detectPullRequestNumber({ GITHUB_REF: "refs/pull/1234/merge" })).toBe(1234);
    });

    it("parses refs/pull/N/head form", () => {
        expect(detectPullRequestNumber({ GITHUB_REF: "refs/pull/9999/head" })).toBe(9999);
    });

    it("falls back to PR_NUMBER env var", () => {
        expect(detectPullRequestNumber({ PR_NUMBER: "42" })).toBe(42);
    });

    it("falls back to VIS_PR_NUMBER env var", () => {
        expect(detectPullRequestNumber({ VIS_PR_NUMBER: "7" })).toBe(7);
    });

    it("returns undefined for non-PR refs (push events)", () => {
        expect(detectPullRequestNumber({ GITHUB_REF: "refs/heads/main" })).toBeUndefined();
    });

    it("returns undefined when no signal is present", () => {
        expect(detectPullRequestNumber({})).toBeUndefined();
    });

    it("ignores garbage in PR_NUMBER", () => {
        expect(detectPullRequestNumber({ PR_NUMBER: "abc" })).toBeUndefined();
    });
});
