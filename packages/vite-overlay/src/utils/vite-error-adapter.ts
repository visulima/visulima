import path from "node:path";
import type { ViteDevServer } from "vite";

/**
 * Extracts file location information directly from Vite error messages.
 * Vite often provides the exact location in the format "File: /path/to/file:line:column"
 */
export const extractLocationFromViteError = (message: string, server: ViteDevServer): { file: string; line: number; column: number } | null => {
    // Match the standard Vite error format: "File: /path/to/file:line:column"
    const filePattern = /File:\s*([^:]+):(\d+)(?::(\d+))?/i;
    const match = message.match(filePattern);

    if (!match) {
        return null;
    }

    const [, filePath, lineStr, columnStr] = match;
    const line = parseInt(lineStr, 10);
    const column = columnStr ? parseInt(columnStr, 10) : 1;

    if (isNaN(line)) {
        return null;
    }

    try {
        // Resolve the file path relative to the server root if needed
        let absolutePath: string;
        if (path.isAbsolute(filePath)) {
            absolutePath = filePath;
        } else {
            // Handle relative paths
            const root = server.config.root || process.cwd();
            absolutePath = path.resolve(root, filePath);
        }

        return {
            file: absolutePath,
            line,
            column,
        };
    } catch (error) {
        console.warn(`[vite-overlay] Failed to extract location from Vite error:`, error);
        return null;
    }
};

/**
 * Extracts file location information from Vite-specific error messages.
 * Simple wrapper around extractLocationFromViteError for backward compatibility.
 */
export const extractViteErrorLocation = (message: string, server: ViteDevServer): { file: string; line: number; column: number } | null => {
    // Use the efficient direct extraction method
    return extractLocationFromViteError(message, server);
};

