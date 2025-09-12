import { originalPositionFor, TraceMap } from "@jridgewell/trace-mapping";
import { isHttpUrl } from "./normalize-id-candidates";

/**
 * Resolves the original source location from a compiled location using source maps.
 * Handles both HTTP URLs and local file paths.
 * @param module_ - The Vite module containing transform result
 * @param filePath - The original file path
 * @param fileLine - The line number in the compiled source
 * @param fileColumn - The column number in the compiled source
 * @returns Object with resolved filePath, fileLine, and fileColumn
 */
export const resolveOriginalLocation = (
    module_: any,
    filePath: string,
    fileLine: number,
    fileColumn: number
): { filePath: string; fileLine: number; fileColumn: number } => {
    let resolvedPath = filePath;
    let resolvedLine = fileLine;
    let resolvedColumn = fileColumn;

    try {
        const rawMap = module_?.transformResult?.map;

        if (rawMap) {
            const traced = new TraceMap(rawMap as any);
            const pos = originalPositionFor(traced, { line: fileLine, column: Math.max(0, fileColumn - 1) });

            if (pos.source && pos.line !== undefined && pos.column !== undefined && pos.line >= 0 && pos.column >= 0) {
                resolvedLine = pos.line;
                resolvedColumn = pos.column + 1;

                if (isHttpUrl(filePath)) {
                    try {
                        const u = new URL(filePath);
                        const modulePath = (u.pathname || "").replace(/^\//, "");
                        const sourceDir = modulePath.includes("/") ? modulePath.substring(0, modulePath.lastIndexOf('/')) : "";
                        resolvedPath = `${u.origin}/${sourceDir ? sourceDir + '/' : ''}${pos.source}`;
                    } catch {
                        // Ignore URL parsing errors
                    }
                } else if (typeof pos.source === "string") {
                    resolvedPath = pos.source;
                }
            }
        }
    } catch {
        // Ignore source map resolution errors
    }

    return { filePath: resolvedPath, fileLine: resolvedLine, fileColumn: resolvedColumn };
};
