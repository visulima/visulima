const ESC = 0x00_1b; // ESC
const BEL = 0x00_07; // BEL
const ST_8BIT = 0x00_9c; // single-byte String Terminator
const BACKSLASH = 0x00_5c; // '\'
const CSI_FINAL_MIN = 0x00_40; // '@'
const CSI_FINAL_MAX = 0x00_7e; // '~'
const LEFT_BRACKET = 0x00_5b; // '['
const RIGHT_BRACKET = 0x00_5d; // ']'
const DCS = 0x00_50; // 'P'
const SOS = 0x00_58; // 'X'
const PM = 0x00_5e; // '^'
const APC = 0x00_5f; // '_'

/**
 * Finds the end index of a CSI sequence starting at `from` (the byte after
 * `ESC [`). A CSI ends on its first final byte in the range `0x40`–`0x7e`.
 * @param input The source string.
 * @param from The index of the first parameter/intermediate byte.
 * @returns The index of the final byte, or `-1` if the sequence is unterminated.
 */
const findCsiEnd = (input: string, from: number): number => {
    for (let cursor = from; cursor < input.length; cursor += 1) {
        const code = input.codePointAt(cursor) as number;

        if (code >= CSI_FINAL_MIN && code <= CSI_FINAL_MAX) {
            return cursor;
        }
    }

    return -1;
};

/**
 * Finds the end index of a string-terminated control sequence (OSC/DCS/SOS/PM/APC).
 * Such sequences end on `ST` (`ESC \`), the single-byte `ST` (`0x9c`) and — for
 * OSC only — `BEL`.
 * @param input The source string.
 * @param from The index of the first payload byte.
 * @param allowBel Whether a `BEL` byte also terminates the sequence (true for OSC).
 * @returns The index of the last byte of the terminator, or `-1` if unterminated.
 */
const findStringEnd = (input: string, from: number, allowBel: boolean): number => {
    for (let cursor = from; cursor < input.length; cursor += 1) {
        const code = input.codePointAt(cursor) as number;

        if (code === ST_8BIT || (allowBel && code === BEL)) {
            return cursor;
        }

        if (code === ESC && input.codePointAt(cursor + 1) === BACKSLASH) {
            return cursor + 1;
        }
    }

    return -1;
};

/**
 * Resolves the end index (inclusive) of an escape sequence whose `ESC` is at
 * `index`, or `-1` if the byte after `ESC` does not start a recognised sequence.
 * @param input The source string.
 * @param index The index of the `ESC` byte.
 * @returns The inclusive end index of the sequence, or `-1` if unrecognised.
 */
const findSequenceEnd = (input: string, index: number): number => {
    const next = input.codePointAt(index + 1);

    if (next === LEFT_BRACKET) {
        // CSI: ESC [ … final
        return findCsiEnd(input, index + 2);
    }

    if (next === RIGHT_BRACKET) {
        // OSC: ESC ] … terminated by BEL, ST or single-byte ST
        return findStringEnd(input, index + 2, true);
    }

    if (next === DCS || next === SOS || next === PM || next === APC) {
        // DCS / SOS / PM / APC: ESC P|X|^|_ … terminated by ST
        return findStringEnd(input, index + 2, false);
    }

    if (next !== undefined) {
        // Two-character escape: ESC <byte> (e.g. ESC 7, ESC c)
        return index + 1;
    }

    return -1;
};

/**
 * Removes ANSI escape codes from a string.
 *
 * The implementation is a single linear pass over the input (O(n)) — it never
 * relies on a backtracking regular expression, so it is safe to run on
 * untrusted subprocess/log output without risking polynomial ReDoS on
 * adversarial input (e.g. many unterminated `ESC ]` prefixes).
 *
 * Recognised sequences: CSI (`ESC [ ... final`, final byte `0x40`-`0x7e`),
 * OSC (`ESC ] ... BEL` or terminated by ST, covering window titles and
 * hyperlinks), string sequences DCS/SOS/PM/APC (`ESC P|X|^|_ ... ST`), and
 * two-character escapes (`ESC` plus a single byte, e.g. `ESC 7`, `ESC c`).
 * @param input The string from which to remove ANSI escape codes.
 * @returns The input string with all ANSI escape codes stripped.
 * @example
 * ```typescript
 * import { strip } from "@visulima/ansi";
 *
 * const textWithAnsi = "\x1b[32mHello\x1b[0m";
 * console.log(strip(textWithAnsi)); // "Hello"
 * ```
 */
const strip = (input: string): string => {
    // Fast path: no ESC byte means there is nothing to strip.
    if (!input.includes(String.fromCodePoint(ESC))) {
        return input;
    }

    let result = "";
    let chunkStart = 0;
    let index = 0;
    const { length } = input;

    while (index < length) {
        if (input.codePointAt(index) !== ESC) {
            index += 1;

            continue;
        }

        let end = findSequenceEnd(input, index);

        if (end === -1) {
            // Unrecognised lone ESC or unterminated control string: drop the
            // rest of the input, mirroring a greedy match that never finds its
            // terminator.
            end = length - 1;
        }

        result += input.slice(chunkStart, index);
        chunkStart = end + 1;
        index = end + 1;
    }

    result += input.slice(chunkStart);

    return result;
};

export default strip;
