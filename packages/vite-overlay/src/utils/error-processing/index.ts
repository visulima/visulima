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
import { cleanErrorMessage, cleanErrorStack, extractErrors, isESBuildErrorArray, processESBuildErrors } from "../stack-trace-utils";
import type { ESBuildMessage } from "../stack-trace-utils";
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
        return processedErrors.map(({ message, name, stack }) => ({
            message: message || "ESBuild error",
            name: name || "Error",
            stack: stack || "",
        } as Error));
    }

    return extractErrors(error);
};

/**
 * Extracts location information from error stack trace
 */
const extractLocationFromStack = (error: Error) => {
    const traces = parseStacktrace(error, { frameLimit: 5 });
    const trace = traces?.[0];

    return {
        compiledColumn: trace?.column ?? 0,
        compiledFilePath: trace?.file ?? "",
        compiledLine: trace?.line ?? 0,
    };
};

/**
 * Resolves original source location using source maps
 */
const resolveOriginalLocationInfo = async (
    server: ViteDevServer,
    originalFilePath: string,
    originalFileColumn: number,
    originalFileLine: number,
    vueErrorInfo?: { originalFilePath: string; line: number; column: number } | null,
) => {
    // Use Vue error info if available, otherwise use provided values
    const filePath = vueErrorInfo?.originalFilePath || originalFilePath;
    let fileLine = vueErrorInfo?.line ?? originalFileLine;
    let fileColumn = vueErrorInfo?.column ?? originalFileColumn;

    // Resolve using source maps if we have a valid file path
    if (filePath) {
        const idCandidates = normalizeIdCandidates(filePath);
        const module_ = findModuleForPath(server, idCandidates);

        if (module_) {
            try {
                const resolved = await resolveOriginalLocation(server, module_, filePath, fileLine, fileColumn);
                return {
                    originalFileColumn: resolved.originalFileColumn,
                    originalFileLine: resolved.originalFileLine,
                    originalFilePath: resolved.originalFilePath,
                };
            } catch {
                // Fall back to original values if resolution fails
            }
        }
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
): ErrorProcessingResult => ({
    compiledCodeFrameContent: undefined,
    compiledColumn,
    compiledFilePath,
    compiledLine,
    compiledSnippet: "",
    fixPrompt: "",
    originalCodeFrameContent: undefined,
    originalFileColumn,
    originalFileLine,
    originalFilePath,
    originalSnippet: "",
});

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
    let compiledCodeFrameContent: string | undefined;

    // Always process both snippets individually, even if one is empty

    const hlLangOriginal = findLanguageBasedOnExtension(originalFilePath) || "text";
    const hlLangCompiled = findLanguageBasedOnExtension(compiledFilePath) || hlLangOriginal;

    // Load required language support
    const langs: LanguageInput[] = [];
    const requiredLangs = new Set([hlLangOriginal, hlLangCompiled]);

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

    return { originalCodeFrameContent, compiledCodeFrameContent };
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
const buildExtendedErrorData = async (error: Error | { message: string; name?: string; stack?: string }, server: ViteDevServer, viteErrorData?: ViteErrorData): Promise<ErrorProcessingResult> => {
    // Extract Vue error info and individual errors
    const vueErrorInfo = error?.message ? parseVueCompilationError(error.message) : undefined;
    const individualErrors = extractIndividualErrors(error);
    const primaryError = individualErrors[0] || error;

    // Clean and process error data
    const cleanMessage = cleanErrorMessage(primaryError);
    const cleanedStack = cleanErrorStack(primaryError.stack || "");
    const originalStack = await remapStackToOriginal(server, cleanedStack, { message: cleanMessage, name: primaryError.name });

    // Extract and resolve location information
    const { compiledColumn, compiledFilePath, compiledLine } = extractLocationFromStack(primaryError);
    let { originalFileColumn, originalFileLine, originalFilePath } = await resolveOriginalLocationInfo(
        server,
        compiledFilePath,
        compiledColumn,
        compiledLine,
        vueErrorInfo,
    );

    // Extract plugin information
    const plugin = viteErrorData?.plugin;

    // Retrieve source code for generating code frames
    let originalSnippet = "";
    let compiledSnippet = "";

    try {
        // Vite optimization: Parallel module resolution for better performance
        const [compiledModule, originalModule] = await Promise.all([
            findModuleForPath(server, normalizeIdCandidates(compiledFilePath)),
            findModuleForPath(server, normalizeIdCandidates(originalFilePath)),
        ]);

        if (!compiledModule && !originalModule) {
            return createEmptyResult(compiledColumn, compiledFilePath, compiledLine, originalFileColumn, originalFileLine, originalFilePath);
        }

        // Vite optimization: Parallel source retrieval for better performance
        const [compiledSourceResult, originalSourceResult] = await Promise.all([
            compiledModule ? retrieveSourceTexts(server, compiledModule, compiledFilePath, normalizeIdCandidates(compiledFilePath))
                           : Promise.resolve({ compiledSourceText: undefined, originalSourceText: undefined }),
            originalModule ? retrieveSourceTexts(server, originalModule, originalFilePath, normalizeIdCandidates(originalFilePath))
                           : Promise.resolve({ compiledSourceText: undefined, originalSourceText: undefined }),
        ]);

        const { compiledSourceText } = compiledSourceResult;
        const { originalSourceText } = originalSourceResult;

        // Generate original code frame (Vite optimization: skip realignment for cached modules)
        if (originalSourceText) {
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
                    { showGutter: false }
                );
            } catch (error) {
                // Silently fail if codeFrame throws, but keep original source for fallback
                originalSnippet = originalSourceText?.slice(0, 500) || "";
            }
        }

        // Generate compiled code frame with line mapping
        if (compiledSourceText && compiledLine > 0) {
            const lines = compiledSourceText.split('\n');
            const totalLines = lines.length;

            // Map line number to valid range, fallback to last lines if needed
            const targetLine = Math.min(compiledLine, totalLines) || Math.max(1, totalLines - 2);
            const targetColumn = lines[targetLine - 1] ? Math.min(compiledColumn || 1, lines[targetLine - 1].length) : 1;

            try {
                compiledSnippet = codeFrame(compiledSourceText, { start: { column: targetColumn, line: targetLine } }, { showGutter: false });
            } catch (error) {
                // Silently fail if codeFrame throws, but keep compiled source for fallback
                compiledSnippet = compiledSourceText?.slice(0, 500) || "";
            }
        }
    } catch {
        // Ignore source retrieval errors, continue with available data
    }

    // Generate syntax-highlighted code frames
    const { originalCodeFrameContent, compiledCodeFrameContent } = await generateSyntaxHighlightedFrames(
        originalSnippet,
        compiledSnippet,
        originalFilePath,
        compiledFilePath,
        originalFileLine,
        compiledLine
    );

    const fixPrompt = aiPrompt({
        applicationType: undefined,
        error,
        file: {
            file: originalFilePath,
            language: findLanguageBasedOnExtension(originalFilePath),
            line: originalFileLine,
            snippet: originalSnippet || compiledSnippet || "",
        },
    });

    return {
        compiledCodeFrameContent,
        compiledColumn,
        compiledFilePath,
        compiledLine,
        compiledSnippet,
        compiledStack: formatStacktrace(parseStacktrace({
            message: cleanMessage,
            name: primaryError.name,
            stack: cleanedStack,
        } as Error), {
            header: { message: cleanMessage, name: primaryError.name },
        }),
        errorCount: individualErrors.length,
        fixPrompt,
        originalCodeFrameContent,
        originalFileColumn,
        originalFileLine,
        originalFilePath,
        originalSnippet,
        originalStack: originalStack || cleanedStack, // Use processed stack or fallback to cleaned stack
        plugin,
    } as const;
};

export default buildExtendedErrorData;
