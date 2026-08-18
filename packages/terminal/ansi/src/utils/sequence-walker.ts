/**
 * The escape-sequence walker shared by `strip` and `scan`.
 *
 * One linear pass, no backtracking regular expression, so it is safe on untrusted subprocess or log
 * output — adversarial input such as a long run of unterminated `ESC ]` prefixes cannot make it
 * quadratic. Both public entry points read the same boundaries, so they can never disagree about
 * where a sequence ends.
 */

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

/** The string-sequence introducers that follow `ESC`, mapped to their kind. */
const STRING_KINDS: Readonly<Record<number, string>> = { [APC]: "apc", [DCS]: "dcs", [PM]: "pm", [SOS]: "sos" };

/** The same, for the 8-bit single-byte introducers. */
const C1_STRING_KINDS: Readonly<Record<number, string>> = { [C1_APC]: "apc", [C1_DCS]: "dcs", [C1_PM]: "pm", [C1_SOS]: "sos" };

/** What kind of thing the scanner found. */
type SequenceKind = "apc" | "csi" | "dcs" | "escape" | "osc" | "pm" | "sos";

/**
 * Whether `code` is an 8-bit C1 control that introduces an escape sequence.
 * @param code A UTF-16 code point, or `undefined` past the end of the input.
 * @returns `true` if `code` opens a C1 CSI/OSC/DCS/SOS/PM/APC sequence.
 */
const isC1Introducer = (code: number | undefined): boolean =>
    code === C1_CSI || code === C1_OSC || code === C1_DCS || code === C1_SOS || code === C1_PM || code === C1_APC;

/**
 * Finds the end index of a CSI sequence starting at `from` (the byte after `ESC [`).
 * A CSI ends on its first final byte in the range `0x40`–`0x7e`.
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
 *
 * Such sequences end on `ST` (`ESC \`), the single-byte `ST` (`0x9c`) and — for OSC only — `BEL`.
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

/** A resolved sequence: where it ends, and what kind it is. */
interface SequenceBounds {
    end: number;
    kind: SequenceKind;
}

/**
 * Resolves the sequence whose `ESC` is at `index`.
 * @param input The source string.
 * @param index The index of the `ESC` byte.
 * @returns The sequence bounds, or `undefined` if the byte after `ESC` starts nothing recognised.
 */
const findSequence = (input: string, index: number): SequenceBounds | undefined => {
    const next = input.codePointAt(index + 1);

    if (next === LEFT_BRACKET) {
        const end = findCsiEnd(input, index + 2);

        return end === -1 ? undefined : { end, kind: "csi" };
    }

    if (next === RIGHT_BRACKET) {
        const end = findStringEnd(input, index + 2, true);

        return end === -1 ? undefined : { end, kind: "osc" };
    }

    if (next === DCS || next === SOS || next === PM || next === APC) {
        const end = findStringEnd(input, index + 2, false);
        const kind = STRING_KINDS[next] as SequenceKind;

        return end === -1 ? undefined : { end, kind };
    }

    // Two-character escape: ESC <byte> (e.g. ESC 7, ESC c).
    return next === undefined ? undefined : { end: index + 1, kind: "escape" };
};

/**
 * Resolves the sequence introduced by an 8-bit C1 control byte at `index`.
 *
 * Mirrors {@link findSequence} for the single-byte forms (e.g. `0x9b` is `ESC [`).
 * @param input The source string.
 * @param index The index of the C1 introducer byte.
 * @returns The sequence bounds, or `undefined` if unrecognised.
 */
const findC1Sequence = (input: string, index: number): SequenceBounds | undefined => {
    const code = input.codePointAt(index);

    if (code === C1_CSI) {
        const end = findCsiEnd(input, index + 1);

        return end === -1 ? undefined : { end, kind: "csi" };
    }

    if (code === C1_OSC) {
        const end = findStringEnd(input, index + 1, true);

        return end === -1 ? undefined : { end, kind: "osc" };
    }

    if (code === C1_DCS || code === C1_SOS || code === C1_PM || code === C1_APC) {
        const end = findStringEnd(input, index + 1, false);
        const kind = C1_STRING_KINDS[code] as SequenceKind;

        return end === -1 ? undefined : { end, kind };
    }

    return undefined;
};

/**
 * Whether `input` contains any escape-sequence introducer — the `ESC` byte or an 8-bit C1 control.
 * @param input The source string.
 * @returns `true` if there is anything to scan.
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

export type { SequenceBounds, SequenceKind };
export { ESC, findC1Sequence, findSequence, hasIntroducer, isC1Introducer };
