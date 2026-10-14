import { cursorTo } from "@visulima/ansi";

import { inkCharacterWidth } from "./measure-text";

const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
// Only SGR can be replayed without moving the cursor or changing terminal modes.
// eslint-disable-next-line no-control-regex -- SGR starts with ESC.
const sgrPattern = /\u001B\[[\d;]*m/gu;
// Anything else (OSC links, tabs, carriage returns, cursor moves) keeps the whole-line rewrite.
const controlPattern = /\p{Control}/u;
// eslint-disable-next-line regexp/no-obscure-range -- The range covers every printable ASCII character.
const printableAscii = /^[ -~]*$/u;

// Summed per grapheme, the way layout measures text, so the width cache only holds reusable graphemes
// rather than every row slice.
const widthOf = (text: string): number => {
    if (printableAscii.test(text)) {
        return text.length;
    }

    let width = 0;

    for (const { segment } of segmenter.segment(text)) {
        width += inkCharacterWidth(segment);
    }

    return width;
};

/**
 * Returns the bytes that turn one row showing `previous` into `next`.
 *
 * The cursor is moved to the first differing cell and only the rest of the row is written, so the
 * unchanged prefix stays on screen. Falls back to rewriting the whole row (`cursorTo(0)` + `next`)
 * whenever a prefix cannot be skipped safely: unknown width, no shared text, a cut that would split
 * a grapheme or an escape sequence, or a row that would wrap.
 *
 * The row is assumed to leave the default style behind, as styled output does, so the SGR sequences before
 * the cut are the whole style state there. The caller appends the erase-to-end-of-line sequence.
 * @param previous The row as currently shown.
 * @param next The row as it should be shown.
 * @param columns The terminal width, or undefined when unknown.
 * @returns The sequence to write for this row.
 */
export const changedLineUpdate = (previous: string, next: string, columns: number | undefined): string => {
    const full = cursorTo(0) + next;

    if (columns === undefined || Number.isNaN(columns) || columns < 1) {
        return full;
    }

    let commonLength = 0;

    while (commonLength < previous.length && commonLength < next.length && previous[commonLength] === next[commonLength]) {
        commonLength += 1;
    }

    if (commonLength === 0) {
        return full;
    }

    const previousText = previous.replaceAll(sgrPattern, "");
    const nextText = next.replaceAll(sgrPattern, "");

    if (controlPattern.test(previousText) || controlPattern.test(nextText)) {
        return full;
    }

    const sgrs = [...next.matchAll(sgrPattern)];

    // An SGR sequence that straddles the shared prefix does not make its visible text shared.
    let textLimit = commonLength;

    for (const match of sgrs) {
        if (match.index >= commonLength) {
            break;
        }

        textLimit -= Math.min(match[0].length, commonLength - match.index);
    }

    let textLength = 0;

    if (printableAscii.test(previousText) && printableAscii.test(nextText)) {
        textLength = textLimit;
    } else {
        // A grapheme is shared only when both rows segment it identically, so a cut never lands inside one.
        const previousSegments = segmenter.segment(previousText)[Symbol.iterator]();

        for (const { index, segment } of segmenter.segment(nextText)) {
            if (index + segment.length > textLimit || previousSegments.next().value?.segment !== segment) {
                break;
            }

            textLength = index + segment.length;
        }
    }

    const column = widthOf(nextText.slice(0, textLength));

    // Column 0 has nothing to skip. A cut at the right margin cannot be reproduced with CHA.
    // Either remainder overflowing the row means it would wrap, so the cursor arithmetic breaks.
    if (
        column === 0
        || column >= columns
        || column + widthOf(previousText.slice(textLength)) > columns
        || column + widthOf(nextText.slice(textLength)) > columns
    ) {
        return full;
    }

    // Replay the SGR sequences before the cut so the cells after it get the same style as a whole-line rewrite.
    let offset = textLength;
    let styles = "";

    for (const match of sgrs) {
        if (match.index > offset || match.index + match[0].length > commonLength) {
            break;
        }

        offset += match[0].length;
        styles += match[0];
    }

    const partial = cursorTo(column) + styles + next.slice(offset);

    return partial.length < full.length ? partial : full;
};
