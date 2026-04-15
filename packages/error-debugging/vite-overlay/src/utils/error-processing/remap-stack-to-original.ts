import type { Trace } from "@visulima/error";
import { formatStacktrace, parseStacktrace } from "@visulima/error";
import type { ViteDevServer } from "vite";

import findModuleForPath from "../find-module-for-path";
import { normalizeIdCandidates } from "../normalize-id-candidates";
import resolveOriginalLocation from "../resolve-original-location";

const ERROR_PREFIX_RE = /^(Error:.*?)at /;
const AT_TAGGED_FRAME_RE = /at ([^<\s]+)\s*(<[^>]+>:\d+:\d+)/g;
const AT_UNKNOWN_FRAME_RE = /at ([^<\s]+)\s*(<unknown>:\d+:\d+)/g;
const AT_ANGLE_FRAME_RE = /at ([^<\s]+)\s*<([^>]+)>:\d+:\d+/g;
const AT_BARE_FRAME_RE = /at ([^<\s]+)(?=\s*at|$)/g;

/**
 * Remaps a stack trace from compiled locations to original source locations using source maps.
 * Handles React-specific stack frames and module resolution for better debugging experience.
 * @param server The Vite dev server instance
 * @param stack The stack trace string to remap
 * @param header Optional header information for the formatted stack trace
 * @param header.message Optional message for the formatted stack trace header
 * @param header.name Optional name for the formatted stack trace header
 * @returns Promise resolving to the remapped stack trace
 */
const remapStackToOriginal = async (server: ViteDevServer, stack: string, header?: { message?: string; name?: string }): Promise<string> => {
    let normalizedStack = stack;

    if (stack.includes("at ") && !stack.includes("\n    at ")) {
        normalizedStack = stack
            .replace(ERROR_PREFIX_RE, "$1\n    at ")
            .replaceAll(AT_TAGGED_FRAME_RE, "\n    at $1 $2")
            .replaceAll(AT_UNKNOWN_FRAME_RE, "\n    at $1 $2")
            .replaceAll(AT_ANGLE_FRAME_RE, "\n    at $1 <$2>:0:0");

        normalizedStack = normalizedStack.replaceAll(AT_BARE_FRAME_RE, "\n    at $1 <unknown>:0:0");
    }

    if (!normalizedStack.includes("<unknown>") && !normalizedStack.includes("react-dom") && !normalizedStack.includes("react")) {
        return normalizedStack;
    }

    const frames = parseStacktrace({ stack: normalizedStack } as unknown as Error) as unknown as {
        column?: number;
        file?: string;
        line?: number;
        methodName?: string;
    }[];

    const mapped = await Promise.all(
        // eslint-disable-next-line sonarjs/cognitive-complexity
        frames.map(async (frame: { column?: number; file?: string; line?: number; methodName?: string }) => {
            const { file } = frame;
            const frameLine = frame.line ?? 0;
            const frameColumn = frame.column ?? 0;

            if (file && file !== "<unknown>" && frameLine > 0 && frameColumn > 0 && !file.includes("react-dom") && !file.includes("react")) {
                return frame;
            }

            if (!file || frameLine <= 0 || frameColumn <= 0) {
                if ((file === "<unknown>" || (file && (file.includes("react-dom") || file.includes("react")))) && frame.methodName) {
                    const { methodName: functionName } = frame;

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

                    if (!functionName.includes("$") && !functionName.includes("anonymous")) {
                        const candidates = normalizeIdCandidates(functionName);
                        const foundModule = findModuleForPath(server, candidates);

                        if (foundModule) {
                            const resolved = await resolveOriginalLocation(server, foundModule, "", 1, 1);

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
                const foundModule = findModuleForPath(server, idCandidates);

                if (!foundModule) {
                    return frame;
                }

                const resolved = await resolveOriginalLocation(server, foundModule, file, frameLine, frameColumn);

                return { ...frame, column: resolved.originalFileColumn, file: resolved.originalFilePath, line: resolved.originalFileLine };
            } catch {
                return frame;
            }
        }),
    );

    return formatStacktrace(mapped as unknown as Trace[], { header });
};

/**
 * Default export for remapping stack traces to original source locations.
 * @see remapStackToOriginal
 */
export default remapStackToOriginal;
