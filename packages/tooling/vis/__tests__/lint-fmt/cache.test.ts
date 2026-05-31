import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";

import { join } from "@visulima/path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { cacheable, computeCacheKey, readCacheEntry, writeCacheEntry } from "../../src/lint-fmt/cache";
import type { AdapterRunOptions, RunResult, ToolAdapter, ToolPresence } from "../../src/lint-fmt/config-types";

let workspaceRoot: string;
let cacheRoot: string;

const stubAdapter = (id: string, cacheKeyValue = "stub-key"): ToolAdapter => {
    return {
        argsCheck: () => ["check"],
        argsFix: () => ["fix"],
        bin: () => ["/bin/true"],
        cacheKey: () => cacheKeyValue,
        detect: () => undefined,
        extensions: ["ts"],
        // Tests use stand-in ids; the cache layer treats them as strings only.
        id: id as ToolAdapter["id"],
        kind: "lint",
        parse: () => [],
    };
};

const stubPresence = (): ToolPresence => { return { adapter: "oxlint", declared: false, root: workspaceRoot }; };

const sampleResult: RunResult = {
    durationMs: 12,
    exitCode: 0,
    stderr: "",
    stdout: "ok",
};

const sampleOptions: AdapterRunOptions = {};

describe("lint-fmt cache", () => {
    beforeEach(() => {
        workspaceRoot = mkdtempSync(join(tmpdir(), "vis-cache-"));
        cacheRoot = mkdtempSync(join(tmpdir(), "vis-cache-root-"));
    });

    afterEach(() => {
        rmSync(workspaceRoot, { force: true, recursive: true });
        rmSync(cacheRoot, { force: true, recursive: true });
    });

    describe(cacheable, () => {
        it("returns false in fix mode", () => {
            expect.assertions(1);

            expect(cacheable(["src/foo.ts"], "fix")).toBe(false);
        });

        it("returns false when VIS_NO_CACHE=1", () => {
            expect.assertions(1);

            const previous = process.env.VIS_NO_CACHE;

            process.env.VIS_NO_CACHE = "1";

            try {
                expect(cacheable(["src/foo.ts"], "check")).toBe(false);
            } finally {
                if (previous === undefined) {
                    delete process.env.VIS_NO_CACHE;
                } else {
                    process.env.VIS_NO_CACHE = previous;
                }
            }
        });

        it("returns false for empty file lists", () => {
            expect.assertions(1);

            expect(cacheable([], "check")).toBe(false);
        });

        it("returns false when files include workspace sentinels", () => {
            expect.assertions(3);

            expect(cacheable(["."], "check")).toBe(false);
            expect(cacheable(["./"], "check")).toBe(false);
            expect(cacheable(["src/foo.ts", ".."], "check")).toBe(false);
        });

        it("returns true for a concrete file list in check mode", () => {
            expect.assertions(1);

            expect(cacheable(["src/foo.ts", "src/bar.ts"], "check")).toBe(true);
        });
    });

    describe(computeCacheKey, () => {
        it("is deterministic for the same inputs", () => {
            expect.assertions(2);

            writeFileSync(join(workspaceRoot, "a.ts"), "export const a = 1;");
            writeFileSync(join(workspaceRoot, "b.ts"), "export const b = 2;");

            const adapter = stubAdapter("oxlint");
            const presence = stubPresence();

            const first = computeCacheKey(adapter, presence, ["a.ts", "b.ts"], sampleOptions, "check");
            const second = computeCacheKey(adapter, presence, ["a.ts", "b.ts"], sampleOptions, "check");

            expect(first).toBeDefined();
            expect(first!.key).toBe(second!.key);
        });

        it("orders files independently — input permutation does not affect the key", () => {
            expect.assertions(1);

            writeFileSync(join(workspaceRoot, "a.ts"), "export const a = 1;");
            writeFileSync(join(workspaceRoot, "b.ts"), "export const b = 2;");

            const adapter = stubAdapter("oxlint");
            const presence = stubPresence();

            const first = computeCacheKey(adapter, presence, ["a.ts", "b.ts"], sampleOptions, "check");
            const second = computeCacheKey(adapter, presence, ["b.ts", "a.ts"], sampleOptions, "check");

            expect(first!.key).toBe(second!.key);
        });

        it("changes when file contents change", () => {
            expect.assertions(1);

            const file = join(workspaceRoot, "a.ts");

            writeFileSync(file, "export const a = 1;");

            const adapter = stubAdapter("oxlint");
            const presence = stubPresence();

            const first = computeCacheKey(adapter, presence, ["a.ts"], sampleOptions, "check");

            writeFileSync(file, "export const a = 2;");

            const second = computeCacheKey(adapter, presence, ["a.ts"], sampleOptions, "check");

            expect(first!.key).not.toBe(second!.key);
        });

        it("changes when the adapter cacheKey changes", () => {
            expect.assertions(1);

            writeFileSync(join(workspaceRoot, "a.ts"), "x");

            const first = computeCacheKey(stubAdapter("oxlint", "k1"), stubPresence(), ["a.ts"], sampleOptions, "check");
            const second = computeCacheKey(stubAdapter("oxlint", "k2"), stubPresence(), ["a.ts"], sampleOptions, "check");

            expect(first!.key).not.toBe(second!.key);
        });

        it("returns undefined when a file is missing", () => {
            expect.assertions(1);

            const adapter = stubAdapter("oxlint");
            const presence = stubPresence();

            const result = computeCacheKey(adapter, presence, ["does-not-exist.ts"], sampleOptions, "check");

            expect(result).toBeUndefined();
        });
    });

    describe("read/write round-trip", () => {
        it("stores and retrieves a RunResult", () => {
            expect.assertions(2);

            const adapter = stubAdapter("oxlint");

            writeCacheEntry(cacheRoot, adapter, "abc123", sampleResult, [{ hash: "deadbeef", path: "/x/a.ts" }]);

            const entry = readCacheEntry(cacheRoot, adapter, "abc123");

            expect(entry).toBeDefined();
            expect(entry!.result).toStrictEqual(sampleResult);
        });

        it("returns undefined on a miss", () => {
            expect.assertions(1);

            const adapter = stubAdapter("oxlint");

            expect(readCacheEntry(cacheRoot, adapter, "missing")).toBeUndefined();
        });

        it("returns undefined for malformed JSON", () => {
            expect.assertions(1);

            const adapter = stubAdapter("oxlint");
            const directory = join(cacheRoot, "lint-fmt", "oxlint");

            writeCacheEntry(cacheRoot, adapter, "k", sampleResult, []);
            writeFileSync(join(directory, "k.json"), "{ not json");

            expect(readCacheEntry(cacheRoot, adapter, "k")).toBeUndefined();
        });

        it("returns undefined when the schema version does not match", () => {
            expect.assertions(1);

            const adapter = stubAdapter("oxlint");
            const directory = join(cacheRoot, "lint-fmt", "oxlint");

            writeCacheEntry(cacheRoot, adapter, "k", sampleResult, []);

            const path = join(directory, "k.json");
            const raw = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;

            raw.schema = 99;
            writeFileSync(path, JSON.stringify(raw));

            expect(readCacheEntry(cacheRoot, adapter, "k")).toBeUndefined();
        });

        it("swallows write errors silently", () => {
            expect.assertions(1);

            const adapter = stubAdapter("oxlint");

            // A `\0` byte in the cache root forces a filesystem write failure
            // — the cache must not throw for opportunistic writes.
            expect(() => { writeCacheEntry("\0/invalid", adapter, "k", sampleResult, []); }).not.toThrow();
        });
    });
});
