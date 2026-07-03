import { createHash } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import type { LanguageModel } from "ai";
import { generateText } from "ai";

import type { Solution, SolutionFinder, SolutionFinderFile } from "../types";
import aiPrompt from "./ai-prompt";
import aiSolutionResponse from "./ai-solution-response";

const DEFAULT_HEADER = "## Ai Generated Solution";

interface CacheOptions {
    directory?: string;
    enabled?: boolean;
    ttl?: number; // Time to live in milliseconds
}

interface CacheEntry {
    solution: Solution;
    timestamp: number;
    ttl: number;
}

// Generate a cache key from error and file data
const generateCacheKey = (error: Error, file: SolutionFinderFile, temperature?: number): string => {
    const keyData = {
        error: {
            message: error.message,
            name: error.name,
            stack: error.stack,
        },
        file: {
            file: file.file,
            language: file.language,
            line: file.line,
            snippet: file.snippet,
        },
        temperature,
    };

    return createHash("sha256").update(JSON.stringify(keyData)).digest("hex");
};

// Get cache directory path.
//
// Security: the previous default of `join(tmpdir(), "visulima-error-cache")` is a world-shared
// directory on multi-user hosts, so whichever user creates it first can read or poison the AI
// solutions shown to everyone else. Default instead to a per-user cache directory
// (`$XDG_CACHE_HOME` or `~/.cache`), and create it with mode 0700 so only the owner can access it.
const getCacheDirectory = (directory?: string): string => {
    if (directory) {
        return directory;
    }

    const xdgCacheHome = typeof process === "undefined" ? undefined : process.env.XDG_CACHE_HOME;
    const base = xdgCacheHome && xdgCacheHome.length > 0 ? xdgCacheHome : join(homedir(), ".cache");

    return join(base, "visulima-error-cache");
};

// Ensure cache directory exists (owner-only permissions to avoid cross-user cache poisoning).
//
// Security: use `lstatSync` (which does NOT follow symlinks) to reject a pre-existing entry that is
// a symlink or anything other than a real directory. Otherwise an attacker who pre-creates the cache
// path as a symlink to a location they control could make us read/write through it (symlink-follow /
// cache poisoning). Throwing here disables caching for the call (callers guard the write path) rather
// than silently following the link.
const ensureCacheDirectory = (cacheDirectory: string): void => {
    let stats;

    try {
        stats = lstatSync(cacheDirectory);
    } catch {
        // Does not exist yet — create it with owner-only permissions.
        mkdirSync(cacheDirectory, { mode: 0o700, recursive: true });

        return;
    }

    if (stats.isSymbolicLink() || !stats.isDirectory()) {
        throw new Error(`Refusing to use cache path '${cacheDirectory}': not a regular directory (possible symlink attack).`);
    }
};

// Get cache file path
const getCacheFilePath = (cacheDirectory: string, key: string): string => join(cacheDirectory, `${key}.json`);

// Read from cache
const readFromCache = (cacheFilePath: string, ttl: number): Solution | undefined => {
    try {
        if (!existsSync(cacheFilePath)) {
            return undefined;
        }

        const cacheContent = readFileSync(cacheFilePath, "utf8");
        const cacheEntry = JSON.parse(cacheContent) as CacheEntry;

        // Check if cache entry is still valid
        const now = Date.now();

        if (now - cacheEntry.timestamp > ttl) {
            return undefined; // Cache expired
        }

        return cacheEntry.solution;
    } catch {
        return undefined; // Cache file corrupted or unreadable
    }
};

// Write to cache
const writeToCache = (cacheFilePath: string, solution: Solution, ttl: number): void => {
    try {
        const cacheEntry: CacheEntry = {
            solution,
            timestamp: Date.now(),
            ttl,
        };

        // eslint-disable-next-line unicorn/no-null
        writeFileSync(cacheFilePath, JSON.stringify(cacheEntry, null, 2), "utf8");
    } catch {
        // Silently fail if cache write fails
    }
};

const aiFinder = (
    model: LanguageModel,
    options?: {
        cache?: CacheOptions;
        temperature?: number;
    },
): SolutionFinder => {
    return {
        handle: async (error: Error, file: SolutionFinderFile): Promise<Solution | undefined> => {
            const cacheOptions = options?.cache;
            const temperature = options?.temperature ?? 0;
            const ttl = cacheOptions?.ttl ?? 24 * 60 * 60 * 1000; // Default 24 hours

            const cacheDirectory = getCacheDirectory(cacheOptions?.directory);

            // Disabled if the cache directory can't be safely prepared (e.g. it is a symlink).
            let cacheWritable = cacheOptions?.enabled !== false;

            // Check cache if enabled
            if (cacheWritable) {
                const cacheKey = generateCacheKey(error, file, temperature);
                const cacheFilePath = getCacheFilePath(cacheDirectory, cacheKey);

                // Try to read from cache
                const cachedSolution = readFromCache(cacheFilePath, ttl);

                if (cachedSolution) {
                    return cachedSolution;
                }

                // Ensure cache directory exists for writing. If it can't be created safely (symlink
                // attack / not a directory) we disable caching for this call instead of failing.
                try {
                    ensureCacheDirectory(cacheDirectory);
                } catch (error_) {
                    // eslint-disable-next-line no-console
                    console.error(error_);

                    cacheWritable = false;
                }
            }

            const content = aiPrompt({ applicationType: undefined, error, file });

            try {
                const result = await generateText({
                    model,
                    prompt: content,
                    temperature,
                });

                const messageContent = result.text;

                // An empty response is a soft failure: don't cache it (a transient empty answer
                // would otherwise be served for the full TTL) and return undefined so lower-priority
                // finders can still supply a real hint.
                if (!messageContent) {
                    return undefined;
                }

                const solution: Solution = {
                    body: aiSolutionResponse(messageContent),
                    header: DEFAULT_HEADER,
                };

                // Cache the solution if caching is enabled
                if (cacheWritable) {
                    const cacheKey = generateCacheKey(error, file, temperature);
                    const cacheFilePath = getCacheFilePath(cacheDirectory, cacheKey);

                    writeToCache(cacheFilePath, solution, ttl);
                }

                return solution;
            } catch (error_) {
                // eslint-disable-next-line no-console
                console.error(error_);

                // A request failure (e.g. transient network/API outage) must NOT be cached for the
                // full TTL — that would poison the answer for hours. Return undefined so the failure
                // is retried next time and lower-priority finders can supply a real hint.
                return undefined;
            }
        },
        name: "AI SDK",
        priority: 99,
    };
};

export default aiFinder;
