import { ANSI_CSI, ANSI_SGR_TERMINATOR, ESCAPES } from "../constants";

/**
 * Wraps an ANSI code in the escape sequence
 * @param code - The ANSI code to wrap
 * @returns The wrapped ANSI code
 */
const wrapAnsiCode = (code: number | string): string => {
    const escapeChar = ESCAPES.values().next().value;
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    return `${escapeChar}${ANSI_CSI}${code}${ANSI_SGR_TERMINATOR}`;
};

export default wrapAnsiCode;
