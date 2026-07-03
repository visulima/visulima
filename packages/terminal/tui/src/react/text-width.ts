import { getStringWidth as visulimaGetStringWidth } from "@visulima/string";

// Terminal convention: ambiguous-width and text-emoji characters (e.g. ▪ ● ◆ ◀ ▶)
// are 1 cell wide. True graphical emoji (👋 🐭) are still 2 cells.
const WIDTH_OPTIONS = { ambiguousIsNarrow: true, emojiWidth: 1 } as const;

/** Display width of a single Unicode code point (at least 1 cell). */
export function getCodePointWidth(char: string): number {
    return Math.max(1, visulimaGetStringWidth(char, WIDTH_OPTIONS));
}

/** Display width of a full string (sums grapheme widths). */
export function getStringWidth(text: string): number {
    return visulimaGetStringWidth(text, WIDTH_OPTIONS);
}

/**
 * Count wrapped visual rows for a single hard line (no '\n') at a fixed width.
 *
 * - Widths are measured in terminal cells, not UTF-16 code units.
 * - Wide chars (CJK/emoji) consume 2 cells.
 * - Empty lines still occupy one visual row.
 */
export function countWrappedRowsForLine(line: string, width: number): number {
    if (width <= 0) {
        return 0;
    }

    if (line.length === 0) {
        return 1;
    }

    let rows = 1;
    let col = 0;

    for (const char of line) {
        const charWidth = Math.min(getCodePointWidth(char), width);

        if (col + charWidth > width) {
            rows++;
            col = 0;
        }

        col += charWidth;
    }

    return rows;
}

/**
 * Measure the max visual line width and wrapped height of a text block.
 * Returns widths/heights in terminal cells/rows.
 */
export function measureTextBlock(text: string, wrapWidth: number): { maxLineWidth: number; wrappedRows: number } {
    const lines = text.split("\n");
    let maxLineWidth = 0;
    let wrappedRows = 0;

    for (const line of lines) {
        const lineWidth = getStringWidth(line);

        if (lineWidth > maxLineWidth) {
            maxLineWidth = lineWidth;
        }

        wrappedRows += wrapWidth > 0 ? countWrappedRowsForLine(line, wrapWidth) : 0;
    }

    return { maxLineWidth, wrappedRows };
}
