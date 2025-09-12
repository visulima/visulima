import { readFile } from "node:fs/promises";

import { codeFrame, formatStacktrace, parseStacktrace } from "@visulima/error";
import aiPrompt from "@visulima/error/solution/ai/prompt";
import type { ViteDevServer } from "vite";

import findLanguageBasedOnExtension from "../../../../shared/utils/find-language-based-on-extension";
import getHighlighter, { transformerCompactLineOptions } from "../../../../shared/utils/get-highlighter";
import { findModuleForPath } from "./module-finder";
import { normalizeIdCandidates } from "./normalize-id-candidates";
import { realignOriginalPosition } from "./position-aligner";
import { resolveOriginalLocation } from "./source-map-resolver";
import { getSourceFromMap } from "./source-map-utils";
import {
    cleanErrorMessage,
    cleanErrorStack,
    detectPluginFromStack,
    extractErrors,
    isAggregateError,
    isESBuildErrorArray,
    normalizeLF,
    processESBuildErrors,
} from "./stack-trace-utils";

/**
 * Builds comprehensive error data including source maps, code frames, and AI prompts.
 * This function processes runtime errors and extracts all information needed for
 * the error overlay UI, including original source locations and syntax-highlighted code.
 * Handles both single errors and AggregateError (multiple errors).
 * @param error The error object to process (can be AggregateError with multiple errors)
 * @param server The Vite dev server instance for module resolution
 * @returns Promise resolving to extended error data object
 */
export const buildExtendedErrorData = async (
    error: Error,
    server: ViteDevServer,
): Promise<{
    codeFrameContent?: string;
    compiledCodeFrameContent?: string;
    compiledColumn: number;
    compiledFilePath: string;
    compiledLine: number;
    compiledSnippet: string;
    compiledStack?: string;
    errorCount?: number;
    fileColumn: number;
    fileLine: number;
    filePath: string;
    fixPrompt: string;
    isAggregateError?: boolean;
    isESBuildArray?: boolean;
    originalCodeFrameContent?: string;
    originalSnippet: string;
    originalStack?: string;
    plugin?: string;
    snippet: string;
    trace: any;
}> => {
    const remapStackToOriginal = async (stack: string, header?: { message?: string; name?: string }): Promise<string> => {
        const frames = parseStacktrace({ stack } as unknown as Error);
        const mapped = await Promise.all(
            frames.map(async (frame) => {
                const { file } = frame;
                const line = frame.line ?? 0;
                const column = frame.column ?? 0;

                if (!file || line <= 0 || column <= 0) {
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
                } catch {
                    return frame;
                }
            }),
        );

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
        individualErrors = processedESBuildErrors.map(
            (error_) =>
                ({
                    message: error_.message,
                    name: "Error",
                    stack: "",
                    ...error_,
                }) as Error,
        );
    } else {
        // Handle AggregateError or single error
        individualErrors = extractErrors(error);
    }

    // Use the first error for primary processing, but track if there are multiple
    const primaryError = individualErrors[0] || error;

    // Clean ANSI characters from error message and stack trace
    const cleanMessage = cleanErrorMessage(primaryError);
    const rawStack = primaryError.stack || "";
    const normalizedStack = normalizeLF(rawStack);
    const cleanedStack = cleanErrorStack(normalizedStack);
    const originalStack = await remapStackToOriginal(cleanedStack, { message: cleanMessage, name: primaryError.name });

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
        const { compiledSourceText, originalSourceText } = await retrieveSourceTexts(server, module_, filePath, idCandidates);

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

            originalSnippet = codeFrame(
                originalSourceText,
                {
                    start: { column: fileColumn, line: fileLine },
                },
                {
                    showGutter: false,
                },
            );
        }

        if (compiledSourceText && compiledLine > 0 && compiledColumn > 0) {
            compiledSnippet = codeFrame(
                compiledSourceText,
                {
                    start: { column: compiledColumn, line: compiledLine },
                },
                {
                    showGutter: false,
                },
            );
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
            themes: { dark: "github-dark-default", light: "github-light" },
        };

        if (originalSnippet) {
            originalCodeFrameContent = highlighter.codeToHtml(originalSnippet, {
                ...highlightOptions,
                lang: hlLangOriginal,
                transformers: [transformerCompactLineOptions([{ classes: ["error-line"], line: fileLine }])],
            });
        }

        if (compiledSnippet) {
            compiledCodeFrameContent = highlighter.codeToHtml(compiledSnippet, {
                ...highlightOptions,
                lang: hlLangCompiled,
                transformers: [transformerCompactLineOptions([{ classes: ["error-line"], line: compiledLine }])],
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
            language: findLanguageBasedOnExtension(filePath),
            line: fileLine,
            snippet,
        },
    });

    return {
        codeFrameContent,
        compiledCodeFrameContent,
        compiledColumn,
        compiledFilePath,
        compiledLine,
        compiledSnippet,
        compiledStack: formatStacktrace(parseStacktrace(syntheticError), { header: { message: cleanMessage, name: primaryError.name } }),
        errorCount: individualErrors.length,
        fileColumn,
        fileLine,
        filePath,
        fixPrompt,
        isAggregateError: isAggregate || isESBuildArray,
        isESBuildArray,
        originalCodeFrameContent,
        originalSnippet,
        originalStack,
        plugin,
        snippet,
        trace,
    };
};

/**
 * Retrieves original and compiled source texts from various sources.
 */
const retrieveSourceTexts = async (
    server: ViteDevServer,
    module_: any,
    filePath: string,
    idCandidates: string[],
): Promise<{ compiledSourceText?: string; originalSourceText?: string }> => {
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

    return { compiledSourceText, originalSourceText };
};

/**
 * Creates fallback error data when module resolution fails.
 */
const createFallbackErrorData = (filePath: string, line: number, column: number, trace: any) => {
    return {
        codeFrameContent: undefined,
        compiledCodeFrameContent: undefined,
        compiledColumn: column,
        compiledFilePath: filePath,
        compiledLine: line,
        compiledSnippet: "",
        fileColumn: column,
        fileLine: line,
        filePath,
        fixPrompt: "",
        originalCodeFrameContent: undefined,
        originalSnippet: "",
        snippet: "",
        trace,
    };
};
