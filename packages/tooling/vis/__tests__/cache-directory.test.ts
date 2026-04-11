import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
    DEFAULT_CACHE_DIRECTORY_NAME,
    isCacheDirectoryInsideWorkspace,
    resolveCacheDirectory,
} from "../src/cache-directory";

// Use a non-relative POSIX-ish workspace root for the tests. `resolve()` on
// both POSIX and Windows treats `/ws` as absolute enough to build reproducible
// paths, so we stay platform-independent by letting `resolve()` produce the
// expectation strings too.
const WS = resolve("/ws");

describe("resolveCacheDirectory", () => {
    it("prefers the CLI override when set", () => {
        expect.assertions(1);

        const cli = resolve("/tmp/cli-cache");

        expect(resolveCacheDirectory(WS, cli, resolve("/tmp/config-cache"))).toBe(cli);
    });

    it("falls back to the config value when no CLI override is set", () => {
        expect.assertions(1);

        const cfg = resolve("/tmp/config-cache");

        expect(resolveCacheDirectory(WS, undefined, cfg)).toBe(cfg);
    });

    it("falls back to the workspace default when neither is set", () => {
        expect.assertions(1);
        expect(resolveCacheDirectory(WS, undefined, undefined)).toBe(resolve(WS, DEFAULT_CACHE_DIRECTORY_NAME));
    });

    it("treats empty strings as unset", () => {
        expect.assertions(2);

        const expected = resolve(WS, DEFAULT_CACHE_DIRECTORY_NAME);

        expect(resolveCacheDirectory(WS, "", undefined)).toBe(expected);
        expect(resolveCacheDirectory(WS, undefined, "")).toBe(expected);
    });

    it("resolves relative CLI values against the workspace root", () => {
        expect.assertions(1);
        expect(resolveCacheDirectory(WS, ".cache/tasks", undefined)).toBe(resolve(WS, ".cache/tasks"));
    });

    it("resolves relative config values against the workspace root", () => {
        expect.assertions(1);
        expect(resolveCacheDirectory(WS, undefined, "cache")).toBe(resolve(WS, "cache"));
    });

    it("leaves absolute CLI values untouched", () => {
        expect.assertions(1);

        const abs = resolve("/custom/cache");

        expect(resolveCacheDirectory(WS, abs, undefined)).toBe(abs);
    });
});

describe("isCacheDirectoryInsideWorkspace", () => {
    it("returns true for a direct child of the workspace", () => {
        expect.assertions(1);
        expect(isCacheDirectoryInsideWorkspace(resolve(WS, ".task-runner-cache"), WS)).toBe(true);
    });

    it("returns true for a deeply nested child", () => {
        expect.assertions(1);
        expect(isCacheDirectoryInsideWorkspace(resolve(WS, "packages/foo/.cache"), WS)).toBe(true);
    });

    it("returns true for a directory whose name starts with '..' (not a traversal)", () => {
        // Regression: the original `startsWith("..")` check rejected any
        // relative path beginning with ".." — including literal dir names
        // like "..foo".
        expect.assertions(1);
        expect(isCacheDirectoryInsideWorkspace(resolve(WS, "..foo"), WS)).toBe(true);
    });

    it("returns false when the cache dir is outside the workspace", () => {
        expect.assertions(1);
        expect(isCacheDirectoryInsideWorkspace(resolve("/tmp/vis-cache"), WS)).toBe(false);
    });

    it("does NOT treat `/workspace` as inside `/work` (prefix collision)", () => {
        // Regression: the previous `startsWith(workspaceRoot)` check matched
        // `/workspace` against `/work` because they share a string prefix.
        expect.assertions(1);
        expect(isCacheDirectoryInsideWorkspace(resolve("/workspace/.cache"), resolve("/work"))).toBe(false);
    });

    it("does NOT treat a sibling directory as inside", () => {
        expect.assertions(1);
        expect(isCacheDirectoryInsideWorkspace(resolve("/ws-other/.cache"), WS)).toBe(false);
    });

    it("returns false when the cache dir is the workspace root itself", () => {
        // Equal paths aren't "inside" — treat them as misconfiguration so
        // the caller prompts before doing anything destructive.
        expect.assertions(1);
        expect(isCacheDirectoryInsideWorkspace(WS, WS)).toBe(false);
    });
});
