import { codeFrame, formatStacktrace, parseStacktrace } from "@visulima/error";
import aiPrompt from "@visulima/error/solution/ai/prompt";
import type { LanguageInput } from "shiki";
import type { ErrorPayload, ViteDevServer } from "vite";

import findLanguageBasedOnExtension from "../../../../../shared/utils/find-language-based-on-extension";
import getHighlighter, { transformerCompactLineOptions } from "../../../../../shared/utils/get-highlighter";
import type { ErrorProcessingResult } from "../../types";
import findModuleForPath from "../find-module-for-path";
import { normalizeIdCandidates } from "../normalize-id-candidates";
import { realignOriginalPosition } from "../position-aligner";
import resolveOriginalLocation from "../resolve-original-location";
import { cleanErrorMessage, cleanErrorStack, extractErrors, isAggregateError, isESBuildErrorArray, processESBuildErrors } from "../stack-trace-utils";
import { parseVueCompilationError } from "./parse-vue-compilation-error";
import { remapStackToOriginal } from "./remap-stack-to-original";
import { retrieveSourceTexts } from "./retrieve-source-texts";

/**
 * Builds comprehensive error data including source maps, code frames, and AI prompts.
 * This function processes runtime errors and extracts all information needed for
 * the error overlay UI, including original source locations and syntax-highlighted code.
 * Handles both single errors and AggregateError (multiple errors).
 * @param error The error object to process (can be AggregateError with multiple errors)
 * @param server The Vite dev server instance for module resolution
 * @returns Promise resolving to extended error data object
 */
const buildExtendedErrorData = async (error: Error, server: ViteDevServer, rawError?: ErrorPayload["err"]): Promise<ErrorProcessingResult> => {
    // Try to extract Vue compilation error information using the adapter
    const vueErrorInfo = error?.message ? parseVueCompilationError(error.message) : null;

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
    const cleanedStack = cleanErrorStack(rawStack);
    const originalStack = await remapStackToOriginal(server, cleanedStack, { message: cleanMessage, name: primaryError.name });
    const plugin = rawError?.plugin;

    // Create a synthetic error with cleaned data for parsing
    const syntheticError = new Error(cleanMessage);

    syntheticError.name = primaryError.name;
    syntheticError.stack = cleanedStack;

    const traces = parseStacktrace(syntheticError, { frameLimit: 5 });
    const trace = traces?.[0] as any;

    // Extract location information from stack trace
    const compiledFilePath = trace?.file ?? "";
    const compiledLine = trace?.line ?? 0;
    const compiledColumn = trace?.column ?? 0;

    // Try to extract location from raw error object first (most reliable)
    let viteLocation = null;

    if (rawError) {
        // Check if the raw error has a 'loc' property (Vite's location object)
        if (rawError.loc) {
            const { loc } = rawError;

            viteLocation = {
                column: loc.column || 1,
                file: loc.file || loc.path || "",
                line: loc.line || 1,
            };
        }
        // Check if the raw error has an 'id' property (often the source file path)
        else if (rawError.id) {
            const { id } = rawError;

            // If it's a source file path, use it
            if (typeof id === "string" && (id.endsWith(".tsx") || id.endsWith(".ts") || id.endsWith(".jsx") || id.endsWith(".js") || id.endsWith(".vue"))) {
                viteLocation = {
                    column: 1,
                    file: id,
                    line: 1, // Default to line 1 if no specific location
                };
            }
        }
    }

    // Initialize original location - prefer Vite location data
    let originalFilePath = viteLocation?.file || compiledFilePath;
    let originalFileLine = viteLocation?.line || compiledLine;
    let originalFileColumn = viteLocation?.column || compiledColumn;

    // Override with Vue error information if available
    if (vueErrorInfo) {
        originalFilePath = vueErrorInfo.originalFilePath;
        originalFileLine = vueErrorInfo.line;
        originalFileColumn = vueErrorInfo.column;
    }

    // Resolve original source location using source maps
    if (originalFilePath) {
        const idCandidates = normalizeIdCandidates(originalFilePath);
        // eslint-disable-next-line no-underscore-dangle, @typescript-eslint/naming-convention
        const module_ = findModuleForPath(server, idCandidates);

        if (module_) {
            const resolved = resolveOriginalLocation(module_, originalFilePath, originalFileLine, originalFileColumn);

            originalFilePath = resolved.originalFilePath;
            originalFileLine = resolved.originalFileLine;
            originalFileColumn = resolved.originalFileColumn;
        }
    }

    // Retrieve source code for generating code frames
    let originalSnippet = "";
    let compiledSnippet = "";

    try {
        const idCandidates = normalizeIdCandidates(originalFilePath);
        // eslint-disable-next-line no-underscore-dangle, @typescript-eslint/naming-convention
        const module_ = findModuleForPath(server, idCandidates);

        if (!module_) {
            return {
                compiledCodeFrameContent: undefined,
                compiledColumn,
                compiledFilePath,
                compiledLine,
                compiledSnippet: "",
                fixPrompt: "",
                originalCodeFrameContent: undefined,
                originalFileColumn: compiledColumn,
                originalFileLine: compiledLine,
                originalFilePath: compiledFilePath,
                originalSnippet: "",
            };
        }

        // Retrieve source texts from various sources
        const { compiledSourceText, originalSourceText } = await retrieveSourceTexts(server, module_, originalFilePath, idCandidates);

        // Generate code frames if source texts are available
        if (originalSourceText) {
            // Apply heuristic realignment if position seems incorrect
            if (compiledSourceText && originalFileLine <= 0 && compiledLine > 0) {
                const realigned = realignOriginalPosition(compiledSourceText, compiledLine, compiledColumn, originalSourceText);

                if (realigned) {
                    originalFileLine = realigned.line;
                    originalFileColumn = realigned.column;
                }
            }

            originalSnippet = codeFrame(
                originalSourceText,
                {
                    start: { column: originalFileColumn, line: originalFileLine },
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

    // Generate syntax-highlighted code frames for client-side rendering
    let originalCodeFrameContent: string | undefined;
    let compiledCodeFrameContent: string | undefined;

    if (originalSnippet || compiledSnippet) {
        const hlLangOriginal = findLanguageBasedOnExtension(originalFilePath) || "text";
        const hlLangCompiled = findLanguageBasedOnExtension(compiledFilePath) || hlLangOriginal;

        const langs: LanguageInput[] = [];

        if (hlLangOriginal === "svelte" || hlLangCompiled === "svelte") {
            langs.push(import("@shikijs/langs/svelte"));
        }

        if (hlLangOriginal === "vue" || hlLangCompiled === "vue") {
            langs.push(import("@shikijs/langs/vue"));
        }

        const highlighter = await getHighlighter(langs);

        const highlightOptions = {
            themes: { dark: "github-dark-default", light: "github-light" },
        };

        if (originalSnippet) {
            originalCodeFrameContent = highlighter.codeToHtml(originalSnippet, {
                ...highlightOptions,
                lang: hlLangOriginal,
                transformers: [transformerCompactLineOptions([{ classes: ["error-line"], line: originalFileLine }])],
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
        compiledStack: formatStacktrace(parseStacktrace(syntheticError), {
            header: { message: cleanMessage, name: primaryError.name },
        }),
        errorCount: individualErrors.length,
        fixPrompt,
        originalCodeFrameContent,
        originalFileColumn,
        originalFileLine,
        originalFilePath,
        originalSnippet,
        originalStack,
        plugin,
    } as const;
};

export default buildExtendedErrorData;
