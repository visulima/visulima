/* eslint-disable no-bitwise */
/* eslint-disable @typescript-eslint/no-non-null-assertion */

/**
 * Maps a source offset to a line and column.
 *
 * Errors already carry a resolved position, so this exists for callers that
 * hold offsets of their own — an editor mapping a node's span to a cursor
 * position, or a linter reporting against its own ranges. The parser fills it
 * in as it scans, which costs one array push per line and only when a counter
 * was supplied.
 */
class LineCounter {
    /** Offset at which each line begins. Line 1 always starts at 0. */
    public lineStarts: number[] = [0];

    /**
     * Record the start of a new line.
     *
     * The parser re-scans on a speculative parse or a rewind, so the same break
     * can arrive more than once. Line starts are strictly increasing, so an
     * offset that is not past the last one has already been seen.
     */
    public addNewLine(offset: number): void {
        if (offset > this.lineStarts[this.lineStarts.length - 1]!) {
            this.lineStarts.push(offset);
        }
    }

    /**
     * Resolve an offset to a 1-indexed line and column.
     *
     * Binary search rather than a scan, so a lookup stays cheap on a large
     * document even when a caller resolves many offsets.
     */
    public linePos(offset: number): { col: number; line: number } {
        let low = 0;
        let high = this.lineStarts.length - 1;

        while (low < high) {
            const middle = (low + high + 1) >> 1;

            if (this.lineStarts[middle]! <= offset) {
                low = middle;
            } else {
                high = middle - 1;
            }
        }

        return { col: offset - this.lineStarts[low]! + 1, line: low + 1 };
    }
}

// eslint-disable-next-line import/prefer-default-export
export { LineCounter };
