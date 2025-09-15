import { formatStacktrace, parseStacktrace } from "@visulima/error";
import type { ViteDevServer } from "vite";

import findModuleForPath from "../find-module-for-path";
import { normalizeIdCandidates } from "../normalize-id-candidates";
import resolveOriginalLocation from "../resolve-original-location";

export const remapStackToOriginal = async (server: ViteDevServer, stack: string, header?: { message?: string; name?: string }): Promise<string> => {

    // Fix malformed React stack traces where "at functionName" and location are not properly separated
    let normalizedStack = stack;

    if (stack.includes("at ") && !stack.includes("\n    at ")) {
        // Fix missing newlines and proper indentation for React stack traces
        normalizedStack = stack
            .replace(/^(Error:.*?)at /, "$1\n    at ")
            .replaceAll(/at ([^<\s]+)\s*(<[^>]+>:\d+:\d+)/g, "\n    at $1 $2")
            .replaceAll(/at ([^<\s]+)\s*(<unknown>:\d+:\d+)/g, "\n    at $1 $2")
            .replaceAll(/at ([^<\s]+)\s*<([^>]+)>:\d+:\d+/g, "\n    at $1 <$2>:\d+:\d+");

        // Handle cases where location info is missing
        normalizedStack = normalizedStack.replaceAll(/at ([^<\s]+)(?=\s*at|$)/g, "\n    at $1 <unknown>:0:0");
    }

    const frames = parseStacktrace({ stack: normalizedStack } as unknown as Error);

    const mapped = await Promise.all(
        frames.map(async (frame, index) => {
            const { file } = frame;
            const line = frame.line ?? 0;
            const column = frame.column ?? 0;

            if (!file || line <= 0 || column <= 0) {
                // For React-specific frames, try to provide better context even if source maps fail
                if ((file === "<unknown>" || file.includes('react-dom') || file.includes('react')) && frame.functionName) {
                    const { functionName } = frame;

                    // React internal functions - provide better descriptions
                    if (functionName.includes("executeDispatch")) {
                        return {
                            ...frame,
                            column: 0,
                            file: "[React] Event Dispatcher",
                            line: 0,
                        };
                    }

                    if (functionName.includes("runWithFiberInDEV") || functionName.includes("runWithFiber")) {
                        return {
                            ...frame,
                            column: 0,
                            file: "[React] Fiber Reconciliation",
                            line: 0,
                        };
                    }

                    if (functionName.includes("processDispatchQueue")) {
                        return {
                            ...frame,
                            column: 0,
                            file: "[React] Event Queue",
                            line: 0,
                        };
                    }

                    if (functionName.includes("dispatchEvent")) {
                        return {
                            ...frame,
                            column: 0,
                            file: "[React] Event System",
                            line: 0,
                        };
                    }

                    if (functionName.includes("batchedUpdates")) {
                        return {
                            ...frame,
                            column: 0,
                            file: "[React] Batch Updates",
                            line: 0,
                        };
                    }

                    // Generic React function - show the function name with React context
                    if (file.includes('react-dom') || file.includes('react')) {
                        return {
                            ...frame,
                            column: 0,
                            file: `[React] ${functionName}`,
                            line: 0,
                        };
                    }

                    // For user functions that couldn't be mapped, try to find source files
                    if (!functionName.includes("$") && !functionName.includes("anonymous")) {
                        // Try to find modules that might contain this function
                        const candidates = normalizeIdCandidates(functionName);
                        const module_ = findModuleForPath(server, candidates);

                        if (module_) {
                            const resolved = resolveOriginalLocation(module_, "", 1, 1);

                            if (resolved.originalFilePath) {
                                return {
                                    ...frame,
                                    column: resolved.originalFileColumn || 1,
                                    file: resolved.originalFilePath,
                                    line: resolved.originalFileLine || 1,
                                };
                            }
                        }
                    }
                }

                return frame;
            }

            try {
                const idCandidates = normalizeIdCandidates(file);
                const module_ = findModuleForPath(server, idCandidates);

                if (!module_) {
                    return frame;
                }

                const resolved = resolveOriginalLocation(module_, file, line, column);

                return { ...frame, column: resolved.fileColumn, file: resolved.filePath, line: resolved.fileLine };
            } catch (error) {
                return frame;
            }
        }),
    );

    return formatStacktrace(mapped, { header });
};
