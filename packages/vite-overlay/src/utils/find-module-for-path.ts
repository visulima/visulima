import type { ModuleNode, ViteDevServer } from "vite";

import type { ModuleMatch } from "../types";

// Constants for module matching scoring
const EXACT_MATCH_SCORE = 100 as const;
const CONTAINS_MATCH_SCORE = 50 as const;

/**
 * Extracts relevant paths from a module for matching
 */
const getModulePaths = (module: unknown, id: string): ReadonlyArray<string> => {
    const moduleObject = module as Record<string, unknown>;
    const file = String(moduleObject.file || "").replaceAll("\\", "/");
    const idString = String(id || "").replaceAll("\\", "/");
    const url = String(moduleObject.url || "").replaceAll("\\", "/");

    return [file, idString, url] as const;
};

/**
 * Gets the match score between a single path and candidate
 */
const getPathMatchScore = (path: string, candidate: string): number => {
    // Exact match gets highest score
    if (path === candidate) {
        return EXACT_MATCH_SCORE;
    }

    // Contains match gets medium score
    if (path.includes(candidate) || candidate.includes(path)) {
        return CONTAINS_MATCH_SCORE;
    }

    return 0;
};

/**
 * Calculates the match score for module paths against candidates
 */
const calculateMatchScore = (modulePaths: ReadonlyArray<string>, candidates: ReadonlyArray<string>): number => {
    let maxScore = 0;

    for (const path of modulePaths) {
        for (const candidate of candidates) {
            const score = getPathMatchScore(path, candidate);

            maxScore = Math.max(maxScore, score);
        }
    }

    return maxScore;
};

/**
 * Finds the best module match using scoring algorithm
 */
const findBestModuleMatch = (server: ViteDevServer, normalizedCandidates: ReadonlyArray<string>): ModuleMatch | null => {
    let bestMatch: ModuleMatch | null = null;

    for (const [id, module] of server.moduleGraph.idToModuleMap) {
        if (!module)
            continue;

        const modulePaths = getModulePaths(module, id);
        const score = calculateMatchScore(modulePaths, normalizedCandidates);

        if (score > 0 && (!bestMatch || score > bestMatch.score)) {
            bestMatch = { module, score } as const;
        }
    }

    return bestMatch;
};

/**
 * Finds a module in the Vite module graph by trying various lookup strategies.
 * Uses scoring to determine the best match when multiple candidates exist.
 * @param server The Vite dev server instance
 * @param candidates Array of candidate module IDs to search for
 * @returns The best matching module or null if none found
 */
const findModuleForPath = (server: ViteDevServer, candidates: string[]): ModuleNode | null => {

    // Pre-normalize all candidates for performance
    const normalizedCandidates = candidates.map((c) => c.replaceAll("\\", "/"));

    // First try direct module lookup
    for (const id of candidates) {
        try {
            const byId = server.moduleGraph.getModuleById(id);

            if (byId)
                return byId;

            const byUrl = (server.moduleGraph as any).getModuleByUrl?.(id);

            if (byUrl && Object.keys(byUrl).length > 0)
                return byUrl;
        } catch {
            // Ignore lookup errors, continue to next candidate
        }
    }

    // Fallback: iterate through all modules with scoring
    const bestMatch = findBestModuleMatch(server, normalizedCandidates);

    return bestMatch?.module || null;
};

export default findModuleForPath;
