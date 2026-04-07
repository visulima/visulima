/* eslint-disable sonarjs/prefer-regexp-exec, @typescript-eslint/no-unnecessary-type-conversion */
import { stripVTControlCharacters } from "node:util";

// eslint-disable-next-line import/no-extraneous-dependencies
import { resolve } from "@visulima/path";

import type { StackFrameValidator, SupportedExtension } from "../types";

type StackLineCleaner = (line: string) => string;

const PATH_SEPARATOR = "/" as const;
const COLON_SEPARATOR = ":" as const;
const AT_PREFIX = "at " as const;

const HTTP_URL_PATTERN = /https?:\/\/[^\s)]+/g;
const FILE_URL_PATTERN = /file:\/\//g;
const FS_PATH_PATTERN = /\/@fs\//g;

// eslint-disable-next-line sonarjs/slow-regex
const LOC_WITH_PARENS_COLON2_RE = /\([^)]*:\d+:\d+\)/;
// eslint-disable-next-line sonarjs/slow-regex
const LOC_WITH_PARENS_COLON1_RE = /\([^)]*:\d+\)/;
// eslint-disable-next-line sonarjs/slow-regex
const LOC_NO_PARENS_COLON2_RE = /[^(\s][^:]*:\d+:\d+/;
// eslint-disable-next-line sonarjs/slow-regex
const LOC_NO_PARENS_COLON1_RE = /[^(\s][^:]*:\d+/;
const URL_LOCATION_RE = /:(\d+)(?::(\d+))?$/;
const NEWLINE_RE = /\n/;

const SUPPORTED_EXTENSIONS = new Set<SupportedExtension>([".cjs", ".js", ".jsx", ".mjs", ".svelte", ".ts", ".tsx", ".vue"]);

const VALID_STACK_KEYWORDS = new Set<string>(["<anonymous>", "<unknown>", "native"]);

/**
 * Parses a URL to extract the base URL and location information (line and column).
 * @param url The URL to parse
 * @returns Object containing baseUrl, line, and column information
 */
const parseUrlWithLocation = (url: string) => {
    const locationMatch = url.match(URL_LOCATION_RE);
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
    if (!line) {
        return absolutePath;
    }

    const lineCol = col ? `${COLON_SEPARATOR}${col}` : "";

    return `${absolutePath}${COLON_SEPARATOR}${line}${lineCol}`;
};

/**
 * Validates if a stack trace line represents a valid stack frame.
 * @param line The stack trace line to validate
 * @returns True if the line is a valid stack frame
 */
const isValidStackFrame: StackFrameValidator = (line: string): boolean => {
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
        = LOC_WITH_PARENS_COLON2_RE.test(trimmed)
            || LOC_WITH_PARENS_COLON1_RE.test(trimmed)
            || LOC_NO_PARENS_COLON2_RE.test(trimmed)
            || LOC_NO_PARENS_COLON1_RE.test(trimmed)
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
    let cleaned = line.replaceAll(FS_PATH_PATTERN, PATH_SEPARATOR);

    cleaned = cleaned.replaceAll(FILE_URL_PATTERN, "");

    if (cleaned.includes("<unknown>")) {
        return cleaned.trim() || "";
    }

    if (cleaned.trim() && !isValidStackFrame(cleaned)) {
        return "";
    }

    return cleaned;
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
        // eslint-disable-next-line no-console
        console.warn("Failed to absolutize URL:", url, error);

        return url;
    }
};

/**
 * Cleans an error stack trace by normalizing line endings and filtering invalid stack frames.
 * @param stack The raw stack trace string
 * @returns The cleaned stack trace
 */
const cleanErrorStack = (stack: string): string => {
    if (!stack) {
        return stack;
    }

    return stack
        .replaceAll("\r\n", "\n")
        .replaceAll("\r", "\n")
        .split(NEWLINE_RE)
        .map((line) => cleanStackLine(line))
        .filter((line: string) => line.trim() !== "")
        .join("\n");
};

/**
 * Cleans an error message by removing VT control characters.
 * @param error The error object or error message string
 * @returns The cleaned error message
 */
const cleanErrorMessage = (error: Error | string): string => {
    const message = typeof error === "string" ? error : error.message || String(error);

    return stripVTControlCharacters(message);
};

/**
 * Checks if an error is an AggregateError (contains multiple errors).
 * @param error The error to check
 * @returns True if the error is an AggregateError
 */
const isAggregateError = (error: unknown): error is AggregateError =>
    error instanceof AggregateError || (error !== null && typeof error === "object" && "errors" in error && Array.isArray((error as AggregateError).errors));

/**
 * Extracts individual errors from an AggregateError or returns the error as-is.
 * @param error The error to process
 * @returns Array of individual errors
 */
const extractErrors = (error: unknown): Error[] => {
    if (isAggregateError(error)) {
        return error.errors as Error[];
    }

    return [error as Error];
};

/**
 * Converts HTTP URLs in stack traces to absolute filesystem paths.
 * @param stack Raw stack trace with HTTP URLs
 * @param rootPath Root directory for path resolution
 * @returns Stack trace with absolute paths
 */
const absolutizeStackUrls = (stack: string, rootPath: string): string => {
    if (!stack) {
        return stack;
    }

    return String(stack).replaceAll(HTTP_URL_PATTERN, (url) => absolutizeUrl(url, rootPath));
};

export { absolutizeStackUrls, cleanErrorMessage, cleanErrorStack, extractErrors, isAggregateError, isValidStackFrame };
