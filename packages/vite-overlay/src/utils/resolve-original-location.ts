import { originalPositionFor, TraceMap } from "@jridgewell/trace-mapping";
import type { ViteDevServer } from "vite";

import { findErrorInSourceCode } from "./find-error-in-source";
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

        let foundMapping = false;

        for (const attempt of attempts) {
            const pos = originalPositionFor(traced, {
                column: attempt.column,
                line: attempt.line,
            });

            if (pos.source && pos.line !== undefined && pos.column !== undefined && pos.line > 0 && pos.column >= 0) {
                foundMapping = true;

                return {
                    column: pos.column,
                    line: pos.line,
                    source: pos.source,
                };
            }
        }

        // Only log if we found a mapping (interesting case)
        if (foundMapping) {
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
    // First, try to find the error by searching in the original source code
    // This is often more reliable than source maps for runtime errors
    if (errorMessage && module_) {
        console.log(`🔍 Source code search: Looking for error "${errorMessage}" in module`, {
            errorIndex,
            hasTransformResult: !!module_.transformResult,
            moduleId: module_.id,
            moduleKeys: Object.keys(module_),
            moduleType: typeof module_,
            moduleUrl: module_.url,
            transformResultKeys: module_.transformResult ? Object.keys(module_.transformResult) : [],
        });

        try {
            // Get the original source code from the module
            let originalSourceCode = null;

            // Try to get source from transform result first
            if (module_.transformResult?.map?.sourcesContent?.[0]) {
                originalSourceCode = module_.transformResult.map.sourcesContent[0];
                console.log(`📄 Found source code from transform result (${originalSourceCode.length} chars)`);
            } else if (module_.transformResult?.code) {
                // For some modules, the source might be in the transform result code
                originalSourceCode = module_.transformResult.code;
                console.log(`📄 Found source code from transform result code (${originalSourceCode.length} chars)`);
            } else {
                console.log(`❌ No source code in transform result`, {
                    hasMap: !!module_.transformResult?.map,
                    hasTransformResult: !!module_.transformResult,
                    hasCode: !!module_.transformResult?.code,
                    sourcesContentLength: module_.transformResult?.map?.sourcesContent?.length,
                    moduleKeys: Object.keys(module_),
                    transformResultKeys: module_.transformResult ? Object.keys(module_.transformResult) : [],
                });
            }

            // If not available, try to get fresh transform result
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

            // As a last resort, try to read the source file directly from disk
            if (!originalSourceCode && filePath) {
                try {
                    const fs = await import('node:fs/promises');

                    // Resolve the file path properly - if it starts with a protocol, extract the path part
                    let resolvedPath = filePath;
                    if (filePath.includes('://')) {
                        try {
                            const url = new URL(filePath);
                            resolvedPath = url.pathname;
                        } catch {
                            // If URL parsing fails, remove protocol part manually
                            const protocolIndex = filePath.indexOf('://');
                            if (protocolIndex !== -1) {
                                resolvedPath = filePath.slice(protocolIndex + 3);
                            }
                        }
                    }

                    // If the path doesn't start with '/', it's relative to the server root
                    if (!resolvedPath.startsWith('/')) {
                        const serverRoot = server.config.root || process.cwd();
                        console.log(`🔧 Server root: ${serverRoot}, original filePath: ${filePath}`);
                        resolvedPath = `${serverRoot}/${resolvedPath}`;
                        console.log(`🔧 Resolved full path: ${resolvedPath}`);
                    }

                    console.log(`📂 Trying to read source file from: ${resolvedPath}`);
                    originalSourceCode = await fs.readFile(resolvedPath, 'utf-8');
                    console.log(`📄 Found source code from file system (${originalSourceCode.length} chars)`);
                } catch (error) {
                    console.warn("Failed to read source file from disk:", error);
                }
            }

            // Search for the error message in the source code
            if (originalSourceCode) {
                console.log(`🔍 Source code search: Looking for error "${errorMessage}" in module`, {
                    errorIndex,
                    hasTransformResult: !!module_.transformResult,
                    moduleId: module_.id,
                    moduleKeys: Object.keys(module_),
                    moduleType: typeof module_,
                    moduleUrl: module_.url,
                    transformResultKeys: module_.transformResult ? Object.keys(module_.transformResult) : [],
                });

                // For import resolution errors, findErrorInSourceCode will handle the pattern matching
                // It will detect the error type and search for the import statement instead of the error message
                const searchMessage = errorMessage;

                const foundLocation = findErrorInSourceCode(originalSourceCode, searchMessage, errorIndex);

                if (foundLocation) {
                    console.log(`🎯 Source code search SUCCESS: Found error at line ${foundLocation.line}, column ${foundLocation.column}`);
                    console.log(`📄 Source code snippet:`, originalSourceCode.split('\n').slice(foundLocation.line - 2, foundLocation.line + 2).join('\n'));

                    return {
                        originalFileColumn: foundLocation.column,
                        originalFileLine: foundLocation.line,
                        originalFilePath: filePath,
                    };
                } else {
                    console.log(`❌ Source code search FAILED: Could not find error pattern in source code`);
                    console.log(`🔍 Searched for: "${errorMessage.includes('Failed to resolve import') ? 'import statement' : 'error message'}"`);
                    console.log(`📄 First few lines of source code:`, originalSourceCode.split('\n').slice(0, 10).join('\n'));
                }

                console.log(`❌ Source code search FAILED: Could not find error "${errorMessage}" in source`);
            }
        } catch (error) {
            console.warn("Source code search failed:", error);
        }
    } else {
        console.log(`⚠️ Source code search SKIPPED: No error message or module provided`, {
            hasErrorMessage: !!errorMessage,
            hasModule: !!module_,
        });
    }

    // Fallback to source map resolution
    console.log(`🗺️ Falling back to source map resolution`);
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
            } catch (error) {
                console.warn("Failed to get fresh source map:", error);
                // Fall back to cached source map if transformRequest fails
            }
        }
    }

    if (!rawMap) {
        // Apply estimation when no source map is available
        const { estimatedColumn, estimatedLine } = estimateOriginalPosition(fileLine, fileColumn);

        return {
            originalFileColumn: estimatedColumn,
            originalFileLine: estimatedLine,
            originalFilePath: filePath,
        };
    }

    try {
        // Source map available for resolution

        const position = resolveSourceMapPosition(rawMap, fileLine, fileColumn);

        // Source map resolution completed

        if (!position) {
            // Fallback to estimation when source map resolution fails
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
        // Log the error for debugging but don't throw
        console.warn("Source map resolution failed:", error);

        return { originalFileColumn: fileColumn, originalFileLine: fileLine, originalFilePath: filePath };
    }
};

export default resolveOriginalLocation;
