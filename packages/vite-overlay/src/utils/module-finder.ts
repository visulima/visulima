import type { ViteDevServer } from "vite";

// Constants for module matching scoring
const EXACT_MATCH_SCORE = 100;
const CONTAINS_MATCH_SCORE = 50;

// Types
interface ModuleMatch {
    module: any;
    score: number;
}

/**
 * Finds a module in the Vite module graph by trying various lookup strategies.
 * Uses scoring to determine the best match when multiple candidates exist.
 * @param server The Vite dev server instance
 * @param candidates Array of candidate module IDs to search for
 * @returns The best matching module or null if none found
 */
export const findModuleForPath = (server: ViteDevServer, candidates: string[]): any => {
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

/**
 * Finds the best module match using scoring algorithm
 */
const findBestModuleMatch = (server: ViteDevServer, normalizedCandidates: string[]): ModuleMatch | null => {
    let bestMatch: ModuleMatch | null = null;

    for (const [id, module] of server.moduleGraph.idToModuleMap) {
        if (!module)
            continue;

        const modulePaths = getModulePaths(module, id);
        const score = calculateMatchScore(modulePaths, normalizedCandidates);

        if (score > 0 && (!bestMatch || score > bestMatch.score)) {
            bestMatch = { module, score };
        }
    }

    return bestMatch;
};

/**
 * Extracts relevant paths from a module for matching
 */
const getModulePaths = (module: any, id: string): string[] => {
    const file = String(module.file || "").replaceAll("\\", "/");
    const idString = String(id || "").replaceAll("\\", "/");
    const url = String((module as any).url || "").replaceAll("\\", "/");

    return [file, idString, url];
};

/**
 * Calculates the match score for module paths against candidates
 */
const calculateMatchScore = (modulePaths: string[], candidates: string[]): number => {
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
