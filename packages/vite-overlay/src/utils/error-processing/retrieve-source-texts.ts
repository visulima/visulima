import { readFile } from "node:fs/promises";

import type { ViteDevServer } from "vite";

import type { SourceTexts } from "../../types";
import getSourceFromMap from "../get-source-from-map";

/**
 * Retrieves original and compiled source texts from various sources.
 * Attempts multiple strategies to find source code for error context.
 */
const retrieveSourceTexts = async (
    server: ViteDevServer,
    module_: unknown,
    filePath: string,
    idCandidates: ReadonlyArray<string>,
): Promise<SourceTexts> => {
    let originalSourceText: string | undefined;
    let compiledSourceText: string | undefined;

    if (module_ && typeof module_ === "object" && "transformResult" in module_ && module_.transformResult) {
        const cached = module_.transformResult as { code?: string; map?: any };

        if (cached.code && !compiledSourceText) {
            compiledSourceText = cached.code;
        }

        if (cached.map && !originalSourceText) {
            originalSourceText = getSourceFromMap(cached.map, filePath);
        }
    }

    const transformId = (module_ && typeof module_ === "object" && (("id" in module_ && module_.id) || ("url" in module_ && module_.url))) ?
        ((("id" in module_ && module_.id) || ("url" in module_ && module_.url)) as string) :
        idCandidates[0];

    if (transformId && (!originalSourceText || !compiledSourceText)) {
        try {
            const transformed = await server.transformRequest(transformId);

            if (transformed?.code && !compiledSourceText) {
                compiledSourceText = transformed.code;
            }

            if (transformed?.map && !originalSourceText) {
                const map = transformed.map;
                if (typeof map === "object" && map !== null && "mappings" in map && (map as any).mappings !== "") {
                    originalSourceText = getSourceFromMap(map as any, filePath);
                }
            }
        } catch {
            // Transform failed, continue to fallbacks
        }
    }

    if (!originalSourceText && module_ && typeof module_ === "object" && "file" in module_ && module_.file) {
        try {
            originalSourceText = await readFile(module_.file as string, "utf8");
        } catch {
            // Ignore file read errors
        }
    }

    return { compiledSourceText, originalSourceText } as const;
};

export default retrieveSourceTexts;
