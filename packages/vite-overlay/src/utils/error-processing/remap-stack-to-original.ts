import { formatStacktrace, parseStacktrace } from "@visulima/error";
import type { ViteDevServer } from "vite";

import findModuleForPath from "../find-module-for-path";
import { normalizeIdCandidates } from "../normalize-id-candidates";
import resolveOriginalLocation from "../resolve-original-location";

const remapStackToOriginal = async (server: ViteDevServer, stack: string, header?: { message?: string; name?: string }): Promise<string> => {
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

    // Early return if stack trace looks well-formed and doesn't need remapping
    if (!normalizedStack.includes("<unknown>") && !normalizedStack.includes("react-dom") && !normalizedStack.includes("react")) {
        return normalizedStack;
    }

    const frames = parseStacktrace({ stack: normalizedStack } as unknown as Error);

    const mapped = await Promise.all(
        frames.map(async (frame) => {
            const { file } = frame;
            const line = frame.line ?? 0;
            const column = frame.column ?? 0;

            // Early return for well-formed frames that don't need remapping
            if (file && file !== "<unknown>" && line > 0 && column > 0 && !file.includes("react-dom") && !file.includes("react")) {
                return frame;
            }

            if (!file || line <= 0 || column <= 0) {
                // For React-specific frames, try to provide better context
                if ((file === "<unknown>" || (file && (file.includes("react-dom") || file.includes("react")))) && frame.methodName) {
                    const { methodName: functionName } = frame;

                    // React internal functions - provide better descriptions
                    const reactMappings = {
                        batchedUpdates: "Batch Updates",
                        dispatchEvent: "Event System",
                        executeDispatch: "Event Dispatcher",
                        processDispatchQueue: "Event Queue",
                        runWithFiber: "Fiber Reconciliation",
                    } as const;

                    for (const [key, description] of Object.entries(reactMappings)) {
                        if (functionName.includes(key)) {
                            return { ...frame, column: 0, file: `[React] ${description}`, line: 0 };
                        }
                    }

                    // For user functions, try to find source files (only if not anonymous)
                    if (!functionName.includes("$") && !functionName.includes("anonymous")) {
                        const candidates = normalizeIdCandidates(functionName);
                        const module_ = findModuleForPath(server, candidates);

                        if (module_) {
                            const resolved = await resolveOriginalLocation(server, module_, "", 1, 1);

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

                const resolved = await resolveOriginalLocation(server, module_, file, line, column);

                return { ...frame, column: resolved.originalFileColumn, file: resolved.originalFilePath, line: resolved.originalFileLine };
            } catch {
                return frame;
            }
        }),
    );

    return formatStacktrace(mapped, { header });
};

export default remapStackToOriginal;
