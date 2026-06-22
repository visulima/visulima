import { describe, expect, it } from "vitest";

import { resolveChannel } from "../../../src/release/core/channels";

describe("channels: resolveChannel (literal match)", () => {
    it("matches a literal branch name", () => {
        const result = resolveChannel("main", { main: { tag: "latest" } });

        expect(result).toStrictEqual({ branch: "main", mode: "auto-publish", prerelease: undefined, range: undefined, tag: "latest" });
    });

    it("includes prerelease + mode when configured", () => {
        const result = resolveChannel("alpha", {
            alpha: { mode: "auto-publish", prerelease: "alpha", tag: "alpha" },
        });

        expect(result?.prerelease).toBe("alpha");
        expect(result?.mode).toBe("auto-publish");
    });

    it("returns undefined for unknown branch", () => {
        const result = resolveChannel("feature/foo", { main: { tag: "latest" } });

        expect(result).toBeUndefined();
    });

    it("returns undefined when no channels configured", () => {
        expect(resolveChannel("main", undefined)).toBeUndefined();
        expect(resolveChannel("main", {})).toBeUndefined();
    });
});

describe("channels: resolveChannel (glob match)", () => {
    it("matches a glob pattern (maintenance branches)", () => {
        const result = resolveChannel("1.x", {
            "[0-9]*.x": { range: "match", tag: "branch-name" },
        });

        expect(result).toBeDefined();
        expect(result?.tag).toBe("1.x");
        expect(result?.range).toBe("match");
    });

    it("matches dotted maintenance pattern (1.2.x)", () => {
        const result = resolveChannel("1.2.x", {
            "[0-9]*.x": { tag: "branch-name" },
        });

        expect(result).toBeDefined();
    });

    it("does not match non-glob patterns as globs", () => {
        // 'release' is plain text, no glob meta; must not be glob-matched.
        const result = resolveChannel("release", { other: { tag: "latest" } });

        expect(result).toBeUndefined();
    });
});

describe("channels: resolveChannel (precedence)", () => {
    it("literal wins over glob when both could match", () => {
        const result = resolveChannel("alpha", {
            alpha: { tag: "alpha-literal" },
            "alpha*": { tag: "alpha-glob" },
        });

        expect(result?.tag).toBe("alpha-literal");
    });

    it("first-listed glob wins among glob matches", () => {
        // Order is the system under test — keep insertion order, not alphabetical.
        /* eslint-disable perfectionist/sort-objects */
        const result = resolveChannel("alpha-1", {
            "alpha*": { tag: "first" },
            "*-1": { tag: "second" },
        });
        /* eslint-enable perfectionist/sort-objects */

        expect(result?.tag).toBe("first");
    });
});

describe("channels: tag = 'branch-name' sanitisation", () => {
    it("uses the branch name as the dist-tag", () => {
        const result = resolveChannel("1.x", {
            "[0-9]*.x": { tag: "branch-name" },
        });

        expect(result?.tag).toBe("1.x");
    });

    it("sanitises slashes / spaces from branch names", () => {
        const result = resolveChannel("feature/Foo Bar", {
            "feature/*": { tag: "branch-name" },
        });

        expect(result?.tag).toBe("feature-foo-bar");
    });

    it("falls back to 'branch' when sanitised name is empty", () => {
        const result = resolveChannel("---", {
            "*": { tag: "branch-name" },
        });

        expect(result?.tag).toBe("branch");
    });
});

describe("channels: mode default", () => {
    it("defaults to auto-publish when mode is not set", () => {
        const result = resolveChannel("main", { main: { tag: "latest" } });

        expect(result?.mode).toBe("auto-publish");
    });

    it("respects explicit version-pr mode", () => {
        const result = resolveChannel("main", { main: { mode: "version-pr", tag: "latest" } });

        expect(result?.mode).toBe("version-pr");
    });
});
