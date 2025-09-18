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
    const prioritizedCandidates = [...candidates, ...candidates.map((c) => c.replace(/^\/@fs\//, "")), ...candidates.map((c) => c.replace(/^[./]*/, ""))];

    let bestModule: ModuleNode | undefined;
    let bestModuleScore = 0;

    for (const id of prioritizedCandidates) {
        try {
            const module = server.moduleGraph.getModuleById(id);

            if (module) {
                const isValidModule = Object.keys(module).length > 0;
                const hasTransformResult = !!module.transformResult;
                const score = isValidModule && hasTransformResult ? 2 : isValidModule ? 1 : 0;

                if (isValidModule) {
                    if (score > bestModuleScore) {
                        bestModule = module;
                        bestModuleScore = score;
                    }

                    if (hasTransformResult) {
                        return module;
                    }
                }
            }

            const byUrl = (server.moduleGraph as unknown as { getModuleByUrl?: (id: string) => ModuleNode | undefined }).getModuleByUrl?.(id);

            if (byUrl) {
                const isValidModule = Object.keys(byUrl).length > 0;
                const hasTransformResult = !!byUrl.transformResult;
                const score = isValidModule && hasTransformResult ? 2 : isValidModule ? 1 : 0;

                if (isValidModule) {
                    if (score > bestModuleScore) {
                        bestModule = byUrl;
                        bestModuleScore = score;
                    }

                    if (hasTransformResult) {
                        return byUrl;
                    }
                }
            }
        } catch {
            // Continue to next candidate
        }
    }

    if (bestModule) {
        return bestModule;
    }

    const result = findBestModuleMatch(server, candidates) || undefined;

    return result;
};

export default findModuleForPath;
