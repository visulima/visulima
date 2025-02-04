import type { Cell as CellType , LayoutCell } from "./types";

/** Computes the logical width of a row (the sum of colSpans, defaulting to 1 per cell). */
export function computeRowLogicalWidth(row: CellType[]): number {
    // eslint-disable-next-line unicorn/no-array-reduce
    return row.reduce((total: number, cell: CellType) => {
        if (cell === null) {
            return total + 1;
        }

        if (typeof cell === "object" && !Array.isArray(cell)) {
            return total + (cell.colSpan ?? 1);
        }

        return total + 1;
    }, 0);
}

/** Pads a row with null cells so that its logical width equals targetWidth. */
export function fillRowToWidth(row: CellType[], targetWidth: number): CellType[] {
    const currentWidth = computeRowLogicalWidth(row);

    if (currentWidth < targetWidth) {
        return [...row, ...Array.from({length: targetWidth - currentWidth}).fill(null)] as CellType[];
    }

    return row;
}

/** Returns the underlying "real" cell (if a span cell, returns its parent). */
export function getRealCell(layoutCell: LayoutCell | null): LayoutCell | null {
    if (!layoutCell) {
        return null;
    }

    if (layoutCell.isSpanCell && layoutCell.parentCell) {
        return layoutCell.parentCell;
    }

    return layoutCell;
}

/** Checks whether two layout cells represent the same originating cell. */
export function areCellsEquivalent(cellA: LayoutCell | null, cellB: LayoutCell | null): boolean {
    const realA = getRealCell(cellA);
    const realB = getRealCell(cellB);
    return realA === realB;
}
