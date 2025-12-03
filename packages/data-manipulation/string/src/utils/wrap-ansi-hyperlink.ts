import { ANSI_ESCAPE_BELL, ANSI_ESCAPE_LINK, ESCAPES } from "../constants";

/**
 * Wraps an ANSI hyperlink in the escape sequence
 * @param url The URL to wrap
 * @returns The wrapped ANSI hyperlink
 */
const wrapAnsiHyperlink = (url: string): string => {
    const escapeChar = ESCAPES.values().next().value;

    return `${escapeChar}${ANSI_ESCAPE_LINK}${url}${ANSI_ESCAPE_BELL}`;
};

export default wrapAnsiHyperlink;
