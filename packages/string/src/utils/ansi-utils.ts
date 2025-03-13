import { ANSI_CSI, ANSI_ESCAPE_BELL, ANSI_ESCAPE_LINK, ANSI_SGR_TERMINATOR, ESCAPES } from "../constants";

/**
 * Wraps an ANSI code in the escape sequence
 * @param code - The ANSI code to wrap
 * @returns The wrapped ANSI code
 */
export const wrapAnsiCode = (code: number | string): string => {
    const escapeChar = ESCAPES.values().next().value;
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    return `${escapeChar}${ANSI_CSI}${code}${ANSI_SGR_TERMINATOR}`;
};

/**
 * Wraps an ANSI hyperlink in the escape sequence
 * @param url - The URL to wrap
 * @returns The wrapped ANSI hyperlink
 */
export const wrapAnsiHyperlink = (url: string): string => {
    const escapeChar = ESCAPES.values().next().value;
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    return `${escapeChar}${ANSI_ESCAPE_LINK}${url}${ANSI_ESCAPE_BELL}`;
};

/**
 * Helper function to reset ANSI sequences at line breaks
 * @param currentLine - Current line of text
 * @returns Line with reset codes if needed
 */
export const resetAnsiAtLineBreak = (currentLine: string): string => {
    if (!currentLine.includes("\u001B")) {
        return currentLine;
    }

    let result = currentLine;
    // Add reset codes in reverse order of how they were applied
    if (currentLine.includes("\u001B[30m")) {
        result += "\u001B[39m"; // foreground reset
    }
    if (currentLine.includes("\u001B[42m")) {
        result += "\u001B[49m"; // background reset
    }

    return result;
};
