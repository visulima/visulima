import type { VueErrorInfo } from "../types";

/**
 * Parses Vue SFC compilation error messages to extract essential location information
 */
export function parseVueCompilationError(errorMessage: string): VueErrorInfo | null {
    // Check if this is a Vue compilation error
    if (!errorMessage.includes("[vue/compiler-sfc]")) {
        return null;
    }

    let filePath = "";
    let line = 0;
    let column = 0;

    // Extract file path and position from the error message
    // Try to extract position from the error message format: "(4:2)"
    const positionPattern = /\((\d+):(\d+)\)/;
    const positionMatch = errorMessage.match(positionPattern);

    if (positionMatch) {
        line = Number.parseInt(positionMatch[1], 10);
        column = Number.parseInt(positionMatch[2], 10);
    }

    // Find the file path in the error message
    const filePathPattern = /(\S+\.vue)/;
    const fileMatch = errorMessage.match(filePathPattern);

    if (fileMatch) {
        filePath = fileMatch[1];
    }

    // Extract just the error message (first line)
    const message = errorMessage.split("\n")[0] || errorMessage;

    // Return only essential information
    if (filePath && line > 0 && column > 0) {
        return {
            column,
            filePath,
            line,
            message,
        };
    }

    return null;
}
