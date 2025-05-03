import type { GridItem } from "../types";

/**
 * Finds the first row index where the given cell appears in the specified column.
 * @param gridLayout The grid layout array.
 * @param startRow The row index to start searching from.
 * @param startCol The column index of the cell.
 * @param cell The cell to search for.
 * @returns The first row index where the cell appears in the column.
 */
const findFirstOccurrenceRow = (gridLayout: (GridItem | null)[][], startRow: number, startCol: number, cell: GridItem): number => {
    let firstRow = startRow;

    // eslint-disable-next-line security/detect-object-injection
    while (firstRow > 0 && gridLayout[firstRow - 1]?.[startCol] === cell) {
        firstRow -= 1;
    }

    return firstRow;
};

export default findFirstOccurrenceRow;
