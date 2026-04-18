import type { CanvasContext, CellStyle } from "./buffer";

/**
 * Each terminal cell holds a 2x4 braille sub-grid:
 * ```
 * (0,0) (1,0)
 * (0,1) (1,1)
 * (0,2) (1,2)
 * (0,3) (1,3)
 * ```
 * The braille block starts at U+2800; each lit pixel contributes one bit.
 */
const BRAILLE_BASE = 0x28_00;

// Bit layout for a (col, row) pixel inside a 2x4 cell (Unicode braille patterns).
const BRAILLE_BITS: ReadonlyArray<number> = [
    0x01,
    0x08, // row 0: col 0, col 1
    0x02,
    0x10, // row 1
    0x04,
    0x20, // row 2
    0x40,
    0x80, // row 3
];

export type BrailleGrid = {
    readonly cellHeight: number;
    readonly cellWidth: number;
    readonly clear: () => void;

    /**
     * Flush the accumulated pixels into the canvas, one braille character per
     * dirtied cell. Pass a color via `style` to apply it uniformly (mixing
     * colors across overlapping series requires a separate grid per series).
     */
    readonly flush: (context: CanvasContext, style?: CellStyle) => void;
    readonly pixelHeight: number;
    readonly pixelWidth: number;
    readonly plotLine: (x0: number, y0: number, x1: number, y1: number) => void;
    readonly plotPoint: (x: number, y: number) => void;
};

/**
 * Accumulator for braille-rendered charts. Tracks which sub-pixels are lit
 * and emits a braille character per dirtied cell on `flush`. Designed to be
 * allocated per chart render and thrown away.
 */
export const createBrailleGrid = (cellWidth: number, cellHeight: number): BrailleGrid => {
    const pixelWidth = Math.max(0, cellWidth * 2);
    const pixelHeight = Math.max(0, cellHeight * 4);
    const bits = new Uint8Array(cellWidth * cellHeight);
    const dirty = new Uint8Array(cellWidth * cellHeight);

    const plotPoint = (x: number, y: number): void => {
        if (x < 0 || y < 0 || x >= pixelWidth || y >= pixelHeight) {
            return;
        }

        const cellX = Math.floor(x / 2);
        const cellY = Math.floor(y / 4);
        const subX = x % 2;
        const subY = y % 4;
        const bit = BRAILLE_BITS[subY * 2 + subX]!;
        const index = cellY * cellWidth + cellX;

        if ((bits[index]! & bit) === 0) {
            bits[index] = (bits[index] ?? 0) | bit;
            dirty[index] = 1;
        }
    };

    /**
     * Plot a line on the pixel grid via Bresenham's algorithm.
     */
    const plotLine = (x0: number, y0: number, x1: number, y1: number): void => {
        let x = Math.round(x0);
        let y = Math.round(y0);
        const endX = Math.round(x1);
        const endY = Math.round(y1);
        const dx = Math.abs(endX - x);
        const sx = x < endX ? 1 : -1;
        const dy = -Math.abs(endY - y);
        const sy = y < endY ? 1 : -1;
        let error = dx + dy;

        while (true) {
            plotPoint(x, y);

            if (x === endX && y === endY) {
                break;
            }

            const error2 = 2 * error;

            if (error2 >= dy) {
                if (x === endX) {
                    break;
                }

                error += dy;
                x += sx;
            }

            if (error2 <= dx) {
                if (y === endY) {
                    break;
                }

                error += dx;
                y += sy;
            }
        }
    };

    return {
        cellHeight,
        cellWidth,
        clear: () => {
            bits.fill(0);
            dirty.fill(0);
        },
        flush: (context, style) => {
            for (const [index, bit] of bits.entries()) {
                if (dirty[index] === 0) {
                    continue;
                }

                const cellX = index % cellWidth;
                const cellY = Math.floor(index / cellWidth);
                const codepoint = BRAILLE_BASE + bit;

                context.setCell(cellX, cellY, codepoint, style);
            }
        },
        pixelHeight,
        pixelWidth,
        plotLine,
        plotPoint,
    };
};
