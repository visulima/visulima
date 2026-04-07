/**
 * StyledLine-based text wrapping and truncation.
 *
 * Operates directly on StyledLine objects to preserve ANSI styling through
 * wrap boundaries.
 *
 * Ported from jacob314/ink fork (Google LLC, Apache-2.0).
 */

import { inkCharacterWidth, styledLineWidth } from "./measure-text";
import { StyledLine } from "./styled-line";

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
        let startIndex = line.length;

        for (let i = line.length - 1; i >= 0; i--) {
            width += inkCharacterWidth(line.getValue(i));

            if (width > columns - 1) {
                break;
            }

            startIndex = i;
        }

        return ellipsis.combine(line.slice(startIndex));
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
    let endIndex = 0;
    let w = 0;

    for (let i = 0; i < line.length; i++) {
        const cw = inkCharacterWidth(line.getValue(i));

        if (w + cw > columns - 1) {
            break;
        }

        w += cw;
        endIndex = i + 1;
    }

    return line.slice(0, endIndex).combine(ellipsis);
};

/**
 * Word-wrap a StyledLine at column boundaries. Uses index-based tracking
 * and only calls line.slice() when emitting a finished row — avoids creating
 * intermediate StyledLine objects for each word.
 *
 * Ported from jacob314/ink (Google LLC, Apache-2.0).
 */
const wrapStyledLine = (line: StyledLine, columns: number): StyledLine[] => {
    const rows: StyledLine[] = [];
    let currentRowStart = 0;
    let currentRowWidth = 0;
    let isAtStartOfLogicalLine = true;

    let i = 0;

    while (i < line.length) {
        const firstValue = line.getValue(i);

        if (firstValue === "\n") {
            rows.push(line.slice(currentRowStart, i));
            currentRowStart = i + 1;
            currentRowWidth = 0;
            isAtStartOfLogicalLine = true;
            i++;
            continue;
        }

        // Find word/delimiter boundary
        let j = i;
        let wordWidth = 0;

        if (firstValue === " ") {
            wordWidth = inkCharacterWidth(" ");
            j = i + 1;
        } else {
            while (j < line.length && line.getValue(j) !== " " && line.getValue(j) !== "\n") {
                wordWidth += inkCharacterWidth(line.getValue(j));
                j++;
            }
        }

        // Word/space is [i, j)
        if (currentRowWidth + wordWidth > columns && currentRowWidth > 0) {
            if (firstValue === " " && !isAtStartOfLogicalLine && !line.hasStyles(i)) {
                // Drop unstyled space that causes wrap
                i = j;
                continue;
            }

            // Wrap: finish previous row, trim trailing unstyled spaces
            let trimEnd = i;

            while (trimEnd > currentRowStart && line.getValue(trimEnd - 1) === " " && !line.hasStyles(trimEnd - 1)) {
                trimEnd--;
            }

            rows.push(line.slice(currentRowStart, trimEnd));
            currentRowStart = i;
            currentRowWidth = 0;
            continue;
        }

        if (currentRowWidth === 0 && wordWidth > columns) {
            // Hard wrap long word
            let k = i;
            let chunkWidth = 0;

            while (k < j) {
                const cw = inkCharacterWidth(line.getValue(k));

                if (chunkWidth + cw > columns && chunkWidth > 0) {
                    rows.push(line.slice(currentRowStart, k));
                    currentRowStart = k;
                    chunkWidth = 0;
                }

                chunkWidth += cw;
                k++;
            }

            currentRowWidth = chunkWidth;
            i = j;
            isAtStartOfLogicalLine = false;
        } else {
            // Fit
            currentRowWidth += wordWidth;
            i = j;

            if (firstValue !== " ") {
                isAtStartOfLogicalLine = false;
            }
        }
    }

    if (currentRowStart < line.length || rows.length === 0) {
        rows.push(line.slice(currentRowStart));
    }

    return rows;
};

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
