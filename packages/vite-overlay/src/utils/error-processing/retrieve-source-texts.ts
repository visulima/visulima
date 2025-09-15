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

    const moduleObject = module_ as Record<string, unknown> | undefined;
    const currentMap = moduleObject?.transformResult as Record<string, unknown> | undefined;

    // Try to get original source from current source map
    if (!originalSourceText && currentMap) {
        originalSourceText = getSourceFromMap(currentMap, filePath);
    }

    // Try to get sources via transform request
    if (!originalSourceText || !compiledSourceText) {
        const transformId = module_?.id || module_?.url || idCandidates[0];

        if (transformId) {
            try {
                const transformed = await server.transformRequest(transformId);

                if (transformed?.map && !originalSourceText) {
                    originalSourceText = getSourceFromMap(transformed.map, filePath);
                }

                if (typeof transformed?.code === "string") {
                    compiledSourceText = transformed.code;
                }
            } catch {
                // Ignore transform errors
            }
        }
    }

    // Fallback to module's transform result
    if (!compiledSourceText && typeof module_?.transformResult?.code === "string") {
        compiledSourceText = module_.transformResult.code;
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
