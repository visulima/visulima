import { readFile } from "node:fs/promises";

import { parseStacktrace } from "@visulima/error";
import type { ViteDevServer } from "vite";

// Constants
const MDX_FILE_PATTERN = /\.mdx$/i;
const FRAME_LIMIT = 1;

// Regex patterns
const FAILED_LOAD_PATTERN = /Failed to load url\s+(.*?)\s+\(resolved id:/i;
const GLOB_PATTERN = /glob:\s*"(.+)"\s*\(/i;

// Types
interface EnhancedError extends Error {
    hint?: string;
    id?: string;
    loc?: {
        column?: number;
        file?: string;
        line?: number;
    };
    title?: string;
}

/**
 * Creates an enhanced error object with additional properties
 */
const createEnhancedError = (rawError: unknown): EnhancedError => {
    if (rawError instanceof Error) {
        return rawError as EnhancedError;
    }

    return new Error(String(rawError)) as EnhancedError;
};

/**
 * Safely applies Vite's SSR stack trace fix
 */
const safeSsrFixStacktrace = async (server: ViteDevServer, error: EnhancedError): Promise<void> => {
    try {
        await server.ssrFixStacktrace(error as any);
    } catch (fixError) {
        console.warn("SSR stack trace fix failed:", fixError);
    }
};

/**
 * Extracts the top file path from error stack trace
 */
const extractTopFileFromStack = (error: EnhancedError): string | undefined => {
    try {
        const traces = parseStacktrace(error, { frameLimit: FRAME_LIMIT });
        const top = traces?.[0] as any;

        return String(top?.file || error.loc?.file || error.id || "");
    } catch (parseError) {
        console.warn("Stack trace parsing failed:", parseError);

        return undefined;
    }
};

/**
 * Safely reads a file, returning undefined on failure
 */
const safeReadFile = async (filePath: string): Promise<string | undefined> => {
    try {
        return await readFile(filePath, "utf8");
    } catch (readError) {
        console.warn(`Failed to read file ${filePath}:`, readError);

        return undefined;
    }
};

/**
 * Applies SSR-specific error enhancements
 */
const applySsrErrorEnhancements = async (error: EnhancedError, topFile: string | undefined, fileContents: string | undefined): Promise<void> => {
    // Apply different enhancement strategies
    await enhanceFailedLoadError(error, topFile, fileContents);
    enhanceMdxError(error, topFile);
    await enhanceGlobError(error, topFile, fileContents);
};

/**
 * Enhances "Failed to load" errors with better context
 */
const enhanceFailedLoadError = async (error: EnhancedError, topFile: string | undefined, fileContents: string | undefined): Promise<void> => {
    const failedMatch = FAILED_LOAD_PATTERN.exec(error.message);
    const importName = failedMatch?.[1];

    if (!importName) {
        return;
    }

    error.title = "Failed to Load Module (SSR)";
    error.name = "FailedToLoadModuleSSR";
    error.message = `Failed to load module: ${importName}`;
    error.hint = "Verify import path, ensure a plugin handles this file type during SSR, and check for typos or missing files.";

    if (fileContents && topFile) {
        const location = findImportLocation(fileContents, importName);

        if (location) {
            error.loc = { ...location, file: topFile };
        }
    }
};

/**
 * Enhances MDX-related errors
 */
const enhanceMdxError = (error: EnhancedError, topFile: string | undefined): void => {
    const fileId = error.id || error.loc?.file || topFile;

    if (fileId && MDX_FILE_PATTERN.test(String(fileId)) && /syntax error/i.test(error.message)) {
        error.hint = error.hint || "MDX detected without an appropriate integration. Install and configure the MDX plugin for Vite/your framework.";
    }
};

/**
 * Enhances glob pattern errors
 */
const enhanceGlobError = async (error: EnhancedError, topFile: string | undefined, fileContents: string | undefined): Promise<void> => {
    const globMatch = GLOB_PATTERN.exec(error.message);
    const globPattern = globMatch?.[1];

    if (!globPattern) {
        return;
    }

    error.name = "InvalidGlob";
    error.title = "Invalid Glob Pattern";
    error.message = `Invalid glob pattern: ${globPattern}`;
    error.hint = error.hint || "Ensure your glob follows the expected syntax and matches existing files. Avoid unintended special characters.";

    if (fileContents && topFile) {
        const location = findImportLocation(fileContents, globPattern);

        if (location) {
            error.loc = { ...location, file: topFile };
        }
    }
};

/**
 * Finds the location of an import/pattern in file contents
 */
const findImportLocation = (fileContents: string, searchTerm: string) => {
    const fileLines = fileContents.split("\n");
    const lineIndex = fileLines.findIndex((line) => line.includes(searchTerm));

    if (lineIndex === -1) {
        return null;
    }

    const lineText = fileLines[lineIndex] || "";
    const column = Math.max(0, lineText.indexOf(searchTerm));

    return {
        column: column + 1,
        line: lineIndex + 1,
    };
};

/**
 * Enhances SSR errors with better stack traces and contextual hints.
 * - Fixes stack traces via Vite's SSR helper
 * - Detects common SSR failure patterns and enriches message/loc
 */
const enhanceViteSsrError = async (rawError: unknown, server: ViteDevServer): Promise<Error> => {
    const error = createEnhancedError(rawError);

    // Let Vite improve stack traces (source maps etc.)
    await safeSsrFixStacktrace(server, error);

    // Extract top file from stack trace
    const topFile = extractTopFileFromStack(error);

    // Load file contents for location enhancement
    const fileContents = topFile ? await safeReadFile(topFile) : undefined;

    // Apply SSR-specific error enhancements
    await applySsrErrorEnhancements(error, topFile, fileContents);

    return error;
};

export default enhanceViteSsrError;
