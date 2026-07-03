import { resolve } from "@visulima/path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { DEFAULT_WORKSPACE_CACHE_DIRECTORY, isCacheDirectoryInsideWorkspace, resolveCacheDirectory } from "../../src/cache/cache-directory";

// Use a non-relative POSIX-ish workspace root for the tests. `resolve()` on
// both POSIX and Windows treats `/ws` as absolute enough to build reproducible
// paths, so we stay platform-independent by letting `resolve()` produce the
// expectation strings too.
const WS = resolve("/ws");

describe(resolveCacheDirectory, () => {
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
        expect(resolveCacheDirectory(WS, undefined, undefined)).toBe(resolve(WS, DEFAULT_WORKSPACE_CACHE_DIRECTORY));
    });

    it("treats empty strings as unset", () => {
        expect.assertions(2);

        const expected = resolve(WS, DEFAULT_WORKSPACE_CACHE_DIRECTORY);

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

    describe("env-var fallback (VIS_CACHE_DIRECTORY)", () => {
        const originalEnv = process.env["VIS_CACHE_DIRECTORY"];

        beforeEach(() => {
            delete process.env["VIS_CACHE_DIRECTORY"];
        });

        afterEach(() => {
            if (originalEnv === undefined) {
                delete process.env["VIS_CACHE_DIRECTORY"];
            } else {
                process.env["VIS_CACHE_DIRECTORY"] = originalEnv;
            }
        });

        it("falls back to the env var when neither CLI nor config is set", () => {
            expect.assertions(1);

            const env = resolve("/tmp/env-cache");

            process.env["VIS_CACHE_DIRECTORY"] = env;

            expect(resolveCacheDirectory(WS, undefined, undefined)).toBe(env);
        });

        it("loses to the CLI override", () => {
            expect.assertions(1);

            process.env["VIS_CACHE_DIRECTORY"] = resolve("/tmp/env-cache");

            const cli = resolve("/tmp/cli-cache");

            expect(resolveCacheDirectory(WS, cli, undefined)).toBe(cli);
        });

        it("loses to the config value", () => {
            expect.assertions(1);

            process.env["VIS_CACHE_DIRECTORY"] = resolve("/tmp/env-cache");

            const cfg = resolve("/tmp/config-cache");

            expect(resolveCacheDirectory(WS, undefined, cfg)).toBe(cfg);
        });

        it("treats an empty env var as unset", () => {
            expect.assertions(1);

            process.env["VIS_CACHE_DIRECTORY"] = "";

            expect(resolveCacheDirectory(WS, undefined, undefined)).toBe(resolve(WS, DEFAULT_WORKSPACE_CACHE_DIRECTORY));
        });

        it("resolves a relative env value against the workspace root", () => {
            expect.assertions(1);

            process.env["VIS_CACHE_DIRECTORY"] = ".env-cache/shared";

            expect(resolveCacheDirectory(WS, undefined, undefined)).toBe(resolve(WS, ".env-cache/shared"));
        });
    });
});

describe(isCacheDirectoryInsideWorkspace, () => {
    it("returns true for a direct child of the workspace", () => {
        expect.assertions(1);
        expect(isCacheDirectoryInsideWorkspace(resolve(WS, ".vis/cache"), WS)).toBe(true);
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
