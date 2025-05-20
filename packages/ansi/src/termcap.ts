import { DCS, SEP,ST } from "./constants";

/**
 * @internal
 * Converts a string to its uppercase hexadecimal representation.
 * Each character in the input string is converted to its ASCII/UTF-8 byte value,
 * and then represented as a two-digit uppercase hexadecimal string.
 * These hex strings are concatenated to form the final result.
 *
 * @param str - The string to convert to hexadecimal.
 * @returns The uppercase hexadecimal representation of the input string.
 * @example
 * ```typescript
 * // Example (if function were exported):
 * // stringToHex("Co") would return "436F"
 * // stringToHex("li") would return "6C69"
 * ```
 */
const stringToHex = (string_: string): string => {
    let hex = "";
    for (let index = 0; index < string_.length; index++) {
        const charCode = string_.charCodeAt(index);
        const byteHex = charCode.toString(16).toUpperCase();
        hex += byteHex.length === 1 ? "0" + byteHex : byteHex;
    }
    return hex;
};

/**
 * Requests Termcap/Terminfo (XTGETTCAP) strings from the terminal.
 * Sequence: DCS + q <Pt> ST
 * @param caps A list of termcap/terminfo capability names (e.g., "Co", "li", "cols").
 * @returns The XTGETTCAP sequence string.
 * @see https://invisible-island.net/xterm/ctlseqs/ctlseqs.html#h3-Device-Control-Strings-plus-q
 */
export const XTGETTCAP = (...caps: string[]): string => {
    if (caps.length === 0) {
        return "";
    }

    const hexCaps = caps.map(stringToHex);

    return DCS + "+q" + hexCaps.join(SEP) + ST;
};

/**
 * Alias for {@link XTGETTCAP}.
 * Requests Termcap/Terminfo capability strings from the terminal.
 * @param caps - A list of Termcap/Terminfo capability names.
 * @returns The XTGETTCAP escape sequence string.
 * @see XTGETTCAP
 * @example
 * ```typescript
 * import { requestTermcap } from "@visulima/ansi";
 *
 * const seq = requestTermcap("Co", "li"); // Requests colors and lines
 * process.stdout.write(seq);
 * ```
 */
export const requestTermcap = XTGETTCAP;

/**
 * Alias for {@link XTGETTCAP}.
 * Requests Termcap/Terminfo capability strings from the terminal.
 * @param caps - A list of Termcap/Terminfo capability names.
 * @returns The XTGETTCAP escape sequence string.
 * @see XTGETTCAP
 * @example
 * ```typescript
 * import { requestTerminfo } from "@visulima/ansi";
 *
 * const seq = requestTerminfo("Co", "li"); // Requests colors and lines
 * process.stdout.write(seq);
 * ```
 */
export const requestTerminfo = XTGETTCAP;
