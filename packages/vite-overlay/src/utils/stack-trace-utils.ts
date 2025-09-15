import { stripVTControlCharacters } from "node:util";

import { resolve } from "@visulima/path";

import type { PluginPattern, StackFrameValidator, SupportedExtension } from "../types";

// Constants
const PATH_SEPARATOR = "/" as const;
const COLON_SEPARATOR = ":" as const;
const AT_PREFIX = "at " as const;

// Regex patterns (compiled once for performance)
const HTTP_URL_PATTERN = /https?:\/\/[^\s)]+/g as const;
const FILE_URL_PATTERN = /file:\/\//g as const;
const FS_PATH_PATTERN = /\/@fs\//g as const;

// File extensions that indicate valid stack frames
const SUPPORTED_EXTENSIONS = new Set<SupportedExtension>([".cjs", ".js", ".jsx", ".mjs", ".svelte", ".ts", ".tsx", ".vue"]);

// Keywords that indicate valid stack frames
const VALID_STACK_KEYWORDS = new Set<string>(["<anonymous>", "<unknown>", "native"]);

/**
 * Checks if a line is a valid JavaScript stack frame.
 * Optimized for performance with early returns and Set lookups.
 */
export const isValidStackFrame: StackFrameValidator = (line: string): boolean => {
    // Must start with 'at' after trimming (allows for indentation)
    const trimmed = line.trim();

    if (!trimmed.startsWith(AT_PREFIX)) {
        return false;
    }

    // Must contain a file path with supported extension or be an anonymous/native function
    const hasFileReference
        = [...SUPPORTED_EXTENSIONS].some((extension) => trimmed.includes(extension)) || [...VALID_STACK_KEYWORDS].some((keyword) => trimmed.includes(keyword));

    if (!hasFileReference) {
        return false;
    }

    // Must have line/column information (format: file:line:column or (file:line:column)) or be native or unknown
    const hasLocationInfo
        = /\([^)]*:\d+:\d+\)/.test(trimmed) // (file:line:column)
            || /\([^)]*:\d+\)/.test(trimmed) // (file:line)
            || /[^(\s][^:]*:\d+:\d+/.test(trimmed) // file:line:column (without parens)
            || /[^(\s][^:]*:\d+/.test(trimmed) // file:line (without parens)
            || trimmed.includes("native") // native functions
            || trimmed.includes("<unknown>"); // browser couldn't resolve source

    return hasLocationInfo;
};

const cleanStackLine: StackLineCleaner = (line: string): string => {
    // Remove @fs/ paths that Vite adds
    line = line.replaceAll(FS_PATH_PATTERN, PATH_SEPARATOR);
    // Clean up file:// URLs that might appear
    line = line.replaceAll(FILE_URL_PATTERN, "");

    // Handle <unknown> entries - these are browser limitations, not actual paths
    if (line.includes("<unknown>")) {
        // Keep the line but mark it as unresolved
        return line.trim() || "";
    }

    // Additional validation: only keep valid stack frames
    if (line.trim() && !isValidStackFrame(line)) {
        return ""; // Remove invalid stack frames
    }

    return line;
};

/**
 * Converts a single HTTP URL to an absolute filesystem path
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
 * Parses a URL and extracts line/column location information
 */
const parseUrlWithLocation = (url: string) => {
    const locationMatch = url.match(/:(\d+)(?::(\d+))?$/);
    const line = locationMatch?.[1];
    const col = locationMatch?.[2];
    const baseUrl = locationMatch ? url.slice(0, -locationMatch[0].length) : url;

    return { baseUrl, col, line };
};

/**
 * Converts a URL to an absolute filesystem path
 */
const urlToAbsolutePath = (url: string, rootPath: string): string => {
    const parsedUrl = new URL(url);
    let path = decodeURIComponent(parsedUrl.pathname || "");

    // Remove Vite's @fs/ prefix
    path = path.replaceAll(FS_PATH_PATTERN, PATH_SEPARATOR);

    // Resolve to absolute path
    const absolutePath = resolve(rootPath, path.startsWith(PATH_SEPARATOR) ? path.slice(1) : path);

    return absolutePath;
};

/**
 * Formats an absolute path with optional line and column information
 */
const formatAbsolutePath = (absolutePath: string, line?: string, col?: string): string => {
    if (!line)
        return absolutePath;

    const lineCol = col ? `${COLON_SEPARATOR}${col}` : "";

    return `${absolutePath}${COLON_SEPARATOR}${line}${lineCol}`;
};

/**
 * Cleans up stack trace by removing unnecessary paths and normalizing format.
 * @param stack Raw stack trace string
 * @returns Cleaned stack trace string
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
        .filter((line) => line.trim() !== "") // Remove empty lines
        .join("\n");
};

/**
 * Enhanced stack trace cleaning with source map support.
 * @param stack Raw stack trace string
 * @param server Vite dev server instance
 * @param rootPath Root directory path
 * @returns Cleaned stack trace
 */
export const cleanAndResolveErrorStack = (stack: string, server: ViteDevServer, rootPath: string): string => {
    if (!stack) {
        return stack;
    }

    // Clean the stack and absolutize URLs
    return cleanErrorStack(stack);
};

/**
 * Strips ANSI escape codes from error messages.
 * Handles both message strings and Error objects.
 * @param error Error object or message string
 * @returns Clean text without ANSI codes
 */
export const cleanErrorMessage = (error: Error | string): string => {
    const message = typeof error === "string" ? error : error.message || String(error);

    return stripVTControlCharacters(message);
};

/**
 * Type for ESBuild error messages
 */
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
 * Checks if an array of errors looks like ESBuild errors.
 * ESBuild typically returns an array of error objects with specific properties.
 * @param errors Array of error objects to check
 * @returns True if the errors appear to be from ESBuild
 */
export const isESBuildErrorArray = (errors: any[]): boolean => {
    if (!Array.isArray(errors) || errors.length === 0)
        return false;

    // Check if at least one error has ESBuild-specific properties
    return errors.some((error: any) => error && typeof error === "object" && (error.location || error.pluginName || error.text));
};

/**
 * Processes ESBuild error arrays and extracts useful information.
 * @param esbuildErrors Array of ESBuild error messages
 * @param rootFolder Optional root folder for path resolution
 * @returns Array of processed error objects
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
