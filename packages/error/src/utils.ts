const getLineOffsets = (text: string): number[] => {
    const lineOffsets = [];
    let isLineStart = true;

    // eslint-disable-next-line no-plusplus,no-loops/no-loops
    for (let index = 0; index < text.length; index++) {
        if (isLineStart) {
            lineOffsets.push(index);
            isLineStart = false;
        }

        const ch = text.charAt(index);

        isLineStart = ch === "\r" || ch === "\n";

        if (ch === "\r" && index + 1 < text.length && text.charAt(index + 1) === "\n") {
            // eslint-disable-next-line no-plusplus
            index++;
        }
    }

    if (isLineStart && text.length > 0) {
        lineOffsets.push(text.length);
    }

    return lineOffsets;
};

export const normalizeLF = (code: string): string => code.replaceAll(/\r\n|\r(?!\n)|\n/gu, "\n");

/**
 * Get the line and character based on the offset
 * @param offset The index of the position
 * @param text The text for which the position should be retrieved
 */
export const positionAt = (
    offset: number,
    text: string,
): {
    column: number;
    line: number;
} => {
    const lineOffsets = getLineOffsets(text);

    // eslint-disable-next-line no-param-reassign
    offset = Math.max(0, Math.min(text.length, offset));

    let low = 0;
    let high = lineOffsets.length;

    if (high === 0) {
        return {
            column: offset,
            line: 0,
        };
    }

    // eslint-disable-next-line no-loops/no-loops
    while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        // eslint-disable-next-line security/detect-object-injection
        const lineOffset = lineOffsets[mid] as number;

        if (lineOffset === offset) {
            return {
                column: 0,
                line: mid,
            };
        }

        if (offset > lineOffset) {
            low = mid + 1;
        } else {
            high = mid - 1;
        }
    }

    // low is the least x for which the line offset is larger than the current offset
    // or array.length if no line offset is larger than the current offset
    const line = low - 1;

    // eslint-disable-next-line security/detect-object-injection
    return { column: offset - (lineOffsets[line] as number), line };
};
