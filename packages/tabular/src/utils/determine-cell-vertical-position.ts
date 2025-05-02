import type { GridItem } from "../types";

/**
 * Determines the vertical position and content visibility of a cell in a grid layout.
 * @param gridLayout The grid layout array.
 * @param rowIndex Row index of the cell.
 * @param col Column index of the cell.
 * @param cell The cell to check.
 * @returns Object containing content visibility and row bounds.
 */
const determineCellVerticalPosition = (
    gridLayout: (GridItem | null)[][],
    rowIndex: number,
    col: number,
    cell: GridItem,
): { firstRow: number; lastRow: number; showContent: boolean } => {
    let firstRow = rowIndex;

    while (firstRow > 0 && gridLayout[firstRow - 1]?.[col] === cell) {
        firstRow--;
    }

    let lastRow = rowIndex;

    while (lastRow < gridLayout.length - 1 && gridLayout[lastRow + 1]?.[col] === cell) {
        lastRow++;
    }

    let showContent = false;

    const rowSpan = lastRow - firstRow + 1;

    if (rowSpan === 1) {
        showContent = true;
    } else {
        switch (cell.vAlign) {
            case "top": {
                showContent = rowIndex === firstRow;
                break;
            }
            case "middle": {
                const middleRow = firstRow + Math.floor(rowSpan / 2);
                showContent = rowIndex === middleRow;
                break;
            }
            case "bottom": {
                showContent = rowIndex === lastRow;
                break;
            }
            default: {
                showContent = rowIndex === firstRow;
            }
        }
    }

    return { firstRow, lastRow, showContent };
};

export default determineCellVerticalPosition;
