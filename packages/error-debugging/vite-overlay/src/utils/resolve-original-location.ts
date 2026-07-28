/* eslint-disable sonarjs/different-types-comparison, @typescript-eslint/no-unnecessary-condition, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/prefer-nullish-coalescing, @typescript-eslint/restrict-template-expressions */
// eslint-disable-next-line import/no-extraneous-dependencies
import { originalPositionFor, TraceMap } from "@jridgewell/trace-mapping";
import type { ViteDevServer } from "vite";

import findErrorInSourceCode from "./find-error-in-source-code";
import { isHttpUrl } from "./normalize-id-candidates";

// Constants
const COLUMN_OFFSET = 1;
const LEADING_SLASH_RE = /^\//;

/**
 * Estimates the original line and column when source maps are unavailable or fail.
 */
const estimateOriginalPosition = (fileLine: number, fileColumn: number): { estimatedColumn: number; estimatedLine: number } => {
    // Handle edge cases: ensure line is at least 1
    const validLine = Math.max(1, fileLine);
    const validColumn = Math.max(0, fileColumn);

    let estimatedLine: number;
    let estimatedColumn: number;

    // Estimate line number based on common patterns
    if (validLine >= 20) {
        estimatedLine = Math.max(1, Math.round(validLine * 0.5));
    } else if (validLine > 15) {
        estimatedLine = Math.max(1, Math.round(validLine * 0.6));
    } else if (validLine > 10) {
        estimatedLine = Math.max(1, validLine - 8);
    } else {
        estimatedLine = Math.max(1, validLine - 3);
    }

    // Estimate column
    if (validColumn >= 10) {
        estimatedColumn = Math.max(0, validColumn - 1);
    } else if (validColumn > 7) {
        estimatedColumn = Math.max(0, validColumn - 1);
    } else if (validColumn > 5) {
        estimatedColumn = Math.max(0, validColumn);
    } else {
        estimatedColumn = validColumn;
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        map?: any;
    } | null;
    url?: string;
}

/**
 * Resolves the original position using source maps.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const resolveSourceMapPosition = (rawMap: any, fileLine: number, fileColumn: number) => {
    try {
        const traced = new TraceMap(rawMap);

        // Validate input: line must be > 0 for source map lookups
        if (fileLine <= 0) {
            return undefined;
        }

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
        ].filter((attempt) => attempt.line > 0); // Filter out invalid line numbers

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
        // eslint-disable-next-line no-console
        console.warn("Source map processing failed:", error);
    }

    return undefined;
};

/**
 * Resolves the source file path based on the original URL and source name.
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
 * Resolves source path for HTTP URLs.
 */
const resolveHttpSourcePath = (urlString: string, sourceName: string): string => {
    try {
        const url = new URL(urlString);
        const modulePath = (url.pathname || "").replace(LEADING_SLASH_RE, "");
        const sourceDirectory = modulePath.includes("/") ? modulePath.slice(0, Math.max(0, modulePath.lastIndexOf("/"))) : "";

        return `${url.origin}/${sourceDirectory ? `${sourceDirectory}/` : ""}${sourceName}`;
    } catch (error) {
        // eslint-disable-next-line no-console
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
 * @param filePath
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
    // eslint-disable-next-line sonarjs/cognitive-complexity
): Promise<ResolvedLocation> => {
    if (errorMessage && module_) {
        try {
            let originalSourceCode: string | null | undefined;

            if (module_.transformResult?.map?.sourcesContent?.[0]) {
                [originalSourceCode] = module_.transformResult.map.sourcesContent;
            } else if (module_.transformResult?.code) {
                originalSourceCode = module_.transformResult.code;
            }

            if (!originalSourceCode && (module_.id || module_.url)) {
                const transformId = module_.id || module_.url;

                if (transformId) {
                    try {
                        const transformed = await server.transformRequest(transformId);

                        if (transformed?.map && "sourcesContent" in transformed.map && transformed.map.sourcesContent?.[0]) {
                            [originalSourceCode] = transformed.map.sourcesContent as (string | null)[];
                        } else if (transformed?.code) {
                            originalSourceCode = transformed.code;
                        }
                    } catch (error) {
                        // eslint-disable-next-line no-console
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
                    // eslint-disable-next-line no-console
                    console.warn("Failed to read source file from disk:", error);
                }
            }

            if (originalSourceCode) {
                const foundLocation = findErrorInSourceCode(originalSourceCode, errorMessage, errorIndex);

                if (foundLocation) {
                    return {
                        originalFileColumn: foundLocation.column,
                        originalFileLine: foundLocation.line,
                        originalFilePath: filePath,
                    };
                }
            }
        } catch (error) {
            // eslint-disable-next-line no-console
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
                // eslint-disable-next-line no-console
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
        // eslint-disable-next-line no-console
        console.warn("Source map resolution failed:", error);

        return { originalFileColumn: fileColumn, originalFileLine: fileLine, originalFilePath: filePath };
    }
};

export default resolveOriginalLocation;

export { estimateOriginalPosition };
