import type { ViteDevServer } from 'vite';

/**
 * Finds a module in the Vite module graph by trying various lookup strategies.
 * Uses scoring to determine the best match when multiple candidates exist.
 * @param server - The Vite dev server instance
 * @param candidates - Array of candidate module IDs to search for
 * @returns The best matching module or null if none found
 */
export const findModuleForPath = (server: ViteDevServer, candidates: string[]): any => {
    // Pre-normalize all candidates for performance
    const normalizedCandidates = candidates.map(c => c.replace(/\\/g, "/"));

    // First try direct module lookup
    for (const id of candidates) {
        try {
            const byId = server.moduleGraph.getModuleById(id);
            if (byId) return byId;

            const byUrl = (server.moduleGraph as any).getModuleByUrl?.(id);
            if (byUrl && Object.keys(byUrl).length > 0) return byUrl;
        } catch {
            // Ignore lookup errors, continue to next candidate
        }
    }

    // Fallback: iterate through all modules with scoring
    let bestMatch = null;
    let bestScore = 0;

    for (const [id, m] of server.moduleGraph.idToModuleMap) {
        if (!m) continue;

        const file = String(m.file || "").replace(/\\/g, "/");
        const idStr = String(id || "").replace(/\\/g, "/");
        const url = String((m as any).url || "").replace(/\\/g, "/");

        // Find best candidate match with scoring
        for (const cNorm of normalizedCandidates) {
            let score = 0;

            // Exact match gets highest score
            if (idStr === cNorm || file === cNorm || url === cNorm) {
                score = 100;
            }
            // Contains match gets medium score
            else if (idStr.includes(cNorm) || file.includes(cNorm) || url.includes(cNorm)) {
                score = 50;
            }
            // Partial match gets lower score
            else if (cNorm.includes(idStr) || cNorm.includes(file) || cNorm.includes(url)) {
                score = 25;
            }

            if (score > bestScore) {
                bestMatch = m;
                bestScore = score;
            }
        }
    }

    return bestMatch;
};
