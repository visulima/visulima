import { stripVTControlCharacters } from "node:util";

import { resolve } from "@visulima/path";

/**
 * Cleans up stack trace by removing unnecessary paths and normalizing format.
 * @param stack Raw stack trace string
 * @returns Cleaned stack trace string
 */
export const cleanErrorStack = (stack: string): string => stack
    .split(/\n/)
    .map((line) => {
        // Remove @fs/ paths that Vite adds
        line = line.replaceAll("/@fs/", "/");
        // Clean up file:// URLs that might appear
        line = line.replaceAll("file://", "");

        return line;
    })
    .join("\n");

/**
 * Attempts to detect the plugin that caused an error from the stack trace.
 * @param stack Stack trace string
 * @returns Plugin name if detected, undefined otherwise
 */
export const detectPluginFromStack = (stack: string): string | undefined => {
    const stackText = stack.toLowerCase();

    // Common Vite plugin patterns
    const pluginPatterns = [
        // Vite core plugins
        { name: "Vite React Plugin", pattern: /vite.*plugin.*react/i },
        { name: "Vite Vue Plugin", pattern: /vite.*plugin.*vue/i },
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

    for (const { name, pattern } of pluginPatterns) {
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
    // Match patterns like: at file.js:10:5 or at file.js:10
    const locationMatch = line.match(/at\s+(.+?):(\d+)(?::(\d+))?/);

    if (locationMatch) {
        const [, file, lineString, columnString] = locationMatch;
        const lineNumber = lineString ? Number.parseInt(lineString, 10) : 0;
        const columnNumber = columnString ? Number.parseInt(columnString, 10) : undefined;

        return {
            column: columnNumber,
            file: file?.trim() || "",
            line: lineNumber,
        };
    }

    return null;
};

/**
 * Normalizes line endings in a string to \n.
 * @param text Text with potentially mixed line endings
 * @returns Text with normalized line endings
 */
export const normalizeLF = (text: string): string => text.replaceAll("\r\n", "\n").replaceAll("\r", "\n");

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
}[] => esbuildErrors.map((buildError, index) => {
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
export const isAggregateError = (error: any): error is AggregateError => error instanceof AggregateError || (error && typeof error === "object" && "errors" in error && Array.isArray(error.errors));

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

export const absolutizeStackUrls = (stack: string, rootPath: string): string => {
    if (!stack) {
        return stack;
    }

    return String(stack).replaceAll(/https?:\/\/[^\s)]+/g, (url) => {
        try {
            // Extract optional :line(:column) suffix at the end of the matched URL
            const lm = url.match(/:(\d+)(?::(\d+))?$/);
            const line = lm ? lm[1] : undefined;
            const col = lm ? lm[2] : undefined;
            const baseUrl = lm ? url.slice(0, -lm[0].length) : url;

            const u = new URL(baseUrl);

            let pth = decodeURIComponent(u.pathname || "");

            pth = pth.replace(/^\/@fs\//, "/");

            const abs = resolve(rootPath, pth.startsWith("/") ? pth.slice(1) : pth);

            return line ? `${abs}:${line}${col ? `:${col}` : ""}` : abs;
        } catch {
            return url;
        }
    });
};

/**
 * Formats a single parsed stack frame to a standard "at ..." line.
 */
// moved to @visulima/error
