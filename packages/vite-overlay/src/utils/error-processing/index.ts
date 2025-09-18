import { codeFrame, formatStacktrace, parseStacktrace } from "@visulima/error";
import aiPrompt from "@visulima/error/solution/ai/prompt";
import type { LanguageInput } from "shiki";
import type { ViteDevServer } from "vite";

import findLanguageBasedOnExtension from "../../../../../shared/utils/find-language-based-on-extension";
import getHighlighter, { transformerCompactLineOptions } from "../../../../../shared/utils/get-highlighter";
import type { ErrorProcessingResult, ViteErrorData } from "../../types";
import findModuleForPath from "../find-module-for-path";
import { normalizeIdCandidates } from "../normalize-id-candidates";
import { realignOriginalPosition } from "../position-aligner";
import resolveOriginalLocation from "../resolve-original-location";
import type { ESBuildMessage } from "../stack-trace-utils";
import { cleanErrorMessage, cleanErrorStack, extractErrors, isESBuildErrorArray, processESBuildErrors } from "../stack-trace-utils";
import { parseVueCompilationError } from "./parse-vue-compilation-error";
import remapStackToOriginal from "./remap-stack-to-original";
import { retrieveSourceTexts } from "./retrieve-source-texts";

/**
 * Extracts individual errors from different error types
 */
const extractIndividualErrors = (error: Error): Error[] => {
    // Handle ESBuild error arrays
    if (Array.isArray(error) && isESBuildErrorArray(error as unknown[])) {
        const processedErrors = processESBuildErrors(error as ESBuildMessage[]);

        return processedErrors.map(
            ({ message, name, stack }) =>
                ({
                    message: message || "ESBuild error",
                    name: name || "Error",
                    stack: stack || "",
                }) as Error,
        );
    }

    return extractErrors(error);
};

/**
 * Extracts location information from error stack trace
 */
const extractLocationFromStack = (error: Error) => {
    const traces = parseStacktrace(error, { frameLimit: 10 });

    // First, try to find an HTTP URL in any frame (preferring the first frame if it's HTTP)
    const httpTrace = traces?.find((trace) => trace?.file?.startsWith("http"));
    const trace = httpTrace || traces?.[0];

    // If we found an HTTP trace, use it; otherwise, we'll convert the local path later
    return {
        compiledColumn: trace?.column ?? 0,
        compiledFilePath: trace?.file ?? "",
        compiledLine: trace?.line ?? 0,
    };
};

/**
 * Extracts the query parameter from an HTTP URL
 */
export const extractQueryFromHttpUrl = (url: string): string => {
    try {
        const urlObject = new URL(url);

        return urlObject.search;
    } catch {
        return "";
    }
};

/**
 * Adds query parameter to a base URL if it doesn't already have it
 */
export const addQueryToUrl = (baseUrl: string, query: string): string => {
    if (!query || baseUrl.includes("?")) {
        return baseUrl;
    }

    return baseUrl + query;
};

/**
 * Resolves original source location using source maps and source code search
 */
const resolveOriginalLocationInfo = async (
    server: ViteDevServer,
    sourceFilePath: string,
    compiledFileColumn: number,
    compiledFileLine: number,
    vueErrorInfo?: { column: number; line: number; originalFilePath: string } | null,
    errorMessage?: string,
    errorIndex: number = 0,
    compiledFilePath?: string,
) => {
    // Use Vue error info if available, otherwise use provided values
    const filePath = vueErrorInfo?.originalFilePath || sourceFilePath;
    const fileLine = vueErrorInfo?.line ?? compiledFileLine;
    const fileColumn = vueErrorInfo?.column ?? compiledFileColumn;

    // Resolve using source maps if we have a valid file path
    if (filePath) {
        // Convert HTTP URLs to local paths for module resolution
        let resolvedFilePath = filePath;
        let resolvedOriginalFilePath = filePath;

        if (filePath.startsWith("http://") || filePath.startsWith("https://")) {
            try {
                const url = new URL(filePath);

                resolvedFilePath = url.pathname;

                if (resolvedFilePath.startsWith("/")) {
                    resolvedFilePath = resolvedFilePath.slice(1);
                }

                // For source retrieval, try to construct the full local path
                // This assumes the Vite root is the project root
                const serverRoot = server.config.root || process.cwd();

                resolvedOriginalFilePath = resolvedFilePath.startsWith("/") ? resolvedFilePath : `${serverRoot}/${resolvedFilePath}`;
            } catch {
                console.warn("Failed to parse HTTP URL:", filePath);
            }
        }

        const idCandidates = normalizeIdCandidates(resolvedFilePath);

        // Module resolution
        const module_ = findModuleForPath(server, idCandidates);

        // Module found

        if (module_) {
            try {
                // For source map resolution, use the source file path if available, otherwise fallback to compiled path
                const mapFilePath = sourceFilePath || compiledFilePath || resolvedFilePath;
                const resolved = await resolveOriginalLocation(server, module_, mapFilePath, fileLine, fileColumn, errorMessage, errorIndex);
                // Use the resolved local path if available, otherwise use source map result
                const finalFilePath = resolvedOriginalFilePath || resolved.originalFilePath;

                return {
                    originalFileColumn: resolved.originalFileColumn,
                    originalFileLine: resolved.originalFileLine,
                    originalFilePath: finalFilePath,
                };
            } catch {
                console.warn("⚠️ Source map resolution failed, using estimation");
                // Fall back to estimation if resolution fails
            }
        }

        // Apply estimation for all cases where source map resolution fails

        // Intelligent estimation based on common bundling patterns
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

        return {
            originalFileColumn: estimatedColumn,
            originalFileLine: estimatedLine,
            originalFilePath: resolvedOriginalFilePath || filePath, // Use resolved local path for source retrieval
        };
    }

    return { originalFileColumn: fileColumn, originalFileLine: fileLine, originalFilePath: filePath };
};

/**
 * Creates empty result when no modules are found
 */
const createEmptyResult = (
    compiledColumn: number,
    compiledFilePath: string,
    compiledLine: number,
    originalFileColumn: number,
    originalFileLine: number,
    originalFilePath: string,
): ErrorProcessingResult => {
    return {
        compiledCodeFrameContent: undefined,
        compiledColumn,
        compiledFilePath,
        compiledLine,
        compiledSnippet: "",
        fixPrompt: "",
        originalCodeFrameContent: undefined,
        originalCodeFrameContentAnsi: undefined,
        originalFileColumn,
        originalFileLine,
        originalFilePath,
        originalSnippet: "",
    };
};

/**
 * Generates syntax-highlighted code frames for client-side rendering
 */
const generateSyntaxHighlightedFrames = async (
    originalSnippet: string,
    compiledSnippet: string,
    originalFilePath: string,
    compiledFilePath: string,
    originalFileLine: number,
    compiledLine: number,
) => {
    let originalCodeFrameContent: string | undefined;
    let originalCodeFrameContentAnsi: string | undefined;
    let compiledCodeFrameContent: string | undefined;

    // Always process both snippets individually, even if one is empty

    const hlLangOriginal = findLanguageBasedOnExtension(originalFilePath) || "text";
    const hlLangCompiled = findLanguageBasedOnExtension(compiledFilePath) || hlLangOriginal;

    // Load required language support
    const langs: LanguageInput[] = [];
    const requiredLangs = new Set([hlLangCompiled, hlLangOriginal]);

    if (requiredLangs.has("svelte")) {
        langs.push(import("@shikijs/langs/svelte"));
    }

    if (requiredLangs.has("vue")) {
        langs.push(import("@shikijs/langs/vue"));
    }

    const highlighter = await getHighlighter(langs);
    const highlightOptions = {
        themes: { dark: "github-dark-default", light: "github-light" },
    };

    if (originalSnippet && originalSnippet.trim()) {
        originalCodeFrameContentAnsi = originalSnippet;

        try {
            originalCodeFrameContent = highlighter.codeToHtml(originalSnippet, {
                ...highlightOptions,
                lang: hlLangOriginal,
                transformers: [transformerCompactLineOptions([{ classes: ["error-line"], line: originalFileLine }])],
            });
        } catch {
            // Silently fail if highlighting fails
        }
    }

    if (compiledSnippet && compiledSnippet.trim()) {
        try {
            compiledCodeFrameContent = highlighter.codeToHtml(compiledSnippet, {
                ...highlightOptions,
                lang: hlLangCompiled,
                transformers: [transformerCompactLineOptions([{ classes: ["error-line"], line: compiledLine }])],
            });
        } catch {
            // Silently fail if highlighting fails
        }
    }

    return { compiledCodeFrameContent, originalCodeFrameContent };
};

/**
 * Builds comprehensive error data including source maps, code frames, and AI prompts.
 * This function processes runtime errors and extracts all information needed for
 * the error overlay UI, including original source locations and syntax-highlighted code.
 * Handles both single errors and AggregateError (multiple errors).
 * @param error The error object to process (can be AggregateError with multiple errors)
 * @param server The Vite dev server instance for module resolution
 * @returns Promise resolving to extended error data object
 */
const buildExtendedErrorData = async (
    error: Error | { message: string; name?: string; stack?: string },
    server: ViteDevServer,
    viteErrorData?: ViteErrorData,
    allErrors?: (Error | { message: string; name?: string; stack?: string })[],
    errorIndex: number = 0,
): Promise<ErrorProcessingResult> => {
    // Extract Vue error info and individual errors
    const vueErrorInfo = error?.message ? parseVueCompilationError(error.message) : undefined;
    const individualErrors = extractIndividualErrors(error);
    const primaryError = individualErrors[0] || error;

    // Extract query parameter from cause error if it exists (for consistency)
    let causeQuery = "";

    if (allErrors && allErrors.length > 1) {
        for (const error_ of allErrors.slice(1)) {
            const causeStack = error_.stack || "";
            const causeTraces = parseStacktrace({ stack: causeStack } as Error, { frameLimit: 10 });
            const causeHttpTrace = causeTraces?.find((trace) => trace?.file?.startsWith("http"));

            if (causeHttpTrace?.file) {
                causeQuery = extractQueryFromHttpUrl(causeHttpTrace.file);

                if (causeQuery)
                    break;
            }
        }
    }

    // Clean and process error data
    const cleanMessage = cleanErrorMessage(primaryError);
    const cleanedStack = cleanErrorStack(primaryError.stack || "");
    const originalStack = await remapStackToOriginal(server, cleanedStack, { message: cleanMessage, name: primaryError.name });

    // Extract and resolve location information
    // For cause errors, prioritize viteErrorData location over stack extraction
    let compiledColumn: number;
    let compiledFilePath: string;
    let compiledLine: number;

    if (viteErrorData?.file && viteErrorData?.line && viteErrorData?.column) {
        // Use location from viteErrorData (for cause errors)
        compiledColumn = viteErrorData.column;
        compiledFilePath = viteErrorData.file;
        compiledLine = viteErrorData.line;
    } else {
        // Extract from stack trace (for primary errors)
        const extracted = extractLocationFromStack(primaryError);

        compiledColumn = extracted.compiledColumn;
        compiledFilePath = extracted.compiledFilePath;
        compiledLine = extracted.compiledLine;

        // Convert local file path to HTTP URL format for consistency with cause errors
        if (compiledFilePath && !compiledFilePath.startsWith("http")) {
            // Extract relative path from project root for Vite
            const projectRoot = server.config.root;
            const originalLocalPath = compiledFilePath;
            let relativePath = compiledFilePath;

            // Remove project root from the absolute path to get relative path
            if (compiledFilePath.startsWith(projectRoot)) {
                relativePath = compiledFilePath.slice(projectRoot.length);
            }

            // Ensure it starts with / for HTTP URL
            if (!relativePath.startsWith("/")) {
                relativePath = `/${relativePath}`;
            }

            let httpUrl = `http://localhost:5173${relativePath}`;

            // Add query parameter from cause error if found (for module consistency)
            if (causeQuery) {
                httpUrl = addQueryToUrl(httpUrl, causeQuery);
            }

            compiledFilePath = httpUrl;
        }
    }

    // Extract original source file path for better source code search
    // Prioritize viteErrorData.file (from our WebSocket interception) over stack trace
    let sourceFilePath = viteErrorData?.file || compiledFilePath;

    if (!viteErrorData?.file && primaryError.stack) {
        const traces = parseStacktrace(primaryError, { frameLimit: 10 });
        // Find the first local source file (not node_modules, not .vite, not HTTP)
        const sourceTrace = traces?.find(
            (trace) =>
                trace?.file
                && !trace.file.startsWith("http")
                && !trace.file.includes("node_modules")
                && !trace.file.includes(".vite")
                && trace.file.includes(".tsx"), // Focus on TypeScript/React files
        );

        if (sourceTrace?.file) {
            sourceFilePath = sourceTrace.file;
            // Using source file path from stack trace
        }
    }

    if (viteErrorData?.file) {
        // Using source file path from viteErrorData
    }

    let { originalFileColumn, originalFileLine, originalFilePath } = await resolveOriginalLocationInfo(
        server,
        sourceFilePath, // Use source file path for source code search
        compiledColumn,
        compiledLine,
        vueErrorInfo,
        primaryError.message,
        errorIndex, // Use the provided error index for cause chain handling
        compiledFilePath, // Pass compiled file path for source map resolution
    );

    // Extract plugin information
    const plugin = viteErrorData?.plugin;

    // Retrieve source code for generating code frames
    let originalSnippet = "";
    let compiledSnippet = "";
    let originalSourceText: string | undefined;
    let compiledSourceText: string | undefined;

    try {
        // Vite optimization: Parallel module resolution for better performance
        const [compiledModule, originalModule] = await Promise.all([
            findModuleForPath(server, normalizeIdCandidates(compiledFilePath)),
            findModuleForPath(server, normalizeIdCandidates(originalFilePath)),
        ]);

        if (!compiledModule && !originalModule) {
            return createEmptyResult(compiledColumn, compiledFilePath, compiledLine, originalFileColumn, originalFileLine, originalFilePath);
        }

        // Convert file paths for source retrieval
        const compiledFilePathForRetrieval = compiledFilePath.startsWith("http")
            ? compiledFilePath.replace(/^https?:\/\/[^/]+/, "").replace(/^\//, "")
            : compiledFilePath;

        const originalFilePathForRetrieval = originalFilePath.startsWith("http")
            ? originalFilePath.replace(/^https?:\/\/[^/]+/, "").replace(/^\//, "")
            : originalFilePath;

        // Get compiled source from the appropriate module's transform result
        const moduleForCompiledSource = compiledModule || originalModule;

        if (moduleForCompiledSource?.transformResult?.code) {
            compiledSourceText = moduleForCompiledSource.transformResult.code;
        }

        // Get original source from original module
        if (originalModule?.transformResult?.map && !originalSourceText) {
            const sourceMap = originalModule.transformResult.map;

            // Try to get original source from source map
            try {
                const originalContent = (sourceMap as any).sourcesContent?.[0];

                if (originalContent) {
                    originalSourceText = originalContent;
                }
            } catch (error) {
                console.warn("Failed to get original source from source map:", error);
            }
        }

        // Fallback: Parallel source retrieval for any missing sources
        const [compiledSourceResult, originalSourceResult] = await Promise.all([
            !compiledSourceText && compiledModule
                ? retrieveSourceTexts(server, compiledModule, compiledFilePathForRetrieval, normalizeIdCandidates(compiledFilePathForRetrieval))
                : Promise.resolve({ compiledSourceText: undefined, originalSourceText: undefined }),
            !originalSourceText && originalModule
                ? retrieveSourceTexts(server, originalModule, originalFilePathForRetrieval, normalizeIdCandidates(originalFilePathForRetrieval))
                : Promise.resolve({ compiledSourceText: undefined, originalSourceText: undefined }),
        ]);

        // Use retrieved sources if we didn't get them from transform results
        if (!compiledSourceText && compiledSourceResult.compiledSourceText) {
            ({ compiledSourceText } = compiledSourceResult);
        }

        if (!originalSourceText && originalSourceResult.originalSourceText) {
            ({ originalSourceText } = originalSourceResult);
        }

        // Generate original code frame (Vite optimization: skip realignment for cached modules)
        if (originalSourceText) {
            // Generating original code frame

            // Only realign if we got fresh compiled source (not from cache)
            if (compiledSourceText && originalFileLine <= 0 && compiledLine > 0) {
                const realigned = realignOriginalPosition(compiledSourceText, compiledLine, compiledColumn, originalSourceText);

                if (realigned) {
                    originalFileLine = realigned.line;
                    originalFileColumn = realigned.column;
                }
            }

            try {
                originalSnippet = codeFrame(
                    originalSourceText,
                    { start: { column: Math.max(1, originalFileColumn), line: Math.max(1, originalFileLine) } },
                    { showGutter: false },
                );
                // Generated original code frame
            } catch {
                // Failed to generate original code frame
                // Silently fail if codeFrame throws, but keep original source for fallback
                originalSnippet = originalSourceText?.slice(0, 500) || "";
            }
        }

        // Smart compiled code frame generation
        // Show compiled frame only when it contains the correct error code at the found location
        const shouldGenerateCompiledFrame = compiledSourceText && compiledLine > 0;
        const sourceSearchWasSuccessful = originalFileLine > 0 && originalFileColumn > 0;
        const sourceLineCount = originalSourceText?.split("\n").length || 0;

        // Verify that the COMPILED frame contains error code at the found line and column
        let compiledFrameHasCorrectCode = false;

        if (shouldGenerateCompiledFrame && compiledLine > 0 && primaryError.message) {
            const compiledLines = compiledSourceText.split("\n");
            const targetCompiledLine = compiledLines[compiledLine - 1]; // Convert to 0-based

            if (targetCompiledLine && compiledColumn <= targetCompiledLine.length) {
                // Check if the compiled frame contains error patterns at the found location
                const errorMessage = primaryError.message;
                const columnIndex = Math.max(0, compiledColumn - 1); // Convert to 0-based, ensure non-negative
                const textAtLocation = new Set(targetCompiledLine.slice(Math.max(0, columnIndex)));

                // Look for error patterns in the compiled frame at this location
                const hasErrorPattern
                    = textAtLocation.has("new Error(")
                        || textAtLocation.has("throw new Error")
                        || textAtLocation.has("throw ")
                        || textAtLocation.has(errorMessage.slice(0, 20)); // First 20 chars of error message

                compiledFrameHasCorrectCode = hasErrorPattern;

                // For frameworks that heavily transform code (Svelte, Vue), be more permissive
                // If source search succeeded but compiled code doesn't contain error patterns,
                // still show compiled frame as it's useful for debugging
                if (!compiledFrameHasCorrectCode && sourceSearchWasSuccessful) {
                    const isCompiledFramework
                        = originalFilePath.includes(".svelte")
                            || originalFilePath.includes(".vue")
                            || originalFilePath.includes(".astro")
                            || compiledFilePath.includes(".js")
                            || compiledFilePath.includes(".ts");

                    if (isCompiledFramework) {
                        compiledFrameHasCorrectCode = true;
                        // Allowing compiled frame for transformed framework
                    }
                }
            }
        }

        // Smart frame decision

        // Show compiled frame only when it contains the correct error code
        const showCompiledFrame = shouldGenerateCompiledFrame && compiledFrameHasCorrectCode;

        if (showCompiledFrame) {
            // Generating compiled code frame

            const lines = compiledSourceText.split("\n");
            const totalLines = lines.length;

            // Map line number to valid range, fallback to last lines if needed
            const targetLine = Math.min(compiledLine, totalLines) || Math.max(1, totalLines - 2);
            const targetColumn = lines[targetLine - 1] ? Math.min(compiledColumn || 1, lines[targetLine - 1]?.length || 1) : 1;

            // Compiled frame target

            try {
                compiledSnippet = codeFrame(compiledSourceText, { start: { column: targetColumn, line: targetLine } }, { showGutter: false });
                // Generated compiled code frame
            } catch (error) {
                // Failed to generate compiled code frame
                console.warn("Compiled codeFrame failed:", error);
                // Silently fail if codeFrame throws, but keep compiled source for fallback
                compiledSnippet = compiledSourceText?.slice(0, 500) || "";
            }
        }
    } catch (error) {
        console.warn("Source retrieval failed:", error);
        // Variables are already initialized above, so we can continue
    }

    // Generate syntax-highlighted code frames
    const { compiledCodeFrameContent, originalCodeFrameContent } = await generateSyntaxHighlightedFrames(
        originalSnippet,
        compiledSnippet,
        originalFilePath,
        compiledFilePath,
        originalFileLine,
        compiledLine,
    );

    // Use original snippet if available, otherwise try to provide context
    let promptSnippet = originalSnippet;

    if (!promptSnippet && originalSourceText) {
        // Try to extract context around the error line
        const lines = originalSourceText.split("\n");
        const startLine = Math.max(0, originalFileLine - 3);
        const endLine = Math.min(lines.length, originalFileLine + 2);

        promptSnippet = lines.slice(startLine, endLine).join("\n");
    }

    if (!promptSnippet) {
        // Fallback to compiled snippet or generic message
        promptSnippet = compiledSnippet || `Error at line ${originalFileLine} in ${originalFilePath}`;
    }

    const fixPrompt = aiPrompt({
        applicationType: undefined,
        error,
        file: {
            file: originalFilePath,
            language: findLanguageBasedOnExtension(originalFilePath),
            line: originalFileLine,
            snippet: promptSnippet,
        },
    });

    return {
        compiledCodeFrameContent,
        compiledColumn,
        compiledFilePath,
        compiledLine,
        compiledSnippet,
        compiledStack: formatStacktrace(
            parseStacktrace({
                message: cleanMessage,
                name: primaryError.name,
                stack: cleanedStack,
            } as Error),
            {
                header: { message: cleanMessage, name: primaryError.name },
            },
        ),
        errorCount: individualErrors.length,
        fixPrompt,
        originalCodeFrameContent,
        originalSnippet,
        originalFileColumn,
        originalFileLine,
        originalFilePath,
        originalSnippet,
        originalStack: originalStack || cleanedStack, // Use processed stack or fallback to cleaned stack
        plugin,
    } as const;
};

export default buildExtendedErrorData;
