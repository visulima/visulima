import { ANSI_CSI, ANSI_SGR_TERMINATOR, ESCAPES } from "../constants";

/**
 * Wraps an ANSI code in the escape sequence.
 * @param code The ANSI code to wrap
 * @returns The wrapped ANSI code
 */
const wrapAnsiCode = (code: number | string): string => {
    const escapeChar = ESCAPES.values().next().value as string;

    return `${escapeChar}${ANSI_CSI}${String(code)}${ANSI_SGR_TERMINATOR}`;
};

export default wrapAnsiCode;
