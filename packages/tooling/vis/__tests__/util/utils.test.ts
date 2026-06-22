import { describe, expect, it } from "vitest";

import { mergeForwardedPackages, normalizeWorkspacePath, sanitizeGitRefComponent } from "../../src/util/utils";

describe(mergeForwardedPackages, () => {
    it("appends the unknown tail (extra packages + unknown flags) to the arguments", () => {
        expect.assertions(1);

        expect(mergeForwardedPackages(["lodash"], ["react", "--unknown"])).toStrictEqual(["lodash", "react", "--unknown"]);
    });

    it("uses only the arguments when the unknown tail starts with a `--` separator", () => {
        expect.assertions(1);

        expect(mergeForwardedPackages(["lodash"], ["--", "extra"])).toStrictEqual(["lodash"]);
    });

    it("handles undefined inputs", () => {
        expect.assertions(2);

        expect(mergeForwardedPackages(undefined, undefined)).toStrictEqual([]);
        expect(mergeForwardedPackages(undefined, ["react"])).toStrictEqual(["react"]);
    });
});

describe(normalizeWorkspacePath, () => {
    it("strips a leading ./ and trailing slashes", () => {
        expect.assertions(3);

        expect(normalizeWorkspacePath("./packages/foo")).toBe("packages/foo");
        expect(normalizeWorkspacePath("packages/foo/")).toBe("packages/foo");
        expect(normalizeWorkspacePath("./packages/foo///")).toBe("packages/foo");
    });

    it("leaves an already-normalized path unchanged", () => {
        expect.assertions(1);

        expect(normalizeWorkspacePath("packages/tooling/vis")).toBe("packages/tooling/vis");
    });
});

describe(sanitizeGitRefComponent, () => {
    it("passes through a valid component untouched", () => {
        expect.assertions(2);

        expect(sanitizeGitRefComponent("packages-tooling-vis")).toBe("packages-tooling-vis");
        expect(sanitizeGitRefComponent("foo.bar_baz")).toBe("foo.bar_baz");
    });

    it("replaces characters git forbids in refnames", () => {
        expect.assertions(1);

        // space ~ ^ : ? * [ \ are all illegal in a refname.
        expect(sanitizeGitRefComponent(String.raw`a b~c^d:e?f*g[h\i`)).toBe("a-b-c-d-e-f-g-h-i");
    });

    it("strips control characters", () => {
        expect.assertions(1);

        // NUL, unit-separator (0x1F), and DEL (0x7F) interleaved with letters.
        const input = `a${String.fromCodePoint(0)}b${String.fromCodePoint(0x1f)}c${String.fromCodePoint(0x7f)}d`;

        expect(sanitizeGitRefComponent(input)).toBe("a-b-c-d");
    });

    it("neutralizes the @{ reflog selector and the .. range operator", () => {
        expect.assertions(2);

        expect(sanitizeGitRefComponent("foo@{bar")).toBe("foo-bar");
        expect(sanitizeGitRefComponent("foo..bar")).toBe("foo-bar");
    });

    it("removes a trailing .lock suffix", () => {
        expect.assertions(1);

        expect(sanitizeGitRefComponent("feature.lock")).toBe("feature");
    });

    it("trims leading and trailing dots, dashes, and slashes", () => {
        expect.assertions(2);

        expect(sanitizeGitRefComponent("/-.foo.-/")).toBe("foo");
        expect(sanitizeGitRefComponent("-foo-")).toBe("foo");
    });

    it("falls back to \"split\" when the input sanitizes to empty", () => {
        expect.assertions(2);

        expect(sanitizeGitRefComponent("")).toBe("split");
        expect(sanitizeGitRefComponent("~^:?")).toBe("split");
    });
});
