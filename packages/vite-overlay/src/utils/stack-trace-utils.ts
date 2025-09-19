import { stripVTControlCharacters } from "node:util";

import { resolve } from "@visulima/path";

import type { PluginPattern, StackFrameValidator, SupportedExtension } from "../types";

const PATH_SEPARATOR = "/" as const;
const COLON_SEPARATOR = ":" as const;
const AT_PREFIX = "at " as const;

const HTTP_URL_PATTERN = /https?:\/\/[^\s)]+/g as const;
const FILE_URL_PATTERN = /file:\/\//g as const;
const FS_PATH_PATTERN = /\/@fs\//g as const;

const SUPPORTED_EXTENSIONS = new Set<SupportedExtension>([".cjs", ".js", ".jsx", ".mjs", ".svelte", ".ts", ".tsx", ".vue"]);

const VALID_STACK_KEYWORDS = new Set<string>(["<anonymous>", "<unknown>", "native"]);

/**
 * Validates if a stack trace line represents a valid stack frame.
 * @param line The stack trace line to validate
 * @returns True if the line is a valid stack frame
 */
export const isValidStackFrame: StackFrameValidator = (line: string): boolean => {
    const trimmed = line.trim();

    if (!trimmed.startsWith(AT_PREFIX)) {
        return false;
    }

    const hasFileReference
        = [...SUPPORTED_EXTENSIONS].some((extension) => trimmed.includes(extension)) || [...VALID_STACK_KEYWORDS].some((keyword) => trimmed.includes(keyword));

    if (!hasFileReference) {
        return false;
    }

    const hasLocationInfo
        = /\([^)]*:\d+:\d+\)/.test(trimmed)
            || /\([^)]*:\d+\)/.test(trimmed)
            || /[^(\s][^:]*:\d+:\d+/.test(trimmed)
            || /[^(\s][^:]*:\d+/.test(trimmed)
            || trimmed.includes("native")
            || trimmed.includes("<unknown>");

    return hasLocationInfo;
};

/**
 * Cleans a single stack trace line by removing file URLs and validating the line.
 * @param line The stack trace line to clean
 * @returns The cleaned stack line or empty string if invalid
 */
const cleanStackLine: StackLineCleaner = (line: string): string => {
    line = line.replaceAll(FS_PATH_PATTERN, PATH_SEPARATOR);
    line = line.replaceAll(FILE_URL_PATTERN, "");

    if (line.includes("<unknown>")) {
        return line.trim() || "";
    }

    if (line.trim() && !isValidStackFrame(line)) {
        return "";
    }

    return line;
};

/**
 * Converts an HTTP URL to an absolute filesystem path with location info.
 * @param url The HTTP URL to convert
 * @param rootPath The root directory for path resolution
 * @returns The absolute path with line and column information
 */
const absolutizeUrl = (url: string, rootPath: string): string => {
    try {
        const { baseUrl, col, line } = parseUrlWithLocation(url);
        const absolutePath = urlToAbsolutePath(baseUrl, rootPath);

        return formatAbsolutePath(absolutePath, line, col);
    } catch (error) {
        console.warn("Failed to absolutize URL:", url, error);

        return url;
    }
};

/**
 * Parses a URL to extract the base URL and location information (line and column).
 * @param url The URL to parse
 * @returns Object containing baseUrl, line, and column information
 */
const parseUrlWithLocation = (url: string) => {
    const locationMatch = url.match(/:(\d+)(?::(\d+))?$/);
    const line = locationMatch?.[1];
    const col = locationMatch?.[2];
    const baseUrl = locationMatch ? url.slice(0, -locationMatch[0].length) : url;

    return { baseUrl, col, line };
};

/**
 * Converts a URL to an absolute filesystem path.
 * @param url The URL to convert
 * @param rootPath The root directory for path resolution
 * @returns The absolute filesystem path
 */
const urlToAbsolutePath = (url: string, rootPath: string): string => {
    const parsedUrl = new URL(url);
    let path = decodeURIComponent(parsedUrl.pathname || "");

    path = path.replaceAll(FS_PATH_PATTERN, PATH_SEPARATOR);

    const absolutePath = resolve(rootPath, path.startsWith(PATH_SEPARATOR) ? path.slice(1) : path);

    return absolutePath;
};

/**
 * Formats an absolute path with optional line and column information.
 * @param absolutePath The absolute filesystem path
 * @param line Optional line number
 * @param col Optional column number
 * @returns The formatted path with location information
 */
const formatAbsolutePath = (absolutePath: string, line?: string, col?: string): string => {
    if (!line)
        return absolutePath;

    const lineCol = col ? `${COLON_SEPARATOR}${col}` : "";

    return `${absolutePath}${COLON_SEPARATOR}${line}${lineCol}`;
};

/**
 * Cleans an error stack trace by normalizing line endings and filtering invalid stack frames.
 * @param stack The raw stack trace string
 * @returns The cleaned stack trace
 */
export const cleanErrorStack = (stack: string): string => {
    if (!stack) {
        return stack;
    }

    return stack
        .replaceAll("\r\n", "\n")
        .replaceAll("\r", "\n")
        .split(/\n/)
        .map(cleanStackLine)
        .filter((line) => line.trim() !== "")
        .join("\n");
};

/**
 * Cleans and resolves an error stack trace for better readability.
 * @param stack The raw stack trace string
 * @param server The Vite dev server instance
 * @param rootPath The root directory path
 * @returns The cleaned and resolved stack trace
 */
export const cleanAndResolveErrorStack = (stack: string, server: ViteDevServer, rootPath: string): string => {
    if (!stack) {
        return stack;
    }

    return cleanErrorStack(stack);
};

/**
 * Cleans an error message by removing VT control characters.
 * @param error The error object or error message string
 * @returns The cleaned error message
 */
export const cleanErrorMessage = (error: Error | string): string => {
    const message = typeof error === "string" ? error : error.message || String(error);

    return stripVTControlCharacters(message);
};

export interface ESBuildMessage {
    location?: {
        column: number;
        file: string;
        line: number;
    };
    pluginName?: string;
    text: string;
}

/**
 * Checks if an array contains ESBuild error objects.
 * @param errors Array of potential ESBuild errors
 * @returns True if the array contains ESBuild errors
 */
export const isESBuildErrorArray = (errors: any[]): boolean => {
    if (!Array.isArray(errors) || errors.length === 0)
        return false;

    return errors.some((error: any) => error && typeof error === "object" && (error.location || error.pluginName || error.text));
};

/**
 * Processes ESBuild error messages into a standardized format.
 * @param esbuildErrors Array of ESBuild error messages
 * @returns Array of processed error objects with standardized structure
 */
export const processESBuildErrors = (
    esbuildErrors: ESBuildMessage[],
): {
    column?: number;
    file?: string;
    line?: number;
    message: string;
    plugin?: string;
}[] =>
    esbuildErrors.map((buildError, index) => {
        const { location, pluginName, text } = buildError;

        const processedError: any = {
            message: text || `ESBuild error #${index + 1}`,
        };

        if (location) {
            processedError.file = location.file;
            processedError.line = location.line;
            processedError.column = location.column;
        }

        if (pluginName) {
            processedError.plugin = pluginName;
        }

        return processedError;
    });

/**
 * Checks if an error is an AggregateError (contains multiple errors).
 * @param error The error to check
 * @returns True if the error is an AggregateError
 */
export const isAggregateError = (error: any): error is AggregateError =>
    error instanceof AggregateError || (error && typeof error === "object" && "errors" in error && Array.isArray(error.errors));

/**
 * Extracts individual errors from an AggregateError or returns the error as-is.
 * @param error The error to process
 * @returns Array of individual errors
 */
export const extractErrors = (error: any): Error[] => {
    if (isAggregateError(error)) {
        return error.errors as Error[];
    }

    return [error as Error];
};

/**
 * Converts HTTP URLs in stack traces to absolute filesystem paths
 * @param stack Raw stack trace with HTTP URLs
 * @param rootPath Root directory for path resolution
 * @returns Stack trace with absolute paths
 */
export const absolutizeStackUrls = (stack: string, rootPath: string): string => {
    if (!stack)
        return stack;

    return String(stack).replaceAll(HTTP_URL_PATTERN, (url) => absolutizeUrl(url, rootPath));
};
