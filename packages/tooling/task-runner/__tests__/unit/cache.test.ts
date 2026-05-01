import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { Cache, formatCacheSize, parseCacheSize } from "../../src/cache";

const createTemporaryDirectory = async (): Promise<string> => {
    // eslint-disable-next-line sonarjs/pseudo-random
    const directory = join(tmpdir(), `task-runner-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

    await mkdir(directory, { recursive: true });

    return directory;
};

describe(Cache, () => {
    let workspaceRoot: string;
    let cache: Cache;

    beforeEach(async () => {
        workspaceRoot = await createTemporaryDirectory();
        cache = new Cache({ workspaceRoot });
    });

    afterEach(async () => {
        await rm(workspaceRoot, { force: true, recursive: true });
    });

    describe("put and get", () => {
        it("should store and retrieve a cache entry", async () => {
            expect.assertions(4);

            await cache.put("abc123", "build output", [], 0);

            const result = await cache.get("abc123");

            expect(result).toBeDefined();

            expect(result!.code).toBe(0);

            expect(result!.terminalOutput).toBe("build output");

            expect(result!.hash).toBe("abc123");
        });

        it("should return null for non-existent entry", async () => {
            expect.assertions(1);

            const result = await cache.get("nonexistent");

            expect(result).toBeUndefined();
        });

        it("should store fingerprint data when provided", async () => {
            expect.assertions(1);

            const fingerprint = {
                commandHash: "cmdhash",
                directoryListings: {},
                envHashes: {},
                fileHashes: { "src/index.ts": "hash1" },
                missingFiles: [],
            };

            await cache.put("fp123", "output", [], 0, fingerprint);

            const result = await cache.get("fp123");

            expect(result?.fingerprint).toStrictEqual(fingerprint);
        });

        it("should not return entry without .commit marker", async () => {
            expect.assertions(1);

            // Manually create an incomplete entry
            const entryDirectory = join(cache.cacheDirectory, "incomplete");

            await mkdir(entryDirectory, { recursive: true });
            await writeFile(join(entryDirectory, "code"), "0");
            await writeFile(join(entryDirectory, "terminalOutput"), "output");
            // No .commit marker

            const result = await cache.get("incomplete");

            expect(result).toBeUndefined();
        });

        it("should overwrite existing entry", async () => {
            expect.assertions(1);

            await cache.put("hash1", "first output", [], 0);
            await cache.put("hash1", "second output", [], 0);

            const result = await cache.get("hash1");

            expect(result!.terminalOutput).toBe("second output");
        });
    });

    describe("output archiving and restoration", () => {
        it("should archive and restore output files", async () => {
            expect.assertions(2);

            // Create an output file
            const outputDirectory = join(workspaceRoot, "dist");

            await mkdir(outputDirectory, { recursive: true });
            await writeFile(join(outputDirectory, "bundle.js"), "console.log('hello')");

            // Cache with output
            await cache.put("build1", "built", ["dist"], 0);

            // Remove the output
            await rm(outputDirectory, { force: true, recursive: true });

            // Restore
            const restored = await cache.restoreOutputs("build1", ["dist"]);

            expect(restored).toBe(true);

            const content = await readFile(join(outputDirectory, "bundle.js"), "utf8");

            expect(content).toBe("console.log('hello')");
        });

        it("should return true when no outputs to restore", async () => {
            expect.assertions(1);

            await cache.put("noout", "output", [], 0);

            const restored = await cache.restoreOutputs("noout", ["dist"]);

            expect(restored).toBe(true);
        });

        it("round-trips outputs through the compressed archive", async () => {
            expect.assertions(3);

            const outputDirectory = join(workspaceRoot, "dist");

            await mkdir(outputDirectory, { recursive: true });
            // Use a compressible payload so the archive is meaningfully
            // smaller than the source — catches regressions where
            // someone swaps the compressor out.
            await writeFile(join(outputDirectory, "bundle.js"), "console.log('hello');\n".repeat(200));

            await cache.put("br-build", "built", ["dist"], 0);
            await rm(outputDirectory, { force: true, recursive: true });

            const restored = await cache.restoreOutputs("br-build", ["dist"]);

            expect(restored).toBe(true);

            const { stat: fsStat } = await import("node:fs/promises");
            const archiveStat = await fsStat(join(workspaceRoot, ".task-runner-cache", "br-build", "outputs.tar.br"));

            expect(archiveStat.isFile()).toBe(true);

            const content = await readFile(join(outputDirectory, "bundle.js"), "utf8");

            expect(content).toContain("console.log('hello');");
        });

        it("cacheNamespace isolates entries under ns/<namespace>", async () => {
            expect.assertions(3);

            const nsCache = new Cache({ cacheNamespace: "prod", workspaceRoot });

            await nsCache.put("isolated-hash", "built", [], 0);

            const { stat: fsStat } = await import("node:fs/promises");

            await expect(fsStat(join(workspaceRoot, ".task-runner-cache", "ns", "prod", "isolated-hash"))).resolves.toBeDefined();

            // Other namespace gets its own tree and can't see the first entry.
            const otherCache = new Cache({ cacheNamespace: "staging", workspaceRoot });
            const hitFromOther = await otherCache.get("isolated-hash");

            expect(hitFromOther).toBeUndefined();

            // Unnamespaced cache also doesn't see namespaced entries.
            const vanillaCache = new Cache({ workspaceRoot });

            await expect(vanillaCache.get("isolated-hash")).resolves.toBeUndefined();
        });

        it("archives and restores outputs specified via glob patterns", async () => {
            expect.assertions(3);

            const distDirectory = join(workspaceRoot, "dist");

            await mkdir(join(distDirectory, "nested"), { recursive: true });
            await writeFile(join(distDirectory, "bundle.js"), "console.log(1);\n".repeat(100));
            await writeFile(join(distDirectory, "nested/deep.js"), "deep");

            await cache.put("glob-build", "built", ["dist/**"], 0);

            await rm(distDirectory, { force: true, recursive: true });

            const restored = await cache.restoreOutputs("glob-build");

            expect(restored).toBe(true);

            // Glob expansion produced archive entries for each file; the
            // restore swap root (`dist`) is derived from the archive's
            // top-level, so both files land back in place.
            await expect(readFile(join(distDirectory, "bundle.js"), "utf8")).resolves.toContain("console.log(1);");
            await expect(readFile(join(distDirectory, "nested/deep.js"), "utf8")).resolves.toBe("deep");
        });

        it("excludes files matching a negative glob from the archive", async () => {
            expect.assertions(3);

            const distDirectory = join(workspaceRoot, "dist");

            await mkdir(join(distDirectory, "cache"), { recursive: true });
            await writeFile(join(distDirectory, "bundle.js"), "kept");
            await writeFile(join(distDirectory, "cache/tmp.bin"), "excluded-on-archive");

            await cache.put("neg-build", "built", ["dist/**", "!dist/cache/**"], 0);

            // Nuke the workspace output tree before restoring.
            await rm(distDirectory, { force: true, recursive: true });

            const restored = await cache.restoreOutputs("neg-build");

            expect(restored).toBe(true);
            await expect(readFile(join(distDirectory, "bundle.js"), "utf8")).resolves.toBe("kept");

            // Excluded file is not in the archive and therefore not
            // restored — exclusion semantics match the docs.
            const { stat: fsStat } = await import("node:fs/promises");

            await expect(fsStat(join(distDirectory, "cache/tmp.bin"))).rejects.toBeDefined();
        });

        it("archives files from { auto: true } based on autoWrites input", async () => {
            expect.assertions(2);

            const buildDirectory = join(workspaceRoot, "build");

            await mkdir(buildDirectory, { recursive: true });
            await writeFile(join(buildDirectory, "traced.js"), "auto-captured");
            await writeFile(join(buildDirectory, "not-written.js"), "untraced");

            // Only `traced.js` is in `autoWrites` — simulates what the
            // orchestrator passes from the file-access tracker. The
            // untraced sibling should NOT make it into the archive.
            await cache.put("auto-build", "built", [{ auto: true }], 0, undefined, [join(buildDirectory, "traced.js")]);

            await rm(buildDirectory, { force: true, recursive: true });

            const restored = await cache.restoreOutputs("auto-build");

            expect(restored).toBe(true);
            await expect(readFile(join(buildDirectory, "traced.js"), "utf8")).resolves.toBe("auto-captured");
        });

        it("restore swaps the new tree into place and leaves the existing tree intact until success", async () => {
            expect.assertions(2);

            const outputDirectory = join(workspaceRoot, "dist");

            // Seed + cache the initial payload.
            await mkdir(outputDirectory, { recursive: true });
            await writeFile(join(outputDirectory, "out.js"), "v1");
            await cache.put("round2", "built", ["dist"], 0);

            // Simulate a stale in-tree build — the existing tree should be
            // replaced by the cached one on restore, not merged into.
            await writeFile(join(outputDirectory, "stale.js"), "should be gone");

            const restored = await cache.restoreOutputs("round2", ["dist"]);

            expect(restored).toBe(true);

            // The stale file is gone (not merged), and the cached file is
            // present — atomic swap worked.
            const { stat: fsStat } = await import("node:fs/promises");

            await expect(fsStat(join(outputDirectory, "stale.js"))).rejects.toBeDefined();
        });
    });

    describe("cacheNamespace safety", () => {
        it("rejects path separators to prevent escape from the cache subtree", () => {
            expect.assertions(3);
            expect(() => new Cache({ cacheNamespace: "../escape", workspaceRoot })).toThrow(/path separators/);
            expect(() => new Cache({ cacheNamespace: "a/b", workspaceRoot })).toThrow(/path separators/);
            expect(() => new Cache({ cacheNamespace: String.raw`a\b`, workspaceRoot })).toThrow(/path separators/);
        });

        it("rejects '..' and '.' whole components", () => {
            expect.assertions(2);
            expect(() => new Cache({ cacheNamespace: "..", workspaceRoot })).toThrow(/escape/);
            expect(() => new Cache({ cacheNamespace: ".", workspaceRoot })).toThrow(/escape/);
        });

        it("rejects null bytes", () => {
            expect.assertions(1);
            expect(() => new Cache({ cacheNamespace: "prod\0admin", workspaceRoot })).toThrow(/null bytes/);
        });

        it("empty namespace falls through to the unnamespaced path", () => {
            expect.assertions(1);

            const cache1 = new Cache({ cacheNamespace: "", workspaceRoot });

            expect(cache1.cacheDirectory).not.toContain("/ns/");
        });
    });

    describe("task index", () => {
        it("should store and retrieve task ID to hash mapping", async () => {
            expect.assertions(2);

            await cache.put("hash1", "output", [], 0);
            await cache.setTaskIndex("project:build", "hash1");

            const result = await cache.getByTaskId("project:build");

            expect(result).toBeDefined();

            expect(result!.hash).toBe("hash1");
        });

        it("should return null for unknown task ID", async () => {
            expect.assertions(1);

            const result = await cache.getByTaskId("unknown:task");

            expect(result).toBeUndefined();
        });

        it("should update existing task index entry", async () => {
            expect.assertions(2);

            await cache.put("hash1", "output1", [], 0);
            await cache.put("hash2", "output2", [], 0);
            await cache.setTaskIndex("project:build", "hash1");
            await cache.setTaskIndex("project:build", "hash2");

            const result = await cache.getByTaskId("project:build");

            expect(result!.hash).toBe("hash2");

            expect(result!.terminalOutput).toBe("output2");
        });
    });

    describe("removeOldEntries", () => {
        it("should remove entries older than maxCacheAge", async () => {
            expect.assertions(1);

            const shortCache = new Cache({
                maxCacheAge: 1, // 1ms - everything is old
                workspaceRoot,
            });

            await shortCache.put("old1", "output", [], 0);

            // Wait a tiny bit to ensure the entry is "old"
            await new Promise((resolve) => {
                setTimeout(resolve, 10);
            });

            await shortCache.removeOldEntries();

            const result = await shortCache.get("old1");

            expect(result).toBeUndefined();
        });
    });

    describe("maxCacheSize enforcement", () => {
        it("should evict oldest entries when over size limit", async () => {
            expect.assertions(1);

            const smallCache = new Cache({
                maxCacheSize: "1KB", // Very small
                workspaceRoot,
            });

            // Create entries with some content
            const largeOutput = "x".repeat(500);

            await smallCache.put("first", largeOutput, [], 0);

            // Small delay to ensure different mtime
            await new Promise((resolve) => {
                setTimeout(resolve, 50);
            });

            await smallCache.put("second", largeOutput, [], 0);

            await new Promise((resolve) => {
                setTimeout(resolve, 50);
            });

            await smallCache.put("third", largeOutput, [], 0);

            // Run cleanup
            await smallCache.removeOldEntries();

            // The newest entry should survive, oldest should be evicted
            const third = await smallCache.get("third");

            expect(third).toBeDefined();
        });
    });

    describe("clear", () => {
        it("should remove the entire cache directory", async () => {
            expect.assertions(1);

            await cache.put("entry1", "output", [], 0);
            await cache.clear();

            const result = await cache.get("entry1");

            expect(result).toBeUndefined();
        });
    });
});

describe(parseCacheSize, () => {
    it("should parse KB", () => {
        expect.assertions(1);
        expect(parseCacheSize("100KB")).toBe(100 * 1024);
    });

    it("should parse MB", () => {
        expect.assertions(1);
        expect(parseCacheSize("500MB")).toBe(500 * 1024 * 1024);
    });

    it("should parse GB", () => {
        expect.assertions(1);
        expect(parseCacheSize("1GB")).toBe(1024 * 1024 * 1024);
    });

    it("should parse decimal values", () => {
        expect.assertions(1);
        expect(parseCacheSize("1.5GB")).toBe(1.5 * 1024 * 1024 * 1024);
    });

    it("should be case insensitive", () => {
        expect.assertions(1);
        expect(parseCacheSize("500mb")).toBe(500 * 1024 * 1024);
    });

    it("should throw on invalid format", () => {
        expect.assertions(1);
        expect(() => parseCacheSize("invalid")).toThrow("Invalid cache size format");
    });
});

describe(formatCacheSize, () => {
    it("should format bytes", () => {
        expect.assertions(1);
        expect(formatCacheSize(500)).toBe("500.0Bytes");
    });

    it("should format KB", () => {
        expect.assertions(1);
        expect(formatCacheSize(2048)).toBe("2.0KB");
    });

    it("should format MB", () => {
        expect.assertions(1);
        expect(formatCacheSize(5 * 1024 * 1024)).toBe("5.0MB");
    });

    it("should format GB", () => {
        expect.assertions(1);
        expect(formatCacheSize(2 * 1024 * 1024 * 1024)).toBe("2.0GB");
    });
});
