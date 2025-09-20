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
    // Searching for candidates

    // Vite optimization: Try the most likely candidates first
    const prioritizedCandidates = [
        ...candidates,
        ...candidates.map((c) => c.replace(/^\/@fs\//, "")), // Remove @fs prefix
        ...candidates.map((c) => c.replace(/^[./]*/, "")), // Remove leading ./ or /
    ];

    // Prioritized candidates

    let bestModule: ModuleNode | undefined;
    let bestModuleScore = 0; // 0 = no module, 1 = has module, 2 = has transform result

    // Vite's module graph is optimized for direct ID lookup
    for (const id of prioritizedCandidates) {
        try {
            // Trying candidate

            // Try exact ID match first (fastest)
            const module = server.moduleGraph.getModuleById(id);

            if (module) {
                // Check if this is a valid module (has some properties)
                const isValidModule = Object.keys(module).length > 0;
                const hasTransformResult = !!module.transformResult;
                const score = isValidModule && hasTransformResult ? 2 : isValidModule ? 1 : 0;

                // Found module by ID

                // Only consider valid modules
                if (isValidModule) {
                    // Prioritize modules with transform result
                    if (score > bestModuleScore) {
                        bestModule = module;
                        bestModuleScore = score;
                    }

                    // If we found a perfect match (has transform result), return immediately
                    if (hasTransformResult) {
                        return module;
                    }
                }
            }

            // Try URL lookup for HTTP-style imports
            const byUrl = (server.moduleGraph as unknown as { getModuleByUrl?: (id: string) => ModuleNode | undefined }).getModuleByUrl?.(id);

            if (byUrl) {
                // Check if this is a valid module (has some properties)
                const isValidModule = Object.keys(byUrl).length > 0;
                const hasTransformResult = !!byUrl.transformResult;
                const score = isValidModule && hasTransformResult ? 2 : isValidModule ? 1 : 0;

                // Found module by URL

                // Only consider valid modules
                if (isValidModule) {
                    // Prioritize modules with transform result
                    if (score > bestModuleScore) {
                        bestModule = byUrl;
                        bestModuleScore = score;
                    }

                    // If we found a perfect match (has transform result), return immediately
                    if (hasTransformResult) {
                        return byUrl;
                    }
                }
            }

            // Candidate not found
        } catch {
            // Continue to next candidate
        }
    }

    // If we found any module (even without transform result), use it
    if (bestModule) {
        return bestModule;
    }

    // Only fall back to expensive iteration if direct lookup fails
    const result = findBestModuleMatch(server, candidates) || undefined;

    return result;
};

export default findModuleForPath;
