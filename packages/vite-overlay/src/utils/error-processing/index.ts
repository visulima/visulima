import { codeFrame, formatStacktrace, parseStacktrace } from "@visulima/error";
import aiPrompt from "@visulima/error/solution/ai/prompt";
import type { LanguageInput } from "shiki";
import type { ViteDevServer } from "vite";

import findLanguageBasedOnExtension from "../../../../../shared/utils/find-language-based-on-extension";
import getHighlighter, { transformerCompactLineOptions } from "../../../../../shared/utils/get-highlighter";
import type { ErrorProcessingResult, ViteErrorData } from "../../types";
import type { ESBuildMessage } from "../esbuild-error";
import { isESBuildErrorArray, processESBuildErrors } from "../esbuild-error";
import findModuleForPath from "../find-module-for-path";
import { normalizeIdCandidates } from "../normalize-id-candidates";
import realignOriginalPosition from "../position-aligner";
import resolveOriginalLocation from "../resolve-original-location";
import { cleanErrorMessage, cleanErrorStack, extractErrors } from "../stack-trace";
import parseVueCompilationError from "./parse-vue-compilation-error";
import processHydrationDiff from "./process-hydration-diff";
import remapStackToOriginal from "./remap-stack-to-original";
import retrieveSourceTexts from "./retrieve-source-texts";
import shikiDiffTransformer from "./shiki-diff-transformer";
import addQueryToUrl from "./utils/add-query-to-url";
import extractQueryFromHttpUrl from "./utils/extract-query-from-http-url";

/**
 * Extracts individual errors from an error object, handling ESBuild error arrays.
 * @param error The error object to process
 * @returns Array of individual error objects
 */
const extractIndividualErrors = (error: Error): Error[] => {
    if (Array.isArray(error) && isESBuildErrorArray(error as unknown[])) {
        const processedErrors = processESBuildErrors(error as ESBuildMessage[]);

        return processedErrors.map(
            (processedError) =>
                ({
                    message: processedError.message || "ESBuild error",
                    name: processedError.name || "Error",
                    stack: processedError.stack || "",
                }) as Error,
        );
    }

    return extractErrors(error);
};

/**
 * Extracts location information from an error's stack trace.
 * @param error The error object to extract location from
 * @returns Object containing compiled file path, line, and column information
 */
const extractLocationFromStack = (error: Error) => {
    const traces = parseStacktrace(error, { frameLimit: 10 });

    const httpTrace = traces?.find((trace) => trace?.file?.startsWith("http"));
    const trace = httpTrace || traces?.[0];

    return {
        compiledColumn: trace?.column ?? 0,
        compiledFilePath: trace?.file ?? "",
        compiledLine: trace?.line ?? 0,
    };
};

/**
 * Resolves original source location information using source maps and module resolution.
 * @param server The Vite dev server instance
 * @param sourceFilePath The source file path
 * @param compiledFileColumn The column in the compiled file
 * @param compiledFileLine The line in the compiled file
 * @param vueErrorInfo Optional Vue-specific error information
 * @param errorMessage Optional error message for better resolution
 * @param errorIndex Index of the error in case of multiple errors
 * @param compiledFilePath Optional compiled file path
 * @returns Promise resolving to original location information
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
    const filePath = vueErrorInfo?.originalFilePath || sourceFilePath;
    const fileLine = vueErrorInfo?.line ?? compiledFileLine;
    const fileColumn = vueErrorInfo?.column ?? compiledFileColumn;

    if (filePath) {
        let resolvedFilePath = filePath;
        let resolvedOriginalFilePath = filePath;

        if (filePath.startsWith("http://") || filePath.startsWith("https://")) {
            try {
                const url = new URL(filePath);

                resolvedFilePath = url.pathname;

                if (resolvedFilePath.startsWith("/")) {
                    resolvedFilePath = resolvedFilePath.slice(1);
                }

                const serverRoot = server.config.root || process.cwd();

                resolvedOriginalFilePath = resolvedFilePath.startsWith("/") ? resolvedFilePath : `${serverRoot}/${resolvedFilePath}`;
            } catch {
                console.warn("Failed to parse HTTP URL:", filePath);
            }
        }

        const idCandidates = normalizeIdCandidates(resolvedFilePath);

        const module_ = findModuleForPath(server, idCandidates);

        if (module_) {
            try {
                const mapFilePath = sourceFilePath || compiledFilePath || resolvedFilePath;
                const resolved = await resolveOriginalLocation(server, module_, mapFilePath, fileLine, fileColumn, errorMessage, errorIndex);
                const finalFilePath = resolvedOriginalFilePath || resolved.originalFilePath;

                return {
                    originalFileColumn: resolved.originalFileColumn,
                    originalFileLine: resolved.originalFileLine,
                    originalFilePath: finalFilePath,
                };
            } catch {
                console.warn("⚠️ Source map resolution failed, using estimation");
            }
        }

        let estimatedLine = fileLine;
        let estimatedColumn = fileColumn;

        if (fileLine >= 20) {
            estimatedLine = Math.max(1, Math.round(fileLine * 0.5));
        } else if (fileLine > 15) {
            estimatedLine = Math.max(1, Math.round(fileLine * 0.6));
        } else if (fileLine > 10) {
            estimatedLine = Math.max(1, fileLine - 8);
        } else {
            estimatedLine = Math.max(1, fileLine - 3);
        }

        if (fileColumn >= 10) {
            estimatedColumn = Math.max(0, fileColumn - 1);
        } else if (fileColumn > 7) {
            estimatedColumn = Math.max(0, fileColumn - 1);
        } else if (fileColumn > 5) {
            estimatedColumn = Math.max(0, fileColumn);
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
        fixPrompt: "",
        originalCodeFrameContent: undefined,
        originalFileColumn,
        originalFileLine,
        originalFilePath,
        originalSnippet: "",
    };
};

/**
 * Generates syntax-highlighted HTML code frames for both original and compiled code.
 * @param originalSnippet The original source code snippet
 * @param compiledSnippet The compiled source code snippet
 * @param originalFilePath Path to the original source file
 * @param compiledFilePath Path to the compiled source file
 * @param originalFileLine Line number in the original file
 * @param compiledLine Line number in the compiled file
 * @returns Promise resolving to object with highlighted code frames
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
    let compiledCodeFrameContent: string | undefined;

    const hlLangOriginal = findLanguageBasedOnExtension(originalFilePath) || "text";
    const hlLangCompiled = findLanguageBasedOnExtension(compiledFilePath) || hlLangOriginal;

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
    error: Error,
    server: ViteDevServer,
    errorIndex: number = 0,
    framework?: string,
    viteErrorData?: ViteErrorData,
    allErrors?: (Error | { message: string; name?: string; stack?: string })[],
    // eslint-disable-next-line sonarjs/cognitive-complexity
): Promise<ErrorProcessingResult> => {
    const vueErrorInfo = framework === "vue" && error?.message ? parseVueCompilationError(error.message) : undefined;
    const individualErrors = extractIndividualErrors(error);
    const primaryError = individualErrors[0] || error;
    const isReactHydrationError
        = framework === "react" && error.message && (error.message.toLowerCase().includes("hydration") || error.message.toLowerCase().includes("hydrating"));

    let causeQuery = "";

    if (allErrors && allErrors.length > 1) {
        for (const allError of allErrors.slice(1)) {
            const causeStack = allError.stack || "";
            const causeTraces = parseStacktrace({ stack: causeStack } as Error, { frameLimit: 10 });
            const causeHttpTrace = causeTraces?.find((trace) => trace?.file?.startsWith("http"));

            if (causeHttpTrace?.file) {
                causeQuery = extractQueryFromHttpUrl(causeHttpTrace.file);

                if (causeQuery) {
                    break;
                }
            }
        }
    }

    const cleanMessage = cleanErrorMessage(primaryError);
    const cleanedStack = cleanErrorStack(primaryError.stack || "");
    const originalStack = await remapStackToOriginal(server, cleanedStack, { message: cleanMessage, name: primaryError.name });

    // For cause errors, prioritize viteErrorData location over stack extraction
    let compiledColumn: number | undefined;
    let compiledFilePath: string | undefined;
    let compiledLine: number | undefined;

    if (viteErrorData?.file && viteErrorData?.line && viteErrorData?.column) {
        compiledColumn = viteErrorData.column;
        compiledFilePath = viteErrorData.file;
        compiledLine = viteErrorData.line;
    } else {
        const extracted = extractLocationFromStack(primaryError);

        compiledColumn = extracted.compiledColumn;
        compiledFilePath = extracted.compiledFilePath;
        compiledLine = extracted.compiledLine;

        if (compiledFilePath && !compiledFilePath.startsWith("http")) {
            const projectRoot = server.config.root;

            let relativePath = compiledFilePath;

            if (compiledFilePath.startsWith(projectRoot)) {
                relativePath = compiledFilePath.slice(projectRoot.length);
            }

            if (!relativePath.startsWith("/")) {
                relativePath = `/${relativePath}`;
            }

            const port = server.config.server.port || server.config.preview?.port || 5173;
            const host = server.config.server.host || server.config.preview?.host || "localhost";
            const protocol = server.config.server.https ? "https" : "http";

            let httpUrl = `${protocol}://${host}:${port}${relativePath}`;

            if (causeQuery) {
                httpUrl = addQueryToUrl(httpUrl, causeQuery);
            }

            compiledFilePath = httpUrl;
        }
    }

    if (isReactHydrationError) {
        const diffContent = processHydrationDiff(error);

        if (diffContent) {
            const highlighter = await getHighlighter();

            return {
                errorCount: 1,
                fixPrompt: aiPrompt({
                    applicationType: undefined,
                    error,
                    file: {
                        file: compiledFilePath,
                        language: "jsx",
                        line: compiledLine,
                        snippet: diffContent,
                    },
                }),
                message: error.message,
                originalCodeFrameContent: highlighter.codeToHtml(diffContent as string, {
                    lang: compiledFilePath ? findLanguageBasedOnExtension(compiledFilePath) : "text",
                    themes: { dark: "github-dark-default", light: "github-light" },
                    transformers: [shikiDiffTransformer()],
                }),
                originalFileColumn: compiledColumn,
                originalFileLine: compiledLine,
                originalFilePath: compiledFilePath,
                originalSnippet: diffContent as string,
                originalStack: error.stack || "",
            } as const;
        }
    }

    // Prioritize viteErrorData.file (from our WebSocket interception) over stack trace
    let sourceFilePath = viteErrorData?.file || compiledFilePath;

    if (!viteErrorData?.file && primaryError.stack) {
        const traces = parseStacktrace(primaryError, { frameLimit: 10 });
        const sourceTrace = traces?.find(
            (trace) =>
                trace?.file
                && !trace.file.startsWith("http")
                && !trace.file.includes("node_modules")
                && !trace.file.includes(".vite")
                && trace.file.includes(".tsx"),
        );

        if (sourceTrace?.file) {
            sourceFilePath = sourceTrace.file;
        }
    }

    // eslint-disable-next-line prefer-const
    let { originalFileColumn, originalFileLine, originalFilePath } = await resolveOriginalLocationInfo(
        server,
        sourceFilePath,
        compiledColumn,
        compiledLine,
        vueErrorInfo,
        primaryError.message,
        errorIndex,
        compiledFilePath,
    );

    const plugin = viteErrorData?.plugin;

    let originalSnippet = "";
    let compiledSnippet = "";
    let originalSourceText: string | undefined;
    let compiledSourceText: string | undefined;

    try {
        const [compiledModule, originalModule] = await Promise.all([
            findModuleForPath(server, normalizeIdCandidates(compiledFilePath)),
            findModuleForPath(server, normalizeIdCandidates(originalFilePath)),
        ]);

        if (!compiledModule && !originalModule) {
            return createEmptyResult(compiledColumn, compiledFilePath, compiledLine, originalFileColumn, originalFileLine, originalFilePath);
        }

        const compiledFilePathForRetrieval = compiledFilePath.startsWith("http")
            ? compiledFilePath.replace(/^https?:\/\/[^/]+/, "").replace(/^\//, "")
            : compiledFilePath;

        const originalFilePathForRetrieval = originalFilePath.startsWith("http")
            ? originalFilePath.replace(/^https?:\/\/[^/]+/, "").replace(/^\//, "")
            : originalFilePath;

        const moduleForCompiledSource = compiledModule || originalModule;

        if (moduleForCompiledSource?.transformResult?.code) {
            compiledSourceText = moduleForCompiledSource.transformResult.code;
        }

        if (originalModule?.transformResult?.map && !originalSourceText) {
            const sourceMap = originalModule.transformResult.map;

            try {
                const originalContent = (sourceMap as any).sourcesContent?.[0];

                if (originalContent) {
                    originalSourceText = originalContent;
                }
            } catch (error: any) {
                console.warn("Failed to get original source from source map:", error);
            }
        }

        const [compiledSourceResult, originalSourceResult] = await Promise.all([
            !compiledSourceText && compiledModule
                ? retrieveSourceTexts(server, compiledModule, compiledFilePathForRetrieval, normalizeIdCandidates(compiledFilePathForRetrieval))
                : Promise.resolve({ compiledSourceText: undefined, originalSourceText: undefined }),
            !originalSourceText && originalModule
                ? retrieveSourceTexts(server, originalModule, originalFilePathForRetrieval, normalizeIdCandidates(originalFilePathForRetrieval))
                : Promise.resolve({ compiledSourceText: undefined, originalSourceText: undefined }),
        ]);

        if (!compiledSourceText && compiledSourceResult.compiledSourceText) {
            ({ compiledSourceText } = compiledSourceResult);
        }

        if (!originalSourceText && originalSourceResult.originalSourceText) {
            ({ originalSourceText } = originalSourceResult);
        }

        if (originalSourceText) {
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
            } catch {
                originalSnippet = originalSourceText?.slice(0, 500) || "";
            }
        }

        // Show compiled frame only when it contains the correct error code at the found location
        const shouldGenerateCompiledFrame = compiledSourceText && compiledLine > 0;
        const sourceSearchWasSuccessful = originalFileLine > 0 && originalFileColumn > 0;

        let compiledFrameHasCorrectCode = false;

        if (shouldGenerateCompiledFrame && compiledLine > 0 && primaryError.message && compiledSourceText) {
            const compiledLines = compiledSourceText.split("\n");
            const targetCompiledLine = compiledLines[compiledLine - 1];

            if (targetCompiledLine && compiledColumn <= targetCompiledLine.length) {
                const errorMessage = primaryError.message;
                const columnIndex = Math.max(0, compiledColumn - 1);
                const textAtLocation = new Set(targetCompiledLine.slice(Math.max(0, columnIndex)));

                const hasErrorPattern
                    = textAtLocation.has("new Error(")
                        || textAtLocation.has("throw new Error")
                        || textAtLocation.has("throw ")
                        || textAtLocation.has(errorMessage.slice(0, 20));

                compiledFrameHasCorrectCode = hasErrorPattern;

                if (!compiledFrameHasCorrectCode && sourceSearchWasSuccessful) {
                    const isCompiledFramework
                        = originalFilePath.includes(".svelte")
                            || originalFilePath.includes(".vue")
                            || originalFilePath.includes(".astro")
                            || compiledFilePath.includes(".js")
                            || compiledFilePath.includes(".ts");

                    if (isCompiledFramework) {
                        compiledFrameHasCorrectCode = true;
                    }
                }
            }
        }

        const showCompiledFrame = shouldGenerateCompiledFrame && compiledFrameHasCorrectCode;

        if (showCompiledFrame && compiledSourceText) {
            const lines = compiledSourceText.split("\n");
            const totalLines = lines.length;

            const targetLine = Math.min(compiledLine, totalLines) || Math.max(1, totalLines - 2);
            const targetColumn = lines[targetLine - 1] ? Math.min(compiledColumn || 1, lines[targetLine - 1]?.length || 1) : 1;

            try {
                compiledSnippet = codeFrame(compiledSourceText, { start: { column: targetColumn, line: targetLine } }, { showGutter: false });
            } catch (error: any) {
                console.warn("Compiled codeFrame failed:", error);
                compiledSnippet = compiledSourceText?.slice(0, 500) || "";
            }
        }
    } catch (error: any) {
        console.warn("Source retrieval failed:", error);
    }

    const { compiledCodeFrameContent, originalCodeFrameContent } = await generateSyntaxHighlightedFrames(
        originalSnippet,
        compiledSnippet,
        originalFilePath,
        compiledFilePath,
        originalFileLine,
        compiledLine,
    );

    let promptSnippet = originalSnippet;

    if (!promptSnippet && originalSourceText) {
        const lines = originalSourceText.split("\n");
        const startLine = Math.max(0, originalFileLine - 3);
        const endLine = Math.min(lines.length, originalFileLine + 2);

        promptSnippet = lines.slice(startLine, endLine).join("\n");
    }

    if (!promptSnippet) {
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
        originalFileColumn,
        originalFileLine,
        originalFilePath,
        originalSnippet,
        originalStack: originalStack || cleanedStack,
        plugin,
    } as const;
};

/**
 * Default export for building extended error data with source maps and code frames.
 * @see buildExtendedErrorData
 */
export default buildExtendedErrorData;
