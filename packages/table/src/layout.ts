import type { Cell as CellType, LayoutCell, TableLayout } from "./types";

/** Creates a layout cell from a given cell configuration. */
const createLayoutCell = (cell: CellType, column: number, row: number): LayoutCell => {
    const normalizedCell = typeof cell === "object" && cell !== null ? cell : { content: String(cell) };

    return {
        ...normalizedCell,
        content: String(normalizedCell.content ?? ""),
        height: normalizedCell.rowSpan ?? 1,
        width: normalizedCell.colSpan ?? 1,
        x: column,
        y: row,
    };
}

/**
 * Creates a list of layout cells from a 2D array of rows (CellType[][]).
 * Also inserts "span cells" (placeholders) for the covered columns/rows.
 */
// eslint-disable-next-line sonarjs/cognitive-complexity
const createTableLayout = (rows: CellType[][]): TableLayout => {
    // Step 1: figure out the total columns by max sum of colSpans in any row
    let maxCols = 0;
    for (const row of rows) {
        let sum = 0;
        for (const cell of row) {
            if (cell === null || cell === undefined) {
                sum += 1;
            } else if (typeof cell === "object" && !Array.isArray(cell)) {
                sum += cell.colSpan ?? 1;
            } else {
                sum += 1;
            }
        }
        maxCols = Math.max(maxCols, sum);
    }

    // Step 2: build out the cells
    const layoutCells: LayoutCell[] = [];
    let rowIndex = 0;
    
    // Create a grid to track occupied positions
    const occupiedPositions: Record<string, LayoutCell> = {};
    
    // Helper function to check if a position is occupied
    const isPositionOccupied = (x: number, y: number): boolean => {
        return occupiedPositions[`${x},${y}`] !== undefined;
    };
    
    // Helper function to mark a position as occupied
    const markPositionOccupied = (x: number, y: number, cell: LayoutCell): void => {
        occupiedPositions[`${x},${y}`] = cell;
    };

    for (const row of rows) {
        // We track where we place each cell. colPointer moves left to right.
        let colPointer = 0;
        for (const cellValue of row) {
            if (cellValue == null) {
                // This 'slot' is presumably covered by a spanning cell
                colPointer += 1;
                continue;
            }
            
            // Skip over any positions already occupied by spans from earlier rows
            while (colPointer < maxCols && isPositionOccupied(colPointer, rowIndex)) {
                colPointer += 1;
            }
            
            // If we reached the end of the row, break out
            if (colPointer >= maxCols) {
                break;
            }
            
            // Create a layout cell for this position
            const layoutCell = createLayoutCell(cellValue, colPointer, rowIndex);
            layoutCells.push(layoutCell);
            
            // Mark all positions covered by this cell as occupied
            for (let ry = rowIndex; ry < rowIndex + layoutCell.height; ry++) {
                for (let rx = colPointer; rx < colPointer + layoutCell.width; rx++) {
                    markPositionOccupied(rx, ry, layoutCell);
                }
            }

            // Insert placeholder cells for all covered positions except the top-left
            for (let ry = rowIndex; ry < rowIndex + layoutCell.height; ry++) {
                for (let rx = colPointer; rx < colPointer + layoutCell.width; rx++) {
                    if (rx === colPointer && ry === rowIndex) {
                        // the real cell - already added
                        continue;
                    }
                    // placeholder cell
                    layoutCells.push({
                        content: "",
                        height: 1,
                        isSpanCell: true,
                        parentCell: layoutCell,
                        width: 1,
                        x: rx,
                        y: ry,
                    });
                }
            }

            colPointer += layoutCell.width;
        }
        rowIndex++;
    }

    // Step 3: total table height is the number of rows
    // (But some cells might extend downward. We'll find the max.)
    let maxRow = rows.length;
    for (const c of layoutCells) {
        maxRow = Math.max(maxRow, c.y + c.height);
    }

    // Step 4: return the structure
    return {
        cells: layoutCells,
        height: maxRow,
        width: maxCols,
    };
}

export default createTableLayout;
