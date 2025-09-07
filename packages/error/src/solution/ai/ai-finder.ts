import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "@visulima/path";
import type { LanguageModel } from "ai";
import { generateText } from "ai";

import type { Solution, SolutionFinder, SolutionFinderFile } from "../types";
import aiPrompt from "./ai-prompt";
import aiSolutionResponse from "./ai-solution-response";

const DEFAULT_HEADER = "## Ai Generated Solution";
const DEFAULT_ERROR_MESSAGE = "Creation of a AI solution failed.";

interface CacheOptions {
    enabled?: boolean;
    directory?: string;
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
            name: error.name,
            message: error.message,
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

// Get cache directory path
const getCacheDirectory = (directory?: string): string => {
    if (directory) {
        return directory;
    }
    
    // Default to a cache directory in the system temp folder
    return join(tmpdir(), "visulima-error-cache");
};

// Ensure cache directory exists
const ensureCacheDirectory = (cacheDir: string): void => {
    if (!existsSync(cacheDir)) {
        mkdirSync(cacheDir, { recursive: true });
    }
};

// Get cache file path
const getCacheFilePath = (cacheDir: string, key: string): string => {
    return join(cacheDir, `${key}.json`);
};

// Read from cache
const readFromCache = (cacheFilePath: string, ttl: number): Solution | null => {
    try {
        if (!existsSync(cacheFilePath)) {
            return null;
        }
        
        const cacheContent = readFileSync(cacheFilePath, "utf-8");
        const cacheEntry: CacheEntry = JSON.parse(cacheContent);
        
        // Check if cache entry is still valid
        const now = Date.now();
        if (now - cacheEntry.timestamp > ttl) {
            return null; // Cache expired
        }
        
        return cacheEntry.solution;
    } catch {
        return null; // Cache file corrupted or unreadable
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
        
        writeFileSync(cacheFilePath, JSON.stringify(cacheEntry, null, 2), "utf-8");
    } catch {
        // Silently fail if cache write fails
    }
};

const aiFinder = (
    model: LanguageModel,
    options?: {
        temperature?: number;
        cache?: CacheOptions;
    },
): SolutionFinder => {
    return {
        handle: async (error: Error, file: SolutionFinderFile): Promise<Solution | undefined> => {
            const cacheOptions = options?.cache;
            const temperature = options?.temperature ?? 0;
            
            // Check cache if enabled
            if (cacheOptions?.enabled !== false) {
                const cacheKey = generateCacheKey(error, file, temperature);
                const cacheDir = getCacheDirectory(cacheOptions?.directory);
                const cacheFilePath = getCacheFilePath(cacheDir, cacheKey);
                const ttl = cacheOptions?.ttl ?? 24 * 60 * 60 * 1000; // Default 24 hours
                
                // Try to read from cache
                const cachedSolution = readFromCache(cacheFilePath, ttl);
                
                if (cachedSolution) {
                    return cachedSolution;
                }
                
                // Ensure cache directory exists for writing
                ensureCacheDirectory(cacheDir);
            }

            const content = aiPrompt({ applicationType: undefined, error, file });

            try {
                const result = await generateText({
                    model,
                    prompt: content,
                    temperature,
                });

                const messageContent = result.text;

                let solution: Solution;
                if (!messageContent) {
                    solution = {
                        body: aiSolutionResponse(DEFAULT_ERROR_MESSAGE),
                        header: DEFAULT_HEADER,
                    };
                } else {
                    solution = {
                        body: aiSolutionResponse(messageContent),
                        header: DEFAULT_HEADER,
                    };
                }

                // Cache the solution if caching is enabled
                if (cacheOptions?.enabled !== false) {
                    const cacheKey = generateCacheKey(error, file, temperature);
                    const cacheDir = getCacheDirectory(cacheOptions);
                    const cacheFilePath = getCacheFilePath(cacheDir, cacheKey);
                    const ttl = cacheOptions?.ttl ?? 24 * 60 * 60 * 1000; // Default 24 hours
                    
                    writeToCache(cacheFilePath, solution, ttl);
                }

                return solution;
            } catch (error_) {
                // eslint-disable-next-line no-console
                console.error(error_);

                const solution = {
                    body: aiSolutionResponse(DEFAULT_ERROR_MESSAGE),
                    header: DEFAULT_HEADER,
                };

                // Cache the error solution as well to avoid retrying failed requests
                if (cacheOptions?.enabled !== false) {
                    const cacheKey = generateCacheKey(error, file, temperature);
                    const cacheDir = getCacheDirectory(cacheOptions);
                    const cacheFilePath = getCacheFilePath(cacheDir, cacheKey);
                    const ttl = cacheOptions?.ttl ?? 24 * 60 * 60 * 1000; // Default 24 hours
                    
                    writeToCache(cacheFilePath, solution, ttl);
                }

                return solution;
            }
        },
        name: "AI SDK",
        priority: 99,
    };
};

export default aiFinder;
