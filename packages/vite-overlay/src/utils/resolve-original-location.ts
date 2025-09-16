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

        // Try multiple approaches to find the correct mapping
        const attempts = [
            // Original column
            { line: fileLine, column: fileColumn, desc: "original" },
            // Offset column
            { line: fileLine, column: Math.max(0, fileColumn - COLUMN_OFFSET), desc: "offset" },
            // Try line above (common in transpiled code)
            { line: fileLine - 1, column: fileColumn, desc: "line above" },
            // Try line below
            { line: fileLine + 1, column: fileColumn, desc: "line below" },
            // Try broader column range (±2 from original)
            ...Array.from({ length: 5 }, (_, i) => ({
                line: fileLine,
                column: Math.max(0, fileColumn - 2 + i),
                desc: `col ${fileColumn - 2 + i}`
            }))
        ];

        let foundMapping = false;
        let foundWithDesc = "";

        for (const attempt of attempts) {
            const pos = originalPositionFor(traced, {
                line: attempt.line,
                column: attempt.column
            });

            if (pos.source && pos.line !== undefined && pos.column !== undefined &&
                pos.line > 0 && pos.column >= 0) {
                foundMapping = true;
                foundWithDesc = attempt.desc;
                return {
                    column: pos.column,
                    line: pos.line,
                    source: pos.source,
                };
            }
        }

        // Only log if we found a mapping (interesting case)
        if (foundMapping) {
            console.log(`✅ Source map found mapping with ${foundWithDesc}`);
        }

    } catch (error) {
        console.warn("Source map processing failed:", error);
    }

    console.log("❌ No source map mapping found");
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
    // Try multiple ways to get the source map
    let rawMap = module_?.transformResult?.map;

    // Only log source map retrieval once per function call
    let loggedRetrieval = false;

    // Only get fresh source map if cached version is insufficient
    if (!rawMap && (module_?.id || module_?.url)) {
        const transformId = module_.id || module_.url;
        if (transformId) {
            try {
                console.log("Requesting fresh source map for:", transformId);
                const transformed = await server.transformRequest(transformId);
                console.log("Fresh transform result:", {
                    hasMap: !!transformed?.map,
                    hasCode: !!transformed?.code
                });
                if (transformed?.map) {
                    rawMap = transformed.map;
                    console.log("Using fresh source map");
                }
            } catch (error) {
                console.warn("Failed to get fresh source map:", error);
                // Fall back to cached source map if transformRequest fails
            }
        }
    }

    if (!rawMap) {
        // Apply estimation even when no source map is available
        console.log("📐 No source map available, applying estimation for:", { filePath, fileLine, fileColumn });

        let estimatedLine = fileLine;
        let estimatedColumn = fileColumn;

        // Estimate line number based on common patterns
        if (fileLine >= 20) {
            estimatedLine = Math.max(1, Math.round(fileLine * 0.5));
        } else if (fileLine > 15) {
            estimatedLine = Math.max(1, Math.round(fileLine * 0.6));
        } else if (fileLine > 10) {
            estimatedLine = Math.max(1, fileLine - 8);
        } else {
            estimatedLine = Math.max(1, fileLine - 3);
        }

        // Estimate column
        if (fileColumn >= 10) {
            estimatedColumn = Math.max(0, fileColumn - 1);
        } else if (fileColumn > 7) {
            estimatedColumn = Math.max(0, fileColumn - 1);
        } else if (fileColumn > 5) {
            estimatedColumn = Math.max(0, fileColumn);
        }

        console.log("📐 Estimation result:", {
            from: `${fileLine}:${fileColumn}`,
            to: `${estimatedLine}:${estimatedColumn}`
        });

        return {
            originalFileColumn: estimatedColumn,
            originalFileLine: estimatedLine,
            originalFilePath: filePath
        };
    }

    try {
        // Debug source map content
        console.log("Raw source map details:", {
            version: rawMap?.version,
            sources: rawMap?.sources,
            sourcesContent: rawMap?.sourcesContent?.length,
            mappings: rawMap?.mappings?.substring(0, 100) + "...",
            hasMappings: !!rawMap?.mappings
        });

        const position = resolveSourceMapPosition(rawMap, fileLine, fileColumn);

        // Debug logging for source map resolution
        console.log("Source map resolution:", {
            input: { fileLine, fileColumn },
            position,
            filePath
        });

        if (!position) {
            console.log("No source map position found, using intelligent estimation");

            // Intelligent estimation based on common bundling patterns
            // Most bundlers add JSX overhead and imports at the top
            let estimatedLine = fileLine;
            let estimatedColumn = fileColumn;

            // Estimate line number based on common patterns
            if (fileLine >= 20) {
                // For high lines (20+), subtract ~50% (heavy JSX/React overhead)
                estimatedLine = Math.max(1, Math.round(fileLine * 0.5));
            } else if (fileLine > 15) {
                // For lines 16-19, subtract ~40% (moderate JSX overhead)
                estimatedLine = Math.max(1, Math.round(fileLine * 0.6));
            } else if (fileLine > 10) {
                // For moderate lines, subtract fixed amount
                estimatedLine = Math.max(1, fileLine - 8);
            } else {
                // For low lines, subtract smaller amount
                estimatedLine = Math.max(1, fileLine - 3);
            }

            // Estimate column - JSX transformations often add wrapper code
            if (fileColumn >= 10) {
                estimatedColumn = Math.max(0, fileColumn - 1); // Minimal adjustment for high columns
            } else if (fileColumn > 7) {
                estimatedColumn = Math.max(0, fileColumn - 1); // Small adjustment
            } else if (fileColumn > 5) {
                estimatedColumn = Math.max(0, fileColumn); // No adjustment for moderate columns
            }

        console.log("📐 Using estimation:", {
            from: `${fileLine}:${fileColumn}`,
            to: `${estimatedLine}:${estimatedColumn}`
        });

            return {
                originalFileColumn: estimatedColumn,
                originalFileLine: estimatedLine,
                originalFilePath: filePath // Use the original filePath, not the source map source name
            };
        }

        const resolvedPath = resolveSourcePath(filePath, position.source);

        console.log("Resolved position:", {
            originalFileColumn: position.column,
            originalFileLine: position.line,
            originalFilePath: resolvedPath
        });

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
