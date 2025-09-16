import { originalPositionFor, TraceMap } from "@jridgewell/trace-mapping";
import type { ViteDevServer } from "vite";

import { isHttpUrl } from "./normalize-id-candidates";

// Constants
const COLUMN_OFFSET = 1;
const MIN_LINE_NUMBER = 0;
const MIN_COLUMN_NUMBER = 0;

// Types
interface ResolvedLocation {
    originalFileColumn: number;
    originalFileLine: number;
    originalFilePath: string;
}

interface ViteModule {
    id?: string | null;
    transformResult?: {
        map?: any;
    } | null;
    url?: string;
}

/**
 * Resolves the original position using source maps
 */
const resolveSourceMapPosition = (rawMap: any, fileLine: number, fileColumn: number) => {
    try {
        const traced = new TraceMap(rawMap);
        const pos = originalPositionFor(traced, {
            column: Math.max(0, fileColumn - COLUMN_OFFSET),
            line: fileLine,
        });

        // Return position if valid
        if (pos.source && pos.line !== undefined && pos.column !== undefined &&
            pos.line >= MIN_LINE_NUMBER && pos.column >= MIN_COLUMN_NUMBER) {
            return {
                column: pos.column + COLUMN_OFFSET,
                line: pos.line,
                source: pos.source,
            };
        }
    } catch {
        // Silently fail if source map processing fails
    }

    return null;
};

/**
 * Resolves the source file path based on the original URL and source name
 */
const resolveSourcePath = (originalPath: string, sourceName: string): string => {
    if (!sourceName) {
        return originalPath;
    }

    if (isHttpUrl(originalPath)) {
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        return resolveHttpSourcePath(originalPath, sourceName);
    }

    return sourceName;
};

/**
 * Resolves source path for HTTP URLs
 */
const resolveHttpSourcePath = (urlString: string, sourceName: string): string => {
    try {
        const url = new URL(urlString);
        const modulePath = (url.pathname || "").replace(/^\//, "");
        const sourceDir = modulePath.includes("/") ? modulePath.slice(0, Math.max(0, modulePath.lastIndexOf("/"))) : "";

        return `${url.origin}/${sourceDir ? `${sourceDir}/` : ""}${sourceName}`;
    } catch (error) {
        console.warn("URL parsing failed for source path resolution:", error);

        return urlString;
    }
};


/**
 * Resolves the original source location from a compiled location using source maps.
 * Uses Vite's built-in source map resolution for consistency with browser behavior.
 * @param server The Vite dev server instance
 * @param module_ The Vite module containing transform result
 * @param filePath The original file path
 * @param fileLine The line number in the compiled source
 * @param fileColumn The column number in the compiled source
 * @returns Object with resolved filePath, fileLine, and fileColumn
 */
const resolveOriginalLocation = async (
    server: ViteDevServer,
    module_: ViteModule,
    filePath: string,
    fileLine: number,
    fileColumn: number,
): Promise<ResolvedLocation> => {
    // Vite optimization: Use cached transform result first (faster)
    let rawMap = module_?.transformResult?.map;

    // Only get fresh source map if cached version is insufficient
    if (!rawMap && (module_?.id || module_?.url)) {
        const transformId = module_.id || module_.url;
        if (transformId) {
            try {
                const transformed = await server.transformRequest(transformId);
                if (transformed?.map) {
                    rawMap = transformed.map;
                }
            } catch {
                // Fall back to cached source map if transformRequest fails
            }
        }
    }

    if (!rawMap) {
        return { originalFileColumn: fileColumn, originalFileLine: fileLine, originalFilePath: filePath };
    }

    try {
        const position = resolveSourceMapPosition(rawMap, fileLine, fileColumn);

        if (!position) {
            return { originalFileColumn: fileColumn, originalFileLine: fileLine, originalFilePath: filePath };
        }

        const resolvedPath = resolveSourcePath(filePath, position.source);

        return {
            originalFileColumn: position.column,
            originalFileLine: position.line,
            originalFilePath: resolvedPath,
        };
    } catch (error) {
        // Log the error for debugging but don't throw
        console.warn("Source map resolution failed:", error);

        return { originalFileColumn: fileColumn, originalFileLine: fileLine, originalFilePath: filePath };
    }
};

export default resolveOriginalLocation;
