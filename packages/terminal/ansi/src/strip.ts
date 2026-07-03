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

// 8-bit C1 control introducers — single-byte equivalents of `ESC` + an Fe byte.
const C1_CSI = 0x00_9b; // == ESC [
const C1_OSC = 0x00_9d; // == ESC ]
const C1_DCS = 0x00_90; // == ESC P
const C1_SOS = 0x00_98; // == ESC X
const C1_PM = 0x00_9e; // == ESC ^
const C1_APC = 0x00_9f; // == ESC _

/**
 * Whether `code` is an 8-bit C1 control that introduces an escape sequence.
 * @param code A UTF-16 code point, or `undefined` past the end of the input.
 * @returns `true` if `code` opens a C1 CSI/OSC/DCS/SOS/PM/APC sequence.
 */
const isC1Introducer = (code: number | undefined): boolean =>
    code === C1_CSI || code === C1_OSC || code === C1_DCS || code === C1_SOS || code === C1_PM || code === C1_APC;

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
 * Resolves the end index (inclusive) of a sequence introduced by an 8-bit C1
 * control byte at `index` (e.g. `0x9b` CSI), mirroring {@link findSequenceEnd}
 * for the single-byte forms.
 * @param input The source string.
 * @param index The index of the C1 introducer byte.
 * @returns The inclusive end index of the sequence, or `-1` if unrecognised.
 */
const findC1SequenceEnd = (input: string, index: number): number => {
    const code = input.codePointAt(index);

    if (code === C1_CSI) {
        // C1 CSI: 0x9b … final
        return findCsiEnd(input, index + 1);
    }

    if (code === C1_OSC) {
        // C1 OSC: 0x9d … terminated by BEL, ST or single-byte ST
        return findStringEnd(input, index + 1, true);
    }

    if (code === C1_DCS || code === C1_SOS || code === C1_PM || code === C1_APC) {
        // C1 DCS / SOS / PM / APC: introducer … terminated by ST
        return findStringEnd(input, index + 1, false);
    }

    return -1;
};

/**
 * Whether `input` contains any escape-sequence introducer — the `ESC` byte or
 * an 8-bit C1 control. Used as the strip fast path.
 * @param input The source string.
 * @returns `true` if there is anything to strip.
 */
const hasIntroducer = (input: string): boolean => {
    if (input.includes(String.fromCodePoint(ESC))) {
        return true;
    }

    for (let cursor = 0; cursor < input.length; cursor += 1) {
        if (isC1Introducer(input.codePointAt(cursor))) {
            return true;
        }
    }

    return false;
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
 * The 8-bit C1 single-byte introducers (`0x9b` CSI, `0x9d` OSC, `0x90` DCS,
 * `0x98` SOS, `0x9e` PM, `0x9f` APC) are recognised as equivalents of their
 * `ESC`-prefixed forms.
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
    // Fast path: no escape introducer (ESC or 8-bit C1) means nothing to strip.
    if (!hasIntroducer(input)) {
        return input;
    }

    let result = "";
    let chunkStart = 0;
    let index = 0;
    const { length } = input;

    while (index < length) {
        const code = input.codePointAt(index);

        let end: number;

        if (code === ESC) {
            end = findSequenceEnd(input, index);
        } else if (isC1Introducer(code)) {
            end = findC1SequenceEnd(input, index);
        } else {
            index += 1;

            continue;
        }

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
