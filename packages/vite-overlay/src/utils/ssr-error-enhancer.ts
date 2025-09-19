import { readFile } from "node:fs/promises";

import { parseStacktrace, type ErrorLocation } from "@visulima/error";
import type { ViteDevServer } from "vite";

const MDX_FILE_PATTERN = /\.mdx$/i;
const FRAME_LIMIT = 1;

const FAILED_LOAD_PATTERN = /Failed to load url\s+(.*?)\s+\(resolved id:/i;
const GLOB_PATTERN = /glob:\s*"(.+)"\s*\(/i;

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
 * Creates an enhanced error object with additional properties.
 */
const createEnhancedError = (rawError: unknown): EnhancedError => {
    if (rawError instanceof Error) {
        return rawError as EnhancedError;
    }

    return new Error(String(rawError)) as EnhancedError;
};

/**
 * Safely applies Vite's SSR stack trace fix.
 */
const safeSsrFixStacktrace = (server: ViteDevServer, error: EnhancedError): void => {
    try {
        server.ssrFixStacktrace(error as Error);
    } catch (fixError) {
        // eslint-disable-next-line no-console
        console.warn("[visulima:vite-overlay:server] SSR stack trace fix failed:", fixError);
    }
};

/**
 * Extracts the top file path from error stack trace.
 */
const extractTopFileFromStack = (error: EnhancedError): string | undefined => {
    try {
        const traces = parseStacktrace(error, { frameLimit: FRAME_LIMIT });
        const top = traces?.[0] as unknown as ErrorLocation;

        return String(top?.file || error.loc?.file || error.id || "");
    } catch (parseError) {
        // eslint-disable-next-line no-console
        console.warn("[visulima:vite-overlay:server] Stack trace parsing failed:", parseError);

        return undefined;
    }
};

/**
 * Safely reads a file, returning undefined on failure.
 */
const safeReadFile = async (filePath: string): Promise<string | undefined> => {
    try {
        return await readFile(filePath, "utf8");
    } catch (readError) {
        // eslint-disable-next-line no-console
        console.warn(`[visulima:vite-overlay:server] Failed to read file ${filePath}:`, readError);

        return undefined;
    }
};

/**
 * Enhances MDX-related errors.
 */
const enhanceMdxError = (error: EnhancedError, topFile: string | undefined): void => {
    const fileId = error.id || error.loc?.file || topFile;

    if (fileId && MDX_FILE_PATTERN.test(String(fileId)) && /syntax error/i.test(error.message)) {
        // eslint-disable-next-line no-param-reassign
        error.hint = error.hint || "MDX detected without an appropriate integration. Install and configure the MDX plugin for Vite/your framework.";
    }
};

/**
 * Finds the location of an import/pattern in file contents.
 */
const findImportLocation = (fileContents: string, searchTerm: string): ErrorLocation | undefined => {
    const fileLines = fileContents.split("\n");
    const lineIndex = fileLines.findIndex((line) => line.includes(searchTerm));

    if (lineIndex === -1) {
        return undefined;
    }

    const lineText = fileLines[lineIndex] || "";
    const column = Math.max(0, lineText.indexOf(searchTerm));

    return {
        column: column + 1,
        line: lineIndex + 1,
    };
};

/**
 * Enhances "Failed to load" errors with better context.
 */
const enhanceFailedLoadError = async (error: EnhancedError, topFile: string | undefined, fileContents: string | undefined): Promise<void> => {
    const failedMatch = FAILED_LOAD_PATTERN.exec(error.message);
    const importName = failedMatch?.[1];

    if (!importName) {
        return;
    }

    // eslint-disable-next-line no-param-reassign
    error.title = "Failed to Load Module (SSR)";
    // eslint-disable-next-line no-param-reassign
    error.name = "FailedToLoadModuleSSR";
    // eslint-disable-next-line no-param-reassign
    error.message = `Failed to load module: ${importName}`;
    // eslint-disable-next-line no-param-reassign
    error.hint = "Verify import path, ensure a plugin handles this file type during SSR, and check for typos or missing files.";

    if (fileContents && topFile) {
        const location = findImportLocation(fileContents, importName);

        if (location) {
            // eslint-disable-next-line no-param-reassign
            error.loc = { ...location, file: topFile };
        }
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

    // eslint-disable-next-line no-param-reassign
    error.name = "InvalidGlob";
    // eslint-disable-next-line no-param-reassign
    error.title = "Invalid Glob Pattern";
    // eslint-disable-next-line no-param-reassign
    error.message = `Invalid glob pattern: ${globPattern}`;
    // eslint-disable-next-line no-param-reassign
    error.hint = error.hint || "Ensure your glob follows the expected syntax and matches existing files. Avoid unintended special characters.";

    if (fileContents && topFile) {
        const location = findImportLocation(fileContents, globPattern);

        if (location) {
            // eslint-disable-next-line no-param-reassign
            error.loc = { ...location, file: topFile };
        }
    }
};

/**
 * Enhances SSR errors with better stack traces and contextual hints.
 * - Fixes stack traces via Vite's SSR helper
 * - Detects common SSR failure patterns and enriches message/loc
 */
const enhanceViteSsrError = async (rawError: unknown, server: ViteDevServer): Promise<Error> => {
    const error = createEnhancedError(rawError);

    // Let Vite improve stack traces (source maps etc.)
    safeSsrFixStacktrace(server, error);

    const topFile = extractTopFileFromStack(error);

    const fileContents = topFile ? await safeReadFile(topFile) : undefined;

    await enhanceFailedLoadError(error, topFile, fileContents);
    enhanceMdxError(error, topFile);
    await enhanceGlobError(error, topFile, fileContents);

    return error;
};

export default enhanceViteSsrError;
