import { ANSI_ESCAPE_BELL, ANSI_ESCAPE_LINK, ESCAPES } from "../constants";

/**
 * Matches one control sequence anchored at `lastIndex`.
 *
 * The ranges are the ECMA-48 parameter, intermediate and final byte classes. Anchoring and a real
 * final-byte class both matter: scanning for `m` instead would run straight past a non-SGR sequence
 * such as `CSI 1 D` and swallow everything up to the next letter `m`.
 */
// eslint-disable-next-line no-control-regex
const RE_CONTROL_SEQUENCE = /(?:\u{1B}\[|\u{9B})[\u{30}-\u{3F}]*[\u{20}-\u{2F}]*[\u{40}-\u{7E}]/uy;

/**
 * Reads the control sequence starting at `index`.
 *
 * Handles both CSI sequences and OSC 8 hyperlinks, which are terminated by a bell rather than by a
 * final byte. Every ANSI-aware traversal in this package goes through here so they cannot disagree
 * about where a sequence ends.
 * @param text The string being scanned.
 * @param index Offset of the escape introducer.
 * @returns The full sequence, or `undefined` when `index` is not an introducer or the sequence is
 * truncated at the end of the string.
 */
const readControlSequence = (text: string, index: number): string | undefined => {
    if (!ESCAPES.has(text[index] as string)) {
        return undefined;
    }

    if (text.startsWith(ANSI_ESCAPE_LINK, index + 1)) {
        const bell = text.indexOf(ANSI_ESCAPE_BELL, index);

        return bell === -1 ? undefined : text.slice(index, bell + 1);
    }

    RE_CONTROL_SEQUENCE.lastIndex = index;

    return RE_CONTROL_SEQUENCE.exec(text)?.[0];
};

export default readControlSequence;
