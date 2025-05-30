import type { GridOptionsWithDefaults } from "../grid";
import type { GridItem } from "../types";
import calculateCellTotalWidth from "./calculate-cell-total-width";
import determineCellVerticalPosition from "./determine-cell-vertical-position";

/**
 * A function that aligns cell content based on available width.
 * @param cell The grid item containing content and options.
 * @param totalWidth The total calculated width available for the cell.
 * @returns An array of strings, each representing a processed line.
 */
type AlignCellContentFunction = (cell: GridItem, totalWidth: number) => string[];

/**
 * A function that finds the first row index where a given cell instance appears.
 * @param gridLayout The grid layout.
 * @param rowIndex The starting row index for the search.
 * @param colIndex The starting column index for the search.
 * @param cell The cell instance to find.
 * @returns The row index of the first occurrence.
 */
type FindFirstOccurrenceRowFunction = (gridLayout: (GridItem | null)[][], rowIndex: number, colIndex: number, cell: GridItem) => number;

/**
 * Calculates the required visual height (number of lines) for each logical row in a grid.
 * Handles cells spanning multiple rows and ensures enough total height is allocated,
 * considering fixed row heights.
 * @param gridLayout The grid layout array, potentially sparse.
 * @param columnWidths The calculated widths for each column.
 * @param options Grid options with defaults applied.
 * @param alignCellContent Function to align cell content and return lines.
 * @param findFirstOccurrenceRow Function to find the first row a cell appears in.
 * @returns An array where each index corresponds to a logical row index and the value is its visual height.
 */
const calculateRowHeights = (
    gridLayout: (GridItem | null)[][],
    columnWidths: number[],
    options: GridOptionsWithDefaults,
    alignCellContent: AlignCellContentFunction,
    findFirstOccurrenceRow: FindFirstOccurrenceRowFunction,
    // eslint-disable-next-line sonarjs/cognitive-complexity
): number[] => {
    if (gridLayout.length === 0) {
        return [];
    }

    // Determine the maximum row index occupied by any cell.
    let maxRowIndex = gridLayout.length - 1;

    for (let r = 0; r < gridLayout.length; r++) {
        const row = gridLayout[r];

        if (!row) {
            continue;
        }

        for (const [c, cell] of row.entries()) {
            if (cell && findFirstOccurrenceRow(gridLayout, r, c, cell) === r) {
                const verticalPosition = determineCellVerticalPosition(gridLayout, r, c, cell);

                maxRowIndex = Math.max(maxRowIndex, verticalPosition.lastRow);
            }
        }
    }

    // Initialize rowHeights array with minimum height 1.
    const rowHeights: number[] = Array.from<number>({ length: maxRowIndex + 1 }).fill(1);

    // Initial Pass - Calculate height for SINGLE-ROW cells only
    for (let rowIndex = 0; rowIndex < gridLayout.length; rowIndex++) {
        const row = gridLayout[rowIndex];

        if (!row) {
            continue;
        }

        for (let colIndex = 0; colIndex < options.columns; colIndex++) {
            const cell = row[colIndex];

            // Process only if it's the start of a SINGLE-ROW cell
            if (cell && findFirstOccurrenceRow(gridLayout, rowIndex, colIndex, cell) === rowIndex && (cell.rowSpan ?? 1) === 1) {
                const colSpan = cell.colSpan ?? 1;
                const currentCellTotalWidth = calculateCellTotalWidth(columnWidths, colIndex, colSpan);
                const processedLines = alignCellContent(cell, currentCellTotalWidth);
                const requiredTotalHeight = processedLines.length;

                rowHeights[rowIndex] = Math.max(rowHeights[rowIndex] ?? 1, requiredTotalHeight);
            }
        }
    }

    // Apply Fixed Row Heights
    const isRowFixed: boolean[] = Array.from<boolean>({ length: rowHeights.length }).fill(false);

    if (options.fixedRowHeights) {
        for (let index = 0; index < rowHeights.length; index++) {
            let fixedHeight: number | null | undefined = null;

            if (options.fixedRowHeights[index] !== undefined && options.fixedRowHeights[index] !== null) {
                fixedHeight = options.fixedRowHeights[index];
            } else if (options.fixedRowHeights.length === 1 && options.fixedRowHeights[0] !== undefined && options.fixedRowHeights[0] !== null) {
                // eslint-disable-next-line prefer-destructuring
                fixedHeight = options.fixedRowHeights[0];
            }

            if (fixedHeight !== undefined && fixedHeight !== null) {
                rowHeights[index] = Math.max(1, fixedHeight);

                isRowFixed[index] = true;
            }
        }
    }

    // Distribute Deficit for SPANNING Cells
    // Iterate through grid again to process spanning cells in a defined order
    for (let rowIndex = 0; rowIndex < gridLayout.length; rowIndex++) {
        const row = gridLayout[rowIndex];

        if (!row) {
            continue;
        }

        for (let colIndex = 0; colIndex < options.columns; colIndex++) {
            const cell = row[colIndex];

            // Process only if it's the START of a SPANNING cell
            if (cell && findFirstOccurrenceRow(gridLayout, rowIndex, colIndex, cell) === rowIndex && (cell.rowSpan ?? 1) > 1) {
                const colSpan = cell.colSpan ?? 1;
                const currentCellTotalWidth = calculateCellTotalWidth(columnWidths, colIndex, colSpan);
                const processedLines = alignCellContent(cell, currentCellTotalWidth);
                const requiredTotalHeight = processedLines.length - 1;

                const verticalPosition = determineCellVerticalPosition(gridLayout, rowIndex, colIndex, cell);
                // Use verticalPosition determined start/end rows
                const { firstRow, lastRow } = verticalPosition;

                let currentAllocatedHeight = 0;
                let nonFixedRowCount = 0;

                // Calculate current height and non-fixed count for the actual span range
                for (let r = firstRow; r <= lastRow && r < rowHeights.length; r++) {
                    currentAllocatedHeight += rowHeights[r] ?? 1;

                    // Use the isRowFixed array calculated in Step 2

                    if (!isRowFixed[r]) {
                        nonFixedRowCount++;
                    }
                }

                const deficit = requiredTotalHeight - currentAllocatedHeight;

                if (deficit > 0) {
                    if (nonFixedRowCount > 0) {
                        // Distribute deficit proportionally among non-fixed rows
                        const deficitPerNonFixedRow = Math.ceil(deficit / nonFixedRowCount);

                        let addedDeficit = 0;

                        // Distribute only over the actual span range
                        for (let r = firstRow; r <= lastRow && r < rowHeights.length; r++) {
                            // Use the isRowFixed array calculated in Step 2

                            if (!isRowFixed[r]) {
                                const amountToAdd = Math.min(deficitPerNonFixedRow, deficit - addedDeficit);

                                rowHeights[r] = (rowHeights[r] ?? 1) + amountToAdd;
                                addedDeficit += amountToAdd;

                                if (addedDeficit >= deficit) {
                                    break;
                                }
                            }
                        }
                    } else {
                        // All rows in span are fixed, content won't fit.
                        // eslint-disable-next-line no-console
                        console.warn(
                            `[calculateRowHeights] Content of spanning cell exceeds fixed height allocated. `
                            + `Cell: ${JSON.stringify(cell.content)}, `
                            + `Required: ${String(requiredTotalHeight)}, Allocated: ${String(currentAllocatedHeight)} (fixed).`,
                        );
                    }
                }
            }
        }
    }

    return rowHeights;
};

export default calculateRowHeights;
