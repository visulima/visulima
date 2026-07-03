import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AiAnalysisResult } from "../../src/ai/ai-analysis";

const HEX_REGEX = /^[0-9a-f]+$/;

// Mock homedir before importing the module under test
const TEST_HOME = join(tmpdir(), `vis-cache-test-${String(process.pid)}-${String(Date.now())}`);

vi.mock(import("node:os"), async (importOriginal) => {
    const original = await importOriginal<typeof import("node:os")>();

    return { ...original, homedir: () => TEST_HOME };
});

// Now import the module — it will use our mocked homedir
const { buildCacheKey, clearCache, getCachedAnalysis, getCacheStats, getTtlForAnalysisType, setCachedAnalysis } = await import("../../src/ai/ai-cache");

const CACHE_DIR = join(TEST_HOME, ".vis", "cache", "ai");

const makeResult = (overrides: Partial<AiAnalysisResult> = {}): AiAnalysisResult => {
    return {
        analysisType: "impact",
        provider: "claude",
        recommendations: [{ action: "update", breakingChanges: [], effort: "low", package: "react", reason: "safe update", riskLevel: "low" }],
        summary: "All safe",
        warnings: [],
        ...overrides,
    };
};

// --- Pure functions (no filesystem) ---

describe("buildCacheKey", () => {
    it("should produce a hex string", () => {
        expect.assertions(2);

        const key = buildCacheKey("claude", "impact", [{ currentRange: "^1.0.0", packageName: "react", targetVersion: "2.0.0" }]);

        expect(key).toHaveLength(32); // xxh3-128 hex
        expect(key).toMatch(HEX_REGEX);
    });

    it("should produce same key for same inputs", () => {
        expect.assertions(1);

        const entries = [{ currentRange: "^1.0.0", packageName: "react", targetVersion: "2.0.0" }];

        expect(buildCacheKey("claude", "impact", entries)).toBe(buildCacheKey("claude", "impact", entries));
    });

    it("should produce different keys for different providers", () => {
        expect.assertions(1);

        const entries = [{ currentRange: "^1.0.0", packageName: "react", targetVersion: "2.0.0" }];

        expect(buildCacheKey("claude", "impact", entries)).not.toBe(buildCacheKey("gemini", "impact", entries));
    });

    it("should produce different keys for different analysis types", () => {
        expect.assertions(1);

        const entries = [{ currentRange: "^1.0.0", packageName: "react", targetVersion: "2.0.0" }];

        expect(buildCacheKey("claude", "impact", entries)).not.toBe(buildCacheKey("claude", "security", entries));
    });

    it("should produce same key regardless of entry order", () => {
        expect.assertions(1);

        const entries1 = [
            { currentRange: "^1.0.0", packageName: "react", targetVersion: "2.0.0" },
            { currentRange: "^3.0.0", packageName: "vue", targetVersion: "4.0.0" },
        ];
        const entries2 = [
            { currentRange: "^3.0.0", packageName: "vue", targetVersion: "4.0.0" },
            { currentRange: "^1.0.0", packageName: "react", targetVersion: "2.0.0" },
        ];

        expect(buildCacheKey("claude", "impact", entries1)).toBe(buildCacheKey("claude", "impact", entries2));
    });
});

describe("getTtlForAnalysisType", () => {
    it("should return 30 minutes for security", () => {
        expect.assertions(1);

        expect(getTtlForAnalysisType("security")).toBe(30 * 60 * 1000);
    });

    it("should return 1 hour for non-security types", () => {
        expect.assertions(3);

        expect(getTtlForAnalysisType("impact")).toBe(60 * 60 * 1000);
        expect(getTtlForAnalysisType("compatibility")).toBe(60 * 60 * 1000);
        expect(getTtlForAnalysisType("recommend")).toBe(60 * 60 * 1000);
    });

    it("should use config TTL when provided", () => {
        expect.assertions(1);

        expect(getTtlForAnalysisType("security", 5000)).toBe(5000);
    });

    it("should ignore zero or negative config TTL", () => {
        expect.assertions(2);

        expect(getTtlForAnalysisType("impact", 0)).toBe(60 * 60 * 1000);
        expect(getTtlForAnalysisType("impact", -100)).toBe(60 * 60 * 1000);
    });
});

// --- Filesystem-based tests ---

describe("filesystem cache", () => {
    beforeEach(() => {
        if (existsSync(CACHE_DIR)) {
            rmSync(CACHE_DIR, { force: true, recursive: true });
        }

        mkdirSync(CACHE_DIR, { recursive: true });
    });

    afterEach(() => {
        if (existsSync(TEST_HOME)) {
            rmSync(TEST_HOME, { force: true, recursive: true });
        }
    });

    // --- read/write ---

    it("should return undefined for missing cache key", () => {
        expect.assertions(1);

        expect(getCachedAnalysis("nonexistent-key")).toBeUndefined();
    });

    it("should round-trip a cache entry", () => {
        expect.assertions(3);

        const result = makeResult();

        setCachedAnalysis("test-round-trip", result, 60_000);

        const cached = getCachedAnalysis("test-round-trip");

        expect(cached).toBeDefined();
        expect(cached?.provider).toBe("claude");
        expect(cached?.summary).toBe("All safe");
    });

    it("should return undefined for expired entries", () => {
        expect.assertions(1);

        writeFileSync(
            join(CACHE_DIR, "test-expired.json"),
            JSON.stringify({
                createdAt: Date.now() - 120_000,
                result: makeResult(),
                ttlMs: 60_000,
            }),
            "utf8",
        );

        expect(getCachedAnalysis("test-expired")).toBeUndefined();
    });

    it("should return undefined for corrupted cache files", () => {
        expect.assertions(1);

        writeFileSync(join(CACHE_DIR, "test-corrupted.json"), "not valid json{{{", "utf8");

        expect(getCachedAnalysis("test-corrupted")).toBeUndefined();
    });

    it("should remove expired entries from disk", () => {
        expect.assertions(1);

        const filePath = join(CACHE_DIR, "test-cleanup.json");

        writeFileSync(
            filePath,
            JSON.stringify({
                createdAt: Date.now() - 120_000,
                result: makeResult(),
                ttlMs: 60_000,
            }),
            "utf8",
        );

        getCachedAnalysis("test-cleanup");

        expect(existsSync(filePath)).toBe(false);
    });

    // --- getCacheStats ---

    it("should return zero stats for empty cache", () => {
        expect.assertions(4);

        const stats = getCacheStats();

        expect(stats.entries).toBe(0);
        expect(stats.totalSizeBytes).toBe(0);
        expect(stats.oldestEntry).toBeUndefined();
        expect(stats.newestEntry).toBeUndefined();
    });

    it("should count entries and calculate size", () => {
        expect.assertions(2);

        setCachedAnalysis("stats-1", makeResult(), 60_000);
        setCachedAnalysis("stats-2", makeResult(), 60_000);

        const stats = getCacheStats();

        expect(stats.entries).toBe(2);
        expect(stats.totalSizeBytes).toBeGreaterThan(0);
    });

    // --- clearCache ---

    it("should return 0 for empty cache", () => {
        expect.assertions(1);

        expect(clearCache()).toBe(0);
    });

    it("should delete all cache files and return count", () => {
        expect.assertions(2);

        setCachedAnalysis("clear-1", makeResult(), 60_000);
        setCachedAnalysis("clear-2", makeResult(), 60_000);

        expect(clearCache()).toBe(2);
        expect(getCacheStats().entries).toBe(0);
    });
});
