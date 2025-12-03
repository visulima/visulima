import { originalPositionFor, TraceMap } from "@jridgewell/trace-mapping";
import type { ViteDevServer } from "vite";

import findErrorInSourceCode from "./find-error-in-source";
import { isHttpUrl } from "./normalize-id-candidates";

// Constants
const COLUMN_OFFSET = 1;

/**
 * Estimates the original line and column when source maps are unavailable or fail
 */
const estimateOriginalPosition = (fileLine: number, fileColumn: number) => {
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

    return { estimatedColumn, estimatedLine };
};

interface ResolvedLocation {
    originalFileColumn: number;
    originalFileLine: number;
    originalFilePath: string;
}

interface ViteModule {
    id?: string | null;
    transformResult?: {
        code?: string;
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
            { column: fileColumn, desc: "original", line: fileLine },
            // Offset column
            { column: Math.max(0, fileColumn - COLUMN_OFFSET), desc: "offset", line: fileLine },
            // Try line above (common in transpiled code)
            { column: fileColumn, desc: "line above", line: fileLine - 1 },
            // Try line below
            { column: fileColumn, desc: "line below", line: fileLine + 1 },
            // Try broader column range (±2 from original)
            ...Array.from({ length: 5 }, (_, index) => {
                return {
                    column: Math.max(0, fileColumn - 2 + index),
                    desc: `col ${fileColumn - 2 + index}`,
                    line: fileLine,
                };
            }),
        ];

        for (const attempt of attempts) {
            const pos = originalPositionFor(traced, {
                column: attempt.column,
                line: attempt.line,
            });

            if (pos.source && pos.line !== undefined && pos.column !== undefined && pos.line > 0 && pos.column >= 0) {
                return {
                    column: pos.column,
                    line: pos.line,
                    source: pos.source,
                };
            }
        }
    } catch (error) {
        console.warn("Source map processing failed:", error);
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
 * Falls back to source code search for error messages when source maps are unreliable.
 * @param server The Vite dev server instance
 * @param module_ The Vite module containing transform result
 * @param filePath The original file path
 * @param fileLine The line number in the compiled source
 * @param fileColumn The column number in the compiled source
 * @param errorMessage Optional error message to search for in source code
 * @param errorIndex Index of this error in a cause chain (0-based)
 * @returns Object with resolved filePath, fileLine, and fileColumn
 */
const resolveOriginalLocation = async (
    server: ViteDevServer,
    module_: ViteModule,
    filePath: string,
    fileLine: number,
    fileColumn: number,
    errorMessage?: string,
    errorIndex: number = 0,
): Promise<ResolvedLocation> => {
    if (errorMessage && module_) {
        try {
            let originalSourceCode = null;

            if (module_.transformResult?.map?.sourcesContent?.[0]) {
                originalSourceCode = module_.transformResult.map.sourcesContent[0];
            } else if (module_.transformResult?.code) {
                originalSourceCode = module_.transformResult.code;
            }

            if (!originalSourceCode && (module_.id || module_.url)) {
                const transformId = module_.id || module_.url;

                if (transformId) {
                    try {
                        const transformed = await server.transformRequest(transformId);

                        if (transformed?.map && "sourcesContent" in transformed.map && transformed.map.sourcesContent?.[0]) {
                            originalSourceCode = transformed.map.sourcesContent[0];
                        } else if (transformed?.code) {
                            originalSourceCode = transformed.code;
                        }
                    } catch (error) {
                        console.warn("Failed to get fresh source for error search:", error);
                    }
                }
            }

            if (!originalSourceCode && filePath) {
                try {
                    const fs = await import("node:fs/promises");

                    let resolvedPath = filePath;

                    if (filePath.includes("://")) {
                        try {
                            const url = new URL(filePath);

                            resolvedPath = url.pathname;
                        } catch {
                            const protocolIndex = filePath.indexOf("://");

                            if (protocolIndex !== -1) {
                                resolvedPath = filePath.slice(protocolIndex + 3);
                            }
                        }
                    }

                    if (!resolvedPath.startsWith("/")) {
                        const serverRoot = server.config.root || process.cwd();

                        resolvedPath = `${serverRoot}/${resolvedPath}`;
                    }

                    originalSourceCode = await fs.readFile(resolvedPath, "utf8");
                } catch (error) {
                    console.warn("Failed to read source file from disk:", error);
                }
            }

            if (originalSourceCode) {
                const searchMessage = errorMessage;

                const foundLocation = findErrorInSourceCode(originalSourceCode, searchMessage, errorIndex);

                if (foundLocation) {
                    return {
                        originalFileColumn: foundLocation.column,
                        originalFileLine: foundLocation.line,
                        originalFilePath: filePath,
                    };
                }
            }
        } catch (error) {
            console.warn("Source code search failed:", error);
        }
    }

    let rawMap = module_?.transformResult?.map;

    if (!rawMap && (module_?.id || module_?.url)) {
        const transformId = module_.id || module_.url;

        if (transformId) {
            try {
                const transformed = await server.transformRequest(transformId);

                if (transformed?.map) {
                    rawMap = transformed.map;
                }
            } catch (error) {
                console.warn("Failed to get fresh source map:", error);
            }
        }
    }

    if (!rawMap) {
        const { estimatedColumn, estimatedLine } = estimateOriginalPosition(fileLine, fileColumn);

        return {
            originalFileColumn: estimatedColumn,
            originalFileLine: estimatedLine,
            originalFilePath: filePath,
        };
    }

    try {
        const position = resolveSourceMapPosition(rawMap, fileLine, fileColumn);

        if (!position) {
            const { estimatedColumn, estimatedLine } = estimateOriginalPosition(fileLine, fileColumn);

            return {
                originalFileColumn: estimatedColumn,
                originalFileLine: estimatedLine,
                originalFilePath: filePath,
            };
        }

        const resolvedPath = resolveSourcePath(filePath, position.source);

        return {
            originalFileColumn: position.column,
            originalFileLine: position.line,
            originalFilePath: resolvedPath,
        };
    } catch (error) {
        console.warn("Source map resolution failed:", error);

        return { originalFileColumn: fileColumn, originalFileLine: fileLine, originalFilePath: filePath };
    }
};

export default resolveOriginalLocation;
