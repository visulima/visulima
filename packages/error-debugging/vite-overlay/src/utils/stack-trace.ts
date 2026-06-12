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

const URL_LOCATION_RE = /:(\d+)(?::(\d+))?$/;
const NEWLINE_RE = /\n/;

// Upper bound for a single stack-frame line. Real frames are far shorter; stacks arrive verbatim
// from the browser over the HMR channel, so a pathological single-line "stack" (e.g. a very long
// `a:a:a:...`) could otherwise drive super-linear backtracking in the location regexes below.
// Lines longer than this are treated as non-frames before any regex runs.
const MAX_STACK_LINE_LENGTH = 2048;

const SUPPORTED_EXTENSIONS = new Set<SupportedExtension>([".cjs", ".js", ".jsx", ".mjs", ".svelte", ".ts", ".tsx", ".vue"]);

const VALID_STACK_KEYWORDS = new Set<string>(["<anonymous>", "<unknown>", "native"]);

const isDigit = (char: string): boolean => char >= "0" && char <= "9";

const isLocationWhitespace = (char: string): boolean =>
    char === " " || char === "\t" || char === "\n" || char === "\r" || char === "\f" || char === "\v";

/**
 * Returns the index just past a `:digit+(:digit+)?` location run that starts at `colonIndex`,
 * or `colonIndex` itself when no digit run follows the colon.
 * @param line The stack-frame line
 * @param colonIndex The index of the leading colon
 * @returns The index immediately after the consumed location run
 */
const consumeLocationRun = (line: string, colonIndex: number): number => {
    if (!isDigit(line[colonIndex + 1] as string)) {
        return colonIndex;
    }

    let end = colonIndex + 1;

    while (end < line.length && isDigit(line[end] as string)) {
        end += 1;
    }

    if (line[end] === ":" && isDigit(line[end + 1] as string)) {
        end += 1;

        while (end < line.length && isDigit(line[end] as string)) {
            end += 1;
        }
    }

    return end;
};

/**
 * Linear-scan equivalent of the parenthesised location regexes — an open paren followed
 * (without an intervening close paren) by a `:line` or `:line:column` run that is closed
 * by a `)` immediately after the digits.
 * @param line The stack-frame line
 * @returns True when a parenthesised location marker is present
 */
const hasParenthesisedLocation = (line: string): boolean => {
    let open = false;

    for (let index = 0; index < line.length; index += 1) {
        const char = line[index];

        if (char === "(") {
            open = true;
        } else if (char === ")") {
            open = false;
        } else if (open && char === ":" && consumeLocationRun(line, index) > index && line[consumeLocationRun(line, index)] === ")") {
            return true;
        }
    }

    return false;
};

/**
 * Linear-scan equivalent of the bare location regexes — a `:line` run preceded somewhere
 * on the line by a character that is neither an open paren nor whitespace.
 * @param line The stack-frame line
 * @returns True when a bare location marker is present
 */
const hasBareLocation = (line: string): boolean => {
    for (let index = 1; index < line.length; index += 1) {
        if (line[index] !== ":" || !isDigit(line[index + 1] as string)) {
            continue;
        }

        for (let before = index - 1; before >= 0; before -= 1) {
            const char = line[before] as string;

            if (char !== "(" && !isLocationWhitespace(char)) {
                return true;
            }
        }
    }

    return false;
};

/**
 * Detects a line/column location marker inside a stack-frame line.
 *
 * This replaces four backtracking-prone regexes (the parenthesised and bare
 * `colon line / colon line colon column` shapes) that previously carried
 * `sonarjs/slow-regex` suppressions and ran on browser-supplied
 * (attacker-influenceable) stack strings. Following the repo precedent for the prior
 * polynomial-ReDoS fix, the backtracking ambiguity is removed by scanning the string
 * linearly rather than tuning the regex. The result is identical to the union of the
 * four original regexes (verified by fuzzing).
 * @param line The (already trimmed) stack-frame line
 * @returns True when a line/column location marker is present
 */
const hasLocationMarker = (line: string): boolean => hasBareLocation(line) || hasParenthesisedLocation(line);

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

    if (trimmed.length > MAX_STACK_LINE_LENGTH) {
        return false;
    }

    if (!trimmed.startsWith(AT_PREFIX)) {
        return false;
    }

    const hasFileReference
        = [...SUPPORTED_EXTENSIONS].some((extension) => trimmed.includes(extension)) || [...VALID_STACK_KEYWORDS].some((keyword) => trimmed.includes(keyword));

    if (!hasFileReference) {
        return false;
    }

    const hasLocationInfo = hasLocationMarker(trimmed) || trimmed.includes("native") || trimmed.includes("<unknown>");

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
