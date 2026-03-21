import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { Cache, parseCacheSize, formatCacheSize } from "../src/cache";

const createTmpDir = async (): Promise<string> => {
    const dir = join(tmpdir(), `task-runner-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

    await mkdir(dir, { recursive: true });

    return dir;
};

describe("Cache", () => {
    let workspaceRoot: string;
    let cache: Cache;

    beforeEach(async () => {
        workspaceRoot = await createTmpDir();
        cache = new Cache({ workspaceRoot });
    });

    afterEach(async () => {
        await rm(workspaceRoot, { recursive: true, force: true });
    });

    describe("put and get", () => {
        it("should store and retrieve a cache entry", async () => {
            await cache.put("abc123", "build output", [], 0);

            const result = await cache.get("abc123");

            expect(result).not.toBeNull();
            expect(result!.code).toBe(0);
            expect(result!.terminalOutput).toBe("build output");
            expect(result!.hash).toBe("abc123");
        });

        it("should return null for non-existent entry", async () => {
            const result = await cache.get("nonexistent");

            expect(result).toBeNull();
        });

        it("should store fingerprint data when provided", async () => {
            const fingerprint = {
                fileHashes: { "src/index.ts": "hash1" },
                missingFiles: [],
                directoryListings: {},
                commandHash: "cmdhash",
                envHashes: {},
            };

            await cache.put("fp123", "output", [], 0, fingerprint);

            const result = await cache.get("fp123");

            expect(result?.fingerprint).toEqual(fingerprint);
        });

        it("should not return entry without .commit marker", async () => {
            // Manually create an incomplete entry
            const entryDir = join(cache.cacheDirectory, "incomplete");

            await mkdir(entryDir, { recursive: true });
            await writeFile(join(entryDir, "code"), "0");
            await writeFile(join(entryDir, "terminalOutput"), "output");
            // No .commit marker

            const result = await cache.get("incomplete");

            expect(result).toBeNull();
        });

        it("should overwrite existing entry", async () => {
            await cache.put("hash1", "first output", [], 0);
            await cache.put("hash1", "second output", [], 0);

            const result = await cache.get("hash1");

            expect(result!.terminalOutput).toBe("second output");
        });
    });

    describe("output archiving and restoration", () => {
        it("should archive and restore output files", async () => {
            // Create an output file
            const outputDir = join(workspaceRoot, "dist");

            await mkdir(outputDir, { recursive: true });
            await writeFile(join(outputDir, "bundle.js"), "console.log('hello')");

            // Cache with output
            await cache.put("build1", "built", ["dist"], 0);

            // Remove the output
            await rm(outputDir, { recursive: true, force: true });

            // Restore
            const restored = await cache.restoreOutputs("build1", ["dist"]);

            expect(restored).toBe(true);

            const content = await readFile(join(outputDir, "bundle.js"), "utf-8");

            expect(content).toBe("console.log('hello')");
        });

        it("should return true when no outputs to restore", async () => {
            await cache.put("noout", "output", [], 0);

            const restored = await cache.restoreOutputs("noout", ["dist"]);

            expect(restored).toBe(true);
        });
    });

    describe("task index", () => {
        it("should store and retrieve task ID to hash mapping", async () => {
            await cache.put("hash1", "output", [], 0);
            await cache.setTaskIndex("project:build", "hash1");

            const result = await cache.getByTaskId("project:build");

            expect(result).not.toBeNull();
            expect(result!.hash).toBe("hash1");
        });

        it("should return null for unknown task ID", async () => {
            const result = await cache.getByTaskId("unknown:task");

            expect(result).toBeNull();
        });

        it("should update existing task index entry", async () => {
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
            const shortCache = new Cache({
                workspaceRoot,
                maxCacheAge: 1, // 1ms - everything is old
            });

            await shortCache.put("old1", "output", [], 0);

            // Wait a tiny bit to ensure the entry is "old"
            await new Promise((r) => { setTimeout(r, 10); });

            await shortCache.removeOldEntries();

            const result = await shortCache.get("old1");

            expect(result).toBeNull();
        });
    });

    describe("maxCacheSize enforcement", () => {
        it("should evict oldest entries when over size limit", async () => {
            const smallCache = new Cache({
                workspaceRoot,
                maxCacheSize: "1KB", // Very small
            });

            // Create entries with some content
            const largeOutput = "x".repeat(500);

            await smallCache.put("first", largeOutput, [], 0);

            // Small delay to ensure different mtime
            await new Promise((r) => { setTimeout(r, 50); });

            await smallCache.put("second", largeOutput, [], 0);

            await new Promise((r) => { setTimeout(r, 50); });

            await smallCache.put("third", largeOutput, [], 0);

            // Run cleanup
            await smallCache.removeOldEntries();

            // The newest entry should survive, oldest should be evicted
            const third = await smallCache.get("third");

            expect(third).not.toBeNull();
        });
    });

    describe("clear", () => {
        it("should remove the entire cache directory", async () => {
            await cache.put("entry1", "output", [], 0);
            await cache.clear();

            const result = await cache.get("entry1");

            expect(result).toBeNull();
        });
    });
});

describe("parseCacheSize", () => {
    it("should parse KB", () => {
        expect(parseCacheSize("100KB")).toBe(100 * 1024);
    });

    it("should parse MB", () => {
        expect(parseCacheSize("500MB")).toBe(500 * 1024 * 1024);
    });

    it("should parse GB", () => {
        expect(parseCacheSize("1GB")).toBe(1024 * 1024 * 1024);
    });

    it("should parse decimal values", () => {
        expect(parseCacheSize("1.5GB")).toBe(1.5 * 1024 * 1024 * 1024);
    });

    it("should be case insensitive", () => {
        expect(parseCacheSize("500mb")).toBe(500 * 1024 * 1024);
    });

    it("should throw on invalid format", () => {
        expect(() => parseCacheSize("invalid")).toThrow();
    });
});

describe("formatCacheSize", () => {
    it("should format bytes", () => {
        expect(formatCacheSize(500)).toBe("500B");
    });

    it("should format KB", () => {
        expect(formatCacheSize(2048)).toBe("2.0KB");
    });

    it("should format MB", () => {
        expect(formatCacheSize(5 * 1024 * 1024)).toBe("5.0MB");
    });

    it("should format GB", () => {
        expect(formatCacheSize(2 * 1024 * 1024 * 1024)).toBe("2.0GB");
    });
});
