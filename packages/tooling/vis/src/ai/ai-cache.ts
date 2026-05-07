import { readdirSync, rmSync, statSync, writeFileSync } from "node:fs";

import { xxh3Hash } from "@shared/xxh3";
import { ensureDirSync, isAccessibleSync, readJsonSync } from "@visulima/fs";
import { join } from "@visulima/path";

import type { OutdatedEntry } from "../util/catalog";
import { getVisCacheDir } from "../util/vis-paths";
import type { AiAnalysisResult, AnalysisType } from "./types";

// --- Constants ---

const getCacheDirectory = (): string => join(getVisCacheDir(), "ai");
const DEFAULT_TTL_MS = 60 * 60 * 1000; // 1 hour
const SECURITY_TTL_MS = 30 * 60 * 1000; // 30 minutes

// --- Types ---

interface CacheEntry<T = AiAnalysisResult> {
    createdAt: number;
    result: T;
    ttlMs: number;
}

interface CacheStats {
    entries: number;
    newestEntry: number | undefined;
    oldestEntry: number | undefined;
    totalSizeBytes: number;
}

// --- Helpers ---

const ensureCacheDirectory = (): void => {
    ensureDirSync(getCacheDirectory());
};

// --- Public API ---

const buildCacheKey = (provider: string, analysisType: string, outdated: Pick<OutdatedEntry, "currentRange" | "packageName" | "targetVersion">[]): string => {
    const packages = outdated
        .map((entry) => {
            return { currentRange: entry.currentRange, name: entry.packageName, targetVersion: entry.targetVersion };
        })
        .toSorted((a, b) => a.name.localeCompare(b.name));

    const payload = JSON.stringify({ analysisType, packages, provider });

    return xxh3Hash(Buffer.from(payload));
};

const getCachedAnalysis = (cacheKey: string): AiAnalysisResult | undefined => {
    const filePath = join(getCacheDirectory(), `${cacheKey}.json`);

    if (!isAccessibleSync(filePath)) {
        return undefined;
    }

    try {
        const entry = readJsonSync(filePath) as unknown as CacheEntry;

        if (Date.now() - entry.createdAt > entry.ttlMs) {
            rmSync(filePath, { force: true });

            return undefined;
        }

        return entry.result;
    } catch {
        // Corrupted cache file — remove it
        rmSync(filePath, { force: true });

        return undefined;
    }
};

const setCachedAnalysis = (cacheKey: string, result: AiAnalysisResult, ttlMs: number): void => {
    ensureCacheDirectory();

    const cacheDirectory = getCacheDirectory();
    const entry: CacheEntry = {
        createdAt: Date.now(),
        result,
        ttlMs,
    };

    writeFileSync(join(cacheDirectory, `${cacheKey}.json`), JSON.stringify(entry, undefined, 2), "utf8");
};

const getTtlForAnalysisType = (analysisType: AnalysisType | (string & {}), configTtl?: number): number => {
    if (configTtl !== undefined && configTtl > 0) {
        return configTtl;
    }

    return analysisType === "security" ? SECURITY_TTL_MS : DEFAULT_TTL_MS;
};

const getCacheStats = (): CacheStats => {
    const cacheDirectory = getCacheDirectory();

    if (!isAccessibleSync(cacheDirectory)) {
        return { entries: 0, newestEntry: undefined, oldestEntry: undefined, totalSizeBytes: 0 };
    }

    const files = readdirSync(cacheDirectory).filter((f) => f.endsWith(".json"));

    let totalSizeBytes = 0;
    let oldest: number | undefined;
    let newest: number | undefined;

    for (const file of files) {
        const filePath = join(cacheDirectory, file);
        const stat = statSync(filePath);

        totalSizeBytes += stat.size;

        const { mtimeMs } = stat;

        if (oldest === undefined || mtimeMs < oldest) {
            oldest = mtimeMs;
        }

        if (newest === undefined || mtimeMs > newest) {
            newest = mtimeMs;
        }
    }

    return { entries: files.length, newestEntry: newest, oldestEntry: oldest, totalSizeBytes };
};

const buildHashCacheKey = (payload: unknown): string => xxh3Hash(Buffer.from(JSON.stringify(payload)));

const getCachedJson = (cacheKey: string): unknown => {
    const filePath = join(getCacheDirectory(), `${cacheKey}.json`);

    if (!isAccessibleSync(filePath)) {
        return undefined;
    }

    try {
        const entry = readJsonSync(filePath) as unknown as CacheEntry<unknown>;

        if (Date.now() - entry.createdAt > entry.ttlMs) {
            rmSync(filePath, { force: true });

            return undefined;
        }

        return entry.result;
    } catch {
        rmSync(filePath, { force: true });

        return undefined;
    }
};

const setCachedJson = (cacheKey: string, result: unknown, ttlMs: number): void => {
    ensureCacheDirectory();

    const cacheDirectory = getCacheDirectory();
    const entry: CacheEntry<unknown> = {
        createdAt: Date.now(),
        result,
        ttlMs,
    };

    writeFileSync(join(cacheDirectory, `${cacheKey}.json`), JSON.stringify(entry, undefined, 2), "utf8");
};

const clearCache = (): number => {
    const cacheDirectory = getCacheDirectory();

    if (!isAccessibleSync(cacheDirectory)) {
        return 0;
    }

    const files = readdirSync(cacheDirectory).filter((f) => f.endsWith(".json"));

    for (const file of files) {
        rmSync(join(cacheDirectory, file), { force: true });
    }

    return files.length;
};

export type { CacheEntry, CacheStats };

export {
    buildCacheKey,
    buildHashCacheKey,
    clearCache,
    getCachedAnalysis,
    getCachedJson,
    getCacheStats,
    getTtlForAnalysisType,
    setCachedAnalysis,
    setCachedJson,
};
