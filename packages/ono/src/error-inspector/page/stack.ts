/* eslint-disable jsdoc/match-description */
import type { VisulimaError } from "@visulima/error/error";
import { getErrorCauses } from "@visulima/error/error";
import type { SolutionError, SolutionFinder } from "@visulima/error/solution";

import { getProcessVersion } from "../../utils/process";
import runtimeName from "../../utils/runtimes";
import causesViewer from "../components/causes-viewer";
import errorCard from "../components/error-card";
import rawStackTrace from "../components/raw-stack-trace";
import stackTraceViewer from "../components/stack-trace-viewer";
import type { ContentPage, TemplateOptions } from "../types";

type ErrorType = Error | SolutionError | VisulimaError;
type ErrorLike = { message: string; name: string; stack?: string };

/**
 * Type guard to ensure we have a valid Error-like object
 * @param value The value to check
 * @returns True if the value is an Error-like object with name and message properties
 */
const isErrorLike = (value: unknown): value is ErrorLike => {
    if (typeof value !== "object" || value === null) {
        return false;
    }

    const record = value as Record<string, unknown>;

    return typeof record.name === "string"
        && typeof record.message === "string"
        && (record.stack === undefined || typeof record.stack === "string");
};

/**
 * Safely extract the main error from the causes array with validation
 * @param allCauses Array of error causes from getErrorCauses
 * @returns The main error object
 * @throws TypeError if no errors found or main cause is invalid
 */
const extractMainError = (allCauses: unknown[]): Error => {
    if (allCauses.length === 0) {
        throw new TypeError("No errors found in the error stack");
    }

    const mainCause = allCauses[0];

    if (mainCause instanceof Error) {
        return mainCause;
    }

    if (isErrorLike(mainCause)) {
        const error = new Error(mainCause.message);

        error.name = mainCause.name;

        if (typeof mainCause.stack === "string") {
            // preserve provided stack
            (error as Error & { stack: string }).stack = mainCause.stack;
        }

        return error;
    }

    throw new TypeError("Main cause is not a valid Error object");
};

/**
 * Build HTML content efficiently using array joining for better performance
 * @param errorCardHtml HTML from the error card component
 * @param stackTraceHtml HTML from the stack trace viewer component
 * @param causesViewerHtml HTML from the causes viewer component
 * @param stackTraceContent Raw stack trace content
 * @returns Complete HTML content wrapped in a container div
 */
const buildHtmlContent = (errorCardHtml: string, stackTraceHtml: string, causesViewerHtml: string, stackTraceContent: string): string => {
    const htmlParts = ["<div class=\"flex flex-col gap-6\">", errorCardHtml, stackTraceHtml, causesViewerHtml, stackTraceContent, "</div>"];

    return htmlParts.join("");
};

/**
 * Build script content efficiently by filtering and joining scripts
 * @param stackTraceScript Script from stack trace viewer
 * @param causesViewerScript Script from causes viewer
 * @param errorCardScripts Array of scripts from error card
 * @returns Combined script content
 */
const buildScriptContent = (stackTraceScript: string, causesViewerScript: string, errorCardScripts: string[]): string => {
    const scripts = [stackTraceScript, causesViewerScript, ...errorCardScripts];

    return scripts.filter(Boolean).join("\n");
};

/**
 * Generates the stack page content for the error inspector
 * This page displays error details, stack traces, and related causes
 * @param error The main error to display
 * @param solutionFinders Array of solution finder functions
 * @param options Template options including sanitization settings
 * @returns Promise resolving to content page data
 * @throws TypeError if input validation fails
 */
const stack = async (error: ErrorType, solutionFinders: SolutionFinder[] = [], options: TemplateOptions = {}): Promise<ContentPage> => {
    // Input validation
    if (!error) {
        throw new TypeError("Error parameter is required");
    }

    if (!Array.isArray(solutionFinders)) {
        throw new TypeError("solutionFinders must be an array");
    }

    // Get all error causes - optimize by avoiding full array creation if no causes
    const allCauses = getErrorCauses(error);

    // Extract and validate the main error
    const mainError = extractMainError(allCauses);

    // Optimize: only slice remaining causes if we actually have more than one cause
    const remainingCauses = allCauses.length > 1 ? allCauses.slice(1) : [];

    // Generate all HTML components concurrently for better performance

    const [
        errorCardResult,
        stackTraceResult,
        causesViewerResult,
        // eslint-disable-next-line promise/no-promise-in-callback
    ] = await Promise.all([
        errorCard({
            error: mainError,
            runtimeName,
            solutionFinders,
            version: getProcessVersion(),
        }),
        stackTraceViewer(mainError, {
            openInEditorUrl: options.openInEditorUrl,
        }),
        causesViewer(remainingCauses, options),
    ]);

    // Extract results
    const { html: errorCardHtml, scripts: errorCardScripts } = errorCardResult;
    const { html: stackTraceHtml, script: stackTraceScript } = stackTraceResult;
    const { html: causesViewerHtml, script: causesViewerScript } = causesViewerResult;

    // Build final HTML and script content
    const html = buildHtmlContent(errorCardHtml, stackTraceHtml, causesViewerHtml, rawStackTrace(mainError.stack));

    const script = buildScriptContent(stackTraceScript, causesViewerScript, errorCardScripts);

    return {
        code: { html, script },
        defaultSelected: true,
        id: "stack",
        name: "Stack",
    };
};

export default stack;
