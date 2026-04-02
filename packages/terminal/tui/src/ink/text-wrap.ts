/* eslint-disable @typescript-eslint/no-non-null-assertion, import/exports-last, no-for-of-array/no-for-of-array, sonarjs/cognitive-complexity */

/**
 * StyledChar-based text wrapping and truncation.
 *
 * Operates directly on StyledChar arrays to preserve ANSI styling through
 * wrap boundaries, unlike string-based wrapping which can lose style context.
 *
 * Ported from jacob314/ink fork (Google LLC, Apache-2.0).
 */
import type { StyledChar } from "@alcalzone/ansi-tokenize";

import { inkCharacterWidth, styledCharsWidth } from "./measure-text";

export const sliceStyledChars = (styledChars: StyledChar[], begin: number, end?: number): StyledChar[] => {
    let width = 0;
    const result: StyledChar[] = [];

    for (const char of styledChars) {
        const charWidth = inkCharacterWidth(char.value);
        const charStart = width;
        const charEnd = width + charWidth;

        if (end !== undefined && charEnd > end) {
            break;
        }

        if (charStart >= begin) {
            result.push(char);
        }

        width += charWidth;
    }

    return result;
};

export const truncateStyledChars = (styledChars: StyledChar[], columns: number, options: { position?: "end" | "middle" | "start" } = {}): StyledChar[] => {
    const { position = "end" } = options;
    const truncationCharacter = "\u2026";
    const truncationStyledChar: StyledChar = {
        fullWidth: false,
        styles: [],
        type: "char",
        value: truncationCharacter,
    };

    if (columns < 1) {
        return [];
    }

    if (columns === 1) {
        return [truncationStyledChar];
    }

    const textWidth = styledCharsWidth(styledChars);

    if (textWidth <= columns) {
        return styledChars;
    }

    const truncationWidth = inkCharacterWidth(truncationCharacter);

    if (position === "start") {
        const right = sliceStyledChars(styledChars, textWidth - columns + truncationWidth, textWidth);

        return [truncationStyledChar, ...right];
    }

    if (position === "middle") {
        const leftWidth = Math.ceil(columns / 2);
        const rightWidth = columns - leftWidth;
        const left = sliceStyledChars(styledChars, 0, leftWidth - truncationWidth);
        const right = sliceStyledChars(styledChars, textWidth - rightWidth, textWidth);

        return [...left, truncationStyledChar, ...right];
    }

    const left = sliceStyledChars(styledChars, 0, columns - truncationWidth);

    return [...left, truncationStyledChar];
};

const wrapWord = (rows: StyledChar[][], word: StyledChar[], columns: number): void => {
    let currentLine = rows.at(-1)!;
    let visible = styledCharsWidth(currentLine);

    for (const character of word) {
        const characterLength = inkCharacterWidth(character.value);

        if (visible + characterLength > columns && visible > 0) {
            rows.push([]);
            currentLine = rows.at(-1)!;
            visible = styledCharsWidth(currentLine);
        }

        currentLine.push(character);
        visible += characterLength;
    }
};

export const wrapStyledChars = (styledChars: StyledChar[], columns: number): StyledChar[][] => {
    const rows: StyledChar[][] = [[]];
    const words: StyledChar[][] = [];
    let currentWord: StyledChar[] = [];

    for (const char of styledChars) {
        if (char.value === "\n" || char.value === " ") {
            if (currentWord.length > 0) {
                words.push(currentWord);
            }

            currentWord = [];
            words.push([char]);
        } else {
            currentWord.push(char);
        }
    }

    if (currentWord.length > 0) {
        words.push(currentWord);
    }

    let isAtStartOfLogicalLine = true;

    for (const word of words) {
        if (word.length === 0) {
            continue;
        }

        if (word[0]!.value === "\n") {
            rows.push([]);
            isAtStartOfLogicalLine = true;
            continue;
        }

        const wordWidth = styledCharsWidth(word);
        const rowWidth = styledCharsWidth(rows.at(-1)!);

        if (rowWidth + wordWidth > columns) {
            if (!isAtStartOfLogicalLine && word[0]!.value === " " && word.length === 1) {
                continue;
            }

            // Remove trailing spaces from the current line before wrapping
            if (!isAtStartOfLogicalLine) {
                while (rows.at(-1)!.length > 0 && rows.at(-1)!.at(-1)!.value === " ") {
                    rows.at(-1)!.pop();
                }
            }

            if (wordWidth > columns) {
                if (rowWidth > 0) {
                    rows.push([]);
                }

                wrapWord(rows, word, columns);
            } else {
                rows.push([]);
                rows.at(-1)!.push(...word);
            }
        } else {
            rows.at(-1)!.push(...word);
        }

        if (isAtStartOfLogicalLine && !(word[0]!.value === " " && word.length === 1)) {
            isAtStartOfLogicalLine = false;
        }
    }

    return rows;
};

export const wrapOrTruncateStyledChars = (styledChars: StyledChar[], maxWidth: number, textWrap = "wrap"): StyledChar[][] => {
    if (textWrap.startsWith("truncate")) {
        let position: "end" | "middle" | "start" = "end";

        if (textWrap === "truncate-middle") {
            position = "middle";
        } else if (textWrap === "truncate-start") {
            position = "start";
        }

        return [truncateStyledChars(styledChars, maxWidth, { position })];
    }

    return wrapStyledChars(styledChars, maxWidth);
};

// ── StyledLine-based equivalents ──────────────────────────────────────

import { StyledLine } from "./styled-line";
import { styledLineWidth } from "./measure-text";

export const wrapOrTruncateStyledLine = (line: StyledLine, maxWidth: number, textWrap = "wrap"): StyledLine[] => {
    if (textWrap.startsWith("truncate")) {
        let position: "end" | "middle" | "start" = "end";

        if (textWrap === "truncate-middle") {
            position = "middle";
        } else if (textWrap === "truncate-start") {
            position = "start";
        }

        return [truncateStyledLine(line, maxWidth, position)];
    }

    return wrapStyledLine(line, maxWidth);
};

const truncateStyledLine = (line: StyledLine, columns: number, position: "end" | "middle" | "start" = "end"): StyledLine => {
    if (columns < 1) {
        return new StyledLine();
    }

    const textWidth = styledLineWidth(line);

    if (textWidth <= columns) {
        return line;
    }

    const ellipsis = new StyledLine();

    ellipsis.pushChar("\u2026", 0);

    if (columns === 1) {
        return ellipsis;
    }

    if (position === "start") {
        // Keep the right portion
        let width = 0;
        let startIdx = line.length;

        for (let i = line.length - 1; i >= 0; i--) {
            width += inkCharacterWidth(line.getValue(i));

            if (width > columns - 1) {
                break;
            }

            startIdx = i;
        }

        return ellipsis.combine(line.slice(startIdx));
    }

    if (position === "middle") {
        const leftWidth = Math.ceil(columns / 2);
        const rightWidth = columns - leftWidth;

        let leftEnd = 0;
        let w = 0;

        for (let i = 0; i < line.length; i++) {
            const cw = inkCharacterWidth(line.getValue(i));

            if (w + cw > leftWidth - 1) {
                break;
            }

            w += cw;
            leftEnd = i + 1;
        }

        let rightStart = line.length;

        w = 0;

        for (let i = line.length - 1; i >= 0; i--) {
            w += inkCharacterWidth(line.getValue(i));

            if (w > rightWidth) {
                break;
            }

            rightStart = i;
        }

        return line.slice(0, leftEnd).combine(ellipsis, line.slice(rightStart));
    }

    // position === "end"
    let endIdx = 0;
    let w = 0;

    for (let i = 0; i < line.length; i++) {
        const cw = inkCharacterWidth(line.getValue(i));

        if (w + cw > columns - 1) {
            break;
        }

        w += cw;
        endIdx = i + 1;
    }

    return line.slice(0, endIdx).combine(ellipsis);
};

/**
 * Word-wrap a StyledLine at column boundaries. Operates natively on StyledLine
 * using slice() to preserve styles through wrap boundaries.
 */
const wrapStyledLine = (line: StyledLine, columns: number): StyledLine[] => {
    const rows: StyledLine[] = [new StyledLine()];

    // Split into words (space/newline boundaries)
    type Word = { end: number; start: number };
    const words: Word[] = [];
    let wordStart = 0;
    let inWord = false;

    for (let i = 0; i < line.length; i++) {
        const val = line.getValue(i);

        if (val === "\n" || val === " ") {
            if (inWord) {
                words.push({ end: i, start: wordStart });
                inWord = false;
            }

            // Space/newline is its own "word"
            words.push({ end: i + 1, start: i });
        } else if (!inWord) {
            wordStart = i;
            inWord = true;
        }
    }

    if (inWord) {
        words.push({ end: line.length, start: wordStart });
    }

    let isAtStartOfLogicalLine = true;

    for (const word of words) {
        const wordSlice = line.slice(word.start, word.end);
        const firstVal = line.getValue(word.start);

        if (firstVal === "\n") {
            rows.push(new StyledLine());
            isAtStartOfLogicalLine = true;
            continue;
        }

        const wordWidth = styledLineWidth(wordSlice);
        const rowWidth = styledLineWidth(rows.at(-1)!);

        if (rowWidth + wordWidth > columns) {
            if (!isAtStartOfLogicalLine && firstVal === " " && word.end - word.start === 1) {
                continue;
            }

            // Remove trailing spaces from current line
            if (!isAtStartOfLogicalLine) {
                const currentRow = rows.at(-1)!;
                let trimIdx = currentRow.length;

                while (trimIdx > 0 && currentRow.getValue(trimIdx - 1) === " ") {
                    trimIdx--;
                }

                if (trimIdx < currentRow.length) {
                    rows[rows.length - 1] = currentRow.slice(0, trimIdx);
                }
            }

            if (wordWidth > columns) {
                // Word is wider than column — break it character by character
                if (rowWidth > 0) {
                    rows.push(new StyledLine());
                }

                wrapWordStyledLine(rows, wordSlice, columns);
            } else {
                rows.push(wordSlice.clone());
            }
        } else {
            // Append word to current row
            const currentRow = rows.at(-1)!;

            if (currentRow.length === 0) {
                rows[rows.length - 1] = wordSlice.clone();
            } else {
                rows[rows.length - 1] = currentRow.combine(wordSlice);
            }
        }

        if (isAtStartOfLogicalLine && !(firstVal === " " && word.end - word.start === 1)) {
            isAtStartOfLogicalLine = false;
        }
    }

    return rows;
};

/**
 * Break a single word across multiple lines when it's wider than columns.
 */
const wrapWordStyledLine = (rows: StyledLine[], word: StyledLine, columns: number): void => {
    let currentRow = rows.at(-1)!;
    let visible = styledLineWidth(currentRow);

    for (let i = 0; i < word.length; i++) {
        const charWidth = inkCharacterWidth(word.getValue(i));

        if (visible + charWidth > columns && visible > 0) {
            rows.push(new StyledLine());
            currentRow = rows.at(-1)!;
            visible = 0;
        }

        const charSlice = word.slice(i, i + 1);

        if (currentRow.length === 0) {
            rows[rows.length - 1] = charSlice;
            currentRow = charSlice;
        } else {
            const combined = currentRow.combine(charSlice);

            rows[rows.length - 1] = combined;
            currentRow = combined;
        }

        visible += charWidth;
    }
};
