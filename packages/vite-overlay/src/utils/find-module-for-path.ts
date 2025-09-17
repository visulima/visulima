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
    console.log(`🔍 findModuleForPath: Searching for candidates:`, candidates);

    // Vite optimization: Try the most likely candidates first
    const prioritizedCandidates = [
        ...candidates,
        ...candidates.map((c) => c.replace(/^\/@fs\//, "")), // Remove @fs prefix
        ...candidates.map((c) => c.replace(/^[./]*/, "")), // Remove leading ./ or /
    ];

    console.log(`🔍 findModuleForPath: Prioritized candidates:`, prioritizedCandidates);

    let bestModule: ModuleNode | undefined;
    let bestModuleScore = 0; // 0 = no module, 1 = has module, 2 = has transform result

    // Vite's module graph is optimized for direct ID lookup
    for (const id of prioritizedCandidates) {
        try {
            console.log(`🔍 findModuleForPath: Trying candidate "${id}"`);

            // Try exact ID match first (fastest)
            let module = server.moduleGraph.getModuleById(id);

            if (module) {
                const hasTransformResult = !!module.transformResult;
                const score = hasTransformResult ? 2 : 1;

                console.log(`✅ findModuleForPath: Found module by ID "${id}":`, {
                    hasId: !!module.id,
                    hasTransformResult,
                    hasUrl: !!module.url,
                    keys: Object.keys(module),
                    score,
                });

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

            // Try URL lookup for HTTP-style imports
            const byUrl = (server.moduleGraph as unknown as { getModuleByUrl?: (id: string) => ModuleNode | undefined }).getModuleByUrl?.(id);

            if (byUrl) {
                // Check if this is a valid module (has some properties)
                const isValidModule = Object.keys(byUrl).length > 0;
                const hasTransformResult = !!byUrl.transformResult;
                const score = (isValidModule && hasTransformResult) ? 2 : (isValidModule ? 1 : 0);

                console.log(`✅ findModuleForPath: Found module by URL "${id}":`, {
                    hasId: !!byUrl.id,
                    hasTransformResult,
                    hasUrl: !!byUrl.url,
                    keys: Object.keys(byUrl),
                    isValid: isValidModule,
                    score,
                });

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
                } else {
                    console.log(`⚠️ findModuleForPath: Module by URL "${id}" is invalid (empty object), continuing...`);
                }
            }

            console.log(`❌ findModuleForPath: Candidate "${id}" not found`);
        } catch (error) {
            console.log(`⚠️ findModuleForPath: Error trying candidate "${id}":`, error);
            // Continue to next candidate
        }
    }

    // If we found any module (even without transform result), use it
    if (bestModule) {
        console.log(`🔄 findModuleForPath: Using best available module (score: ${bestModuleScore})`);
        return bestModule;
    }

    console.log(`🔍 findModuleForPath: Direct lookup failed, trying expensive iteration...`);
    // Only fall back to expensive iteration if direct lookup fails
    const result = findBestModuleMatch(server, candidates) || undefined;

    console.log(`🔍 findModuleForPath: Expensive iteration result:`, !!result);

    return result;
};

export default findModuleForPath;
