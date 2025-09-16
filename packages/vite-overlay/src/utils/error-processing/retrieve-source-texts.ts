import { readFile } from "node:fs/promises";

import type { ViteDevServer } from "vite";

import type { SourceTexts } from "../../types";
import { getSourceFromMap } from "../source-map-utils";

/**
 * Retrieves original and compiled source texts from various sources.
 * Attempts multiple strategies to find source code for error context.
 */
export const retrieveSourceTexts = async (
    server: ViteDevServer,
    module_: unknown,
    filePath: string,
    idCandidates: ReadonlyArray<string>,
): Promise<SourceTexts> => {
    let originalSourceText: string | undefined;
    let compiledSourceText: string | undefined;

    // Vite optimization: Check cached transform result first (faster)
    if (module_?.transformResult) {
        const cached = module_.transformResult;
        if (cached.code && !compiledSourceText) {
            compiledSourceText = cached.code;
        }
        if (cached.map && !originalSourceText) {
            originalSourceText = getSourceFromMap(cached.map, filePath);
        }
    }

    // Only call transformRequest if we still need data (slower but fresh)
    const transformId = module_?.id || module_?.url || idCandidates[0];
    if (transformId && (!originalSourceText || !compiledSourceText)) {
        try {
            const transformed = await server.transformRequest(transformId);

            if (transformed?.code && !compiledSourceText) {
                compiledSourceText = transformed.code;
            }

            if (transformed?.map && !originalSourceText) {
                originalSourceText = getSourceFromMap(transformed.map, filePath);
            }
        } catch {
            // Transform failed, continue to fallbacks
        }
    }


    // Fallback to reading original file directly
    if (!originalSourceText && module_?.file) {
        try {
            originalSourceText = await readFile(module_.file, "utf8");
        } catch {
            // Ignore file read errors
        }
    }


    return { compiledSourceText, originalSourceText } as const;
};
