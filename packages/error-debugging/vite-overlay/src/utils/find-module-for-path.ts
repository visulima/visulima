import type { ModuleNode, ViteDevServer } from "vite";

/**
 * Finds the best module match by comparing candidate paths against all modules in the module graph.
 * @param server The Vite dev server instance
 * @param candidates Array of candidate file paths to match against
 * @returns The best matching module node or undefined if no match found
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
 * Finds a module in Vite's module graph using various strategies and candidate paths.
 * @param server The Vite dev server instance
 * @param candidates Array of candidate file paths to search for
 * @returns The matching module node or undefined if not found
 */
// eslint-disable-next-line sonarjs/cognitive-complexity
const findModuleForPath = (server: ViteDevServer, candidates: string[]): ModuleNode | undefined => {
    const prioritizedCandidates = [...candidates, ...candidates.map((c) => c.replace(/^\/@fs\//, "")), ...candidates.map((c) => c.replace(/^[./]*/, ""))];

    let bestModule: ModuleNode | undefined;
    let bestModuleScore = 0;

    for (const id of prioritizedCandidates) {
        try {
            // eslint-disable-next-line no-underscore-dangle, @typescript-eslint/naming-convention
            const module_ = server.moduleGraph.getModuleById(id);

            if (module_) {
                const isValidModule = Object.keys(module_).length > 0;
                const hasTransformResult = !!module_.transformResult;

                let score = 0;

                if (isValidModule && hasTransformResult) {
                    score = 2;
                } else if (isValidModule) {
                    score = 1;
                }

                if (isValidModule) {
                    if (score > bestModuleScore) {
                        bestModule = module_;
                        bestModuleScore = score;
                    }

                    if (hasTransformResult) {
                        return module_;
                    }
                }
            }

            const byUrl = (server.moduleGraph as unknown as { getModuleByUrl?: (id: string) => ModuleNode | undefined }).getModuleByUrl?.(id);

            if (byUrl) {
                const isValidModule = Object.keys(byUrl).length > 0;
                const hasTransformResult = !!byUrl.transformResult;

                let score = 0;

                if (isValidModule && hasTransformResult) {
                    score = 2;
                } else if (isValidModule) {
                    score = 1;
                }

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
