import { readFile } from "node:fs/promises";
import { codeFrame, parseStacktrace, formatStacktrace } from "@visulima/error";
import aiPrompt from "@visulima/error/solution/ai/prompt";
import getHighlighter, { transformerCompactLineOptions } from "../../../../shared/utils/get-highlighter";
import findLanguageBasedOnExtension from "../../../../shared/utils/find-language-based-on-extension";
import type { ViteDevServer } from "vite";

import { normalizeIdCandidates } from "./normalize-id-candidates";
import { findModuleForPath } from "./module-finder";
import { resolveOriginalLocation } from "./source-map-resolver";
import { realignOriginalPosition } from "./position-aligner";
import { getSourceFromMap } from "./source-map-utils";
import { cleanErrorStack, detectPluginFromStack, normalizeLF, isAggregateError, extractErrors, cleanErrorMessage, isESBuildErrorArray, processESBuildErrors } from "./stack-trace-utils";

/**
 * Builds comprehensive error data including source maps, code frames, and AI prompts.
 * This function processes runtime errors and extracts all information needed for
 * the error overlay UI, including original source locations and syntax-highlighted code.
 * Handles both single errors and AggregateError (multiple errors).
 * @param error - The error object to process (can be AggregateError with multiple errors)
 * @param server - The Vite dev server instance for module resolution
 * @returns Promise resolving to extended error data object
 */
export const buildExtendedErrorData = async (
    error: Error,
    server: ViteDevServer
): Promise<{
    snippet: string;
    codeFrameContent?: string;
    originalSnippet: string;
    compiledSnippet: string;
    originalCodeFrameContent?: string;
    compiledCodeFrameContent?: string;
    fixPrompt: string;
    filePath: string;
    fileLine: number;
    fileColumn: number;
    compiledFilePath: string;
    compiledLine: number;
    compiledColumn: number;
    trace: any;
    plugin?: string;
    isAggregateError?: boolean;
    isESBuildArray?: boolean;
    errorCount?: number;
    compiledStack?: string;
    originalStack?: string;
}> => {
    const remapStackToOriginal = async (stack: string, header?: { name?: string; message?: string }): Promise<string> => {
        const frames = parseStacktrace({ stack } as unknown as Error);
        const mapped = await Promise.all(frames.map(async (frame) => {
            const file = frame.file;
            const line = frame.line ?? 0;
            const column = frame.column ?? 0;

            if (!file || line <= 0 || column <= 0) {
                return frame;
            }

            try {
                const idCandidates = normalizeIdCandidates(file);
                const mod = findModuleForPath(server, idCandidates);
                if (!mod) {
                    return frame;
                }
                const resolved = resolveOriginalLocation(mod, file, line, column);
                return { ...frame, file: resolved.filePath, line: resolved.fileLine, column: resolved.fileColumn };
            } catch {
                return frame;
            }
        }));

        return formatStacktrace(mapped, { header });
    };

    // Handle AggregateError and ESBuild error arrays
    const isAggregate = isAggregateError(error);
    const isESBuildArray = !isAggregate && Array.isArray(error) && isESBuildErrorArray(error as any[]);

    let individualErrors: Error[];
    let processedESBuildErrors: any[] = [];

    if (isESBuildArray) {
        // Handle ESBuild error arrays
        processedESBuildErrors = processESBuildErrors(error as any[]);
        individualErrors = processedESBuildErrors.map(err => ({
            name: 'Error',
            message: err.message,
            stack: '',
            ...err
        } as Error));
    } else {
        // Handle AggregateError or single error
        individualErrors = extractErrors(error);
    }

    // Use the first error for primary processing, but track if there are multiple
    const primaryError = individualErrors[0] || error;

    // Clean ANSI characters from error message and stack trace
    const cleanMessage = cleanErrorMessage(primaryError);
    const rawStack = primaryError.stack || '';
    const normalizedStack = normalizeLF(rawStack);
    const cleanedStack = cleanErrorStack(normalizedStack);
    const originalStack = await remapStackToOriginal(cleanedStack, { name: primaryError.name, message: cleanMessage });

    // Create a synthetic error with cleaned data for parsing
    const syntheticError = new Error(cleanMessage);
    syntheticError.name = primaryError.name;
    syntheticError.stack = cleanedStack;

    const traces = parseStacktrace(syntheticError, { frameLimit: 5 });
    const trace = traces?.[0] as any;

    // Detect plugin from stack trace
    const plugin = detectPluginFromStack(cleanedStack);

    // Extract location information from stack trace
    const compiledFilePath = trace?.file ?? "";
    const compiledLine = trace?.line ?? 0;
    const compiledColumn = trace?.column ?? 0;

    // Initialize original location (will be resolved from source maps)
    let filePath = compiledFilePath;
    let fileLine = compiledLine;
    let fileColumn = compiledColumn;

    // Resolve original source location using source maps
    if (filePath) {
        const idCandidates = normalizeIdCandidates(filePath);
        const module_ = findModuleForPath(server, idCandidates);

        if (module_) {
            const resolved = resolveOriginalLocation(module_, filePath, fileLine, fileColumn);
            
            filePath = resolved.filePath;
            fileLine = resolved.fileLine;
            fileColumn = resolved.fileColumn;
        }
    }

    // Retrieve source code for generating code frames
    let originalSnippet = "";
    let compiledSnippet = "";

    try {
        const idCandidates = normalizeIdCandidates(filePath);
        const module_ = findModuleForPath(server, idCandidates);

        if (!module_) {
            return createFallbackErrorData(compiledFilePath, compiledLine, compiledColumn, trace);
        }

        // Retrieve source texts from various sources
        const { originalSourceText, compiledSourceText } = await retrieveSourceTexts(
            server, module_, filePath, idCandidates
        );

        // Generate code frames if source texts are available
        if (originalSourceText) {
            // Apply heuristic realignment if position seems incorrect
            if (compiledSourceText && fileLine <= 0 && compiledLine > 0) {
                const realigned = realignOriginalPosition(compiledSourceText, compiledLine, compiledColumn, originalSourceText);
                if (realigned) {
                    fileLine = realigned.line;
                    fileColumn = realigned.column;
                }
            }

            originalSnippet = codeFrame(originalSourceText, {
                start: { line: fileLine, column: fileColumn }
            }, {
                showGutter: false,
            });
        }

        if (compiledSourceText && compiledLine > 0 && compiledColumn > 0) {
            compiledSnippet = codeFrame(compiledSourceText, {
                start: { line: compiledLine, column: compiledColumn }
            }, {
                showGutter: false,
            });
        }
    } catch {
        // Ignore source retrieval errors, continue with available data
    }

    // Backward compatibility: single snippet fallback
    const snippet = originalSnippet || compiledSnippet || "";

    // Generate syntax-highlighted code frames for client-side rendering
    let originalCodeFrameContent: string | undefined;
    let compiledCodeFrameContent: string | undefined;

    if (originalSnippet || compiledSnippet) {
        const highlighter = await getHighlighter();
        const hlLangOriginal = findLanguageBasedOnExtension(filePath) || "text";
        const hlLangCompiled = findLanguageBasedOnExtension(compiledFilePath) || hlLangOriginal;

        const highlightOptions = {
            themes: { light: "github-light", dark: "github-dark-default" }
        };

        if (originalSnippet) {
            originalCodeFrameContent = highlighter.codeToHtml(originalSnippet, {
                ...highlightOptions,
                lang: hlLangOriginal,
                transformers: [
                    transformerCompactLineOptions([
                        { line: fileLine, classes: ["error-line"] },
                    ]),
                ],
            });
        }

        if (compiledSnippet) {
            compiledCodeFrameContent = highlighter.codeToHtml(compiledSnippet, {
                ...highlightOptions,
                lang: hlLangCompiled,
                transformers: [
                    transformerCompactLineOptions([
                        { line: compiledLine, classes: ["error-line"] },
                    ]),
                ],
            });
        }
    }

    // Use original highlighting as primary, fallback to compiled
    const codeFrameContent = originalCodeFrameContent || compiledCodeFrameContent;

    const fixPrompt = aiPrompt({
        applicationType: undefined,
        error,
        file: {
            file: filePath,
            line: fileLine,
            language: findLanguageBasedOnExtension(filePath),
            snippet,
        },
    });

    return {
        snippet,
        codeFrameContent,
        originalSnippet,
        compiledSnippet,
        originalCodeFrameContent,
        compiledCodeFrameContent,
        fixPrompt,
        filePath,
        fileLine,
        fileColumn,
        compiledFilePath,
        compiledLine,
        compiledColumn,
        trace,
        plugin,
        isAggregateError: isAggregate || isESBuildArray,
        isESBuildArray,
        errorCount: individualErrors.length,
        compiledStack: formatStacktrace(parseStacktrace(syntheticError), { header: { name: primaryError.name, message: cleanMessage } }),
        originalStack
    };
};

/**
 * Retrieves original and compiled source texts from various sources.
 */
const retrieveSourceTexts = async (
    server: ViteDevServer,
    module_: any,
    filePath: string,
    idCandidates: string[]
): Promise<{ originalSourceText?: string; compiledSourceText?: string }> => {
    let originalSourceText: string | undefined;
    let compiledSourceText: string | undefined;

    const currentMap = module_?.transformResult?.map;

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

    return { originalSourceText, compiledSourceText };
}

/**
 * Creates fallback error data when module resolution fails.
 */
const createFallbackErrorData = (
    filePath: string,
    line: number,
    column: number,
    trace: any
) => {
    return {
        snippet: "",
        codeFrameContent: undefined,
        originalSnippet: "",
        compiledSnippet: "",
        originalCodeFrameContent: undefined,
        compiledCodeFrameContent: undefined,
        fixPrompt: "",
        filePath,
        fileLine: line,
        fileColumn: column,
        compiledFilePath: filePath,
        compiledLine: line,
        compiledColumn: column,
        trace
    };
}
