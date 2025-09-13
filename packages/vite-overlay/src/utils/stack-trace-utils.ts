import { stripVTControlCharacters } from "node:util";

import { resolve } from "@visulima/path";

// Constants
const PATH_SEPARATOR = "/";
const COLON_SEPARATOR = ":";

// Regex patterns
const LOCATION_PATTERN = /at\s+(.+?):(\d+)(?::(\d+))?/;
const HTTP_URL_PATTERN = /https?:\/\/[^\s)]+/g;
const FILE_URL_PATTERN = /file:\/\//g;
const FS_PATH_PATTERN = /\/@fs\//g;

// Plugin detection patterns
const PLUGIN_PATTERNS = [
    // Vite core plugins
    { name: "Vite React Plugin", pattern: /vite.*plugin.*react/i },
    { name: "Vite Vue Plugin", pattern: /vite.*plugin.*vue/i },
    { name: "Vite Vue Plugin", pattern: /vue\/compiler-sfc/i },
    { name: "Vite Svelte Plugin", pattern: /vite.*plugin.*svelte/i },
    { name: "Vite Plugin", pattern: /@vitejs\/plugin-/i },
    { name: "Vite Plugin", pattern: /vite-plugin/i },

    // Build tools
    { name: "esbuild", pattern: /esbuild/i },
    { name: "Rollup", pattern: /rollup/i },
    { name: "Webpack", pattern: /webpack/i },
    { name: "Parcel", pattern: /parcel/i },

    // TypeScript
    { name: "TypeScript", pattern: /typescript/i },
    { name: "TypeScript Compiler", pattern: /tsc/i },

    // CSS/Sass
    { name: "PostCSS", pattern: /postcss/i },
    { name: "Sass", pattern: /sass/i },
    { name: "Less", pattern: /less/i },
    { name: "Stylus", pattern: /stylus/i },

    // Testing
    { name: "Vitest", pattern: /vitest/i },
    { name: "Jest", pattern: /jest/i },
    { name: "Cypress", pattern: /cypress/i },

    // Framework specific
    { name: "Next.js", pattern: /next/i },
    { name: "Nuxt.js", pattern: /nuxt/i },
    { name: "Astro", pattern: /astro/i },
    { name: "SvelteKit", pattern: /sveltekit/i },
];

/**
 * Checks if a line is a valid JavaScript stack frame
 */
export const isValidStackFrame = (line: string): boolean => {
    // Must start with 'at' after trimming (allows for indentation)
    const trimmed = line.trim();

    if (!trimmed.startsWith("at ")) {
        return false;
    }

    // Must contain a file path with supported extension or be an anonymous/native function
    const hasFileReference
        = trimmed.includes(".js")
            || trimmed.includes(".ts")
            || trimmed.includes(".mjs")
            || trimmed.includes(".cjs")
            || trimmed.includes("<anonymous>")
            || trimmed.includes("native");

    if (!hasFileReference) {
        return false;
    }

    // Must have line/column information (format: file:line:column or (file:line:column)) or be native
    const hasLocationInfo
        = /\([^)]*:\d+:\d+\)/.test(trimmed) // (file:line:column)
            || /\([^)]*:\d+\)/.test(trimmed) // (file:line)
            || /[^(\s][^:]*:\d+:\d+/.test(trimmed) // file:line:column (without parens)
            || /[^(\s][^:]*:\d+/.test(trimmed) // file:line (without parens)
            || trimmed.includes("native"); // native functions

    return hasLocationInfo;
};

const cleanStackLine = (line: string): string => {
    // Remove @fs/ paths that Vite adds
    line = line.replaceAll(FS_PATH_PATTERN, PATH_SEPARATOR);
    // Clean up file:// URLs that might appear
    line = line.replaceAll(FILE_URL_PATTERN, "");

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
 * Attempts to detect the plugin that caused an error from the stack trace.
 * @param stack Stack trace string
 * @returns Plugin name if detected, undefined otherwise
 */
export const detectPluginFromStack = (stack: string): string | undefined => {
    if (!stack) {
        return undefined;
    }

    const stackText = stack.toLowerCase();

    for (const { name, pattern } of PLUGIN_PATTERNS) {
        if (pattern.test(stackText)) {
            return name;
        }
    }

    return undefined;
};

/**
 * Extracts useful location information from a stack trace line.
 * @param line Single stack trace line
 * @returns Object with file, line, and column information
 */
export const parseStackLine = (line: string) => {
    if (!line) {
        return null;
    }

    const locationMatch = LOCATION_PATTERN.exec(line);

    if (!locationMatch) {
        return null;
    }

    const [, file, lineString, columnString] = locationMatch;
    const lineNumber = lineString ? Number.parseInt(lineString, 10) : 0;
    const columnNumber = columnString ? Number.parseInt(columnString, 10) : undefined;

    return {
        column: columnNumber,
        file: file?.trim() || "",
        line: lineNumber,
    };
};

/**
 * Normalizes line endings in a string to \n.
 * @param text Text with potentially mixed line endings
 * @returns Text with normalized line endings
 */
export const normalizeLF = (text: string): string => {
    if (!text)
        return text;

    return text.replaceAll("\r\n", "\n").replaceAll("\r", "\n");
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
