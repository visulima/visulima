import type { ModuleNode, ViteDevServer } from "vite";

/**
 * Finds the best module match by iterating through all modules.
 * Only used as fallback when direct lookup fails.
 */
const findBestModuleMatch = (server: ViteDevServer, candidates: ReadonlyArray<string>): ModuleNode | undefined => {
    for (const [id, module] of server.moduleGraph.idToModuleMap) {
        if (!module) {
            continue;
        }

        const moduleObject = module as unknown as Record<string, unknown>;
        const modulePaths = [
            String(moduleObject.file || "").replaceAll("\\", "/"),
            String(id || "").replaceAll("\\", "/"),
            String(moduleObject.url || "").replaceAll("\\", "/"),
        ];

        // Check for exact or partial matches
        for (const candidate of candidates) {
            if (modulePaths.some((path) => path === candidate || path.includes(candidate) || candidate.includes(path))) {
                return module;
            }
        }
    }

    return undefined;
};

/**
 * Finds a module in the Vite module graph by trying various lookup strategies.
 * Prioritizes direct lookups for performance, falls back to iteration if needed.
 * @param server The Vite dev server instance
 * @param candidates Array of candidate module IDs to search for
 * @returns The best matching module or undefined if none found
 */
const findModuleForPath = (server: ViteDevServer, candidates: string[]): ModuleNode | undefined => {
    // Vite optimization: Try the most likely candidates first
    const prioritizedCandidates = [
        ...candidates,
        ...candidates.map((c) => c.replace(/^\/@fs\//, "")), // Remove @fs prefix
        ...candidates.map((c) => c.replace(/^[./]*/, "")), // Remove leading ./ or /
    ];

    // Vite's module graph is optimized for direct ID lookup
    for (const id of prioritizedCandidates) {
        try {
            // Try exact ID match first (fastest)
            const module = server.moduleGraph.getModuleById(id);
            if (module) {
                return module;
            }

            // Try URL lookup for HTTP-style imports
            const byUrl = (server.moduleGraph as unknown as { getModuleByUrl?: (id: string) => ModuleNode | undefined }).getModuleByUrl?.(id);

            if (byUrl) {
                return byUrl;
            }
        } catch {
            // Continue to next candidate
        }
    }

    // Only fall back to expensive iteration if direct lookup fails
    return findBestModuleMatch(server, candidates) || undefined;
};

export default findModuleForPath;
