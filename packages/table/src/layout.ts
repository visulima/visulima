import type { Cell as CellType, LayoutCell, TableLayout } from "./types";

/** Creates a layout cell from a given cell configuration. */
function createLayoutCell(cell: CellType, column: number, row: number): LayoutCell {
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
export function createTableLayout(rows: CellType[][]): TableLayout {
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

    for (const row of rows) {
        // We track where we place each cell. colPointer moves left to right.
        let colPointer = 0;
        for (const cellValue of row) {
            if (cellValue == null) {
                // This 'slot' is presumably covered by a spanning cell
                colPointer += 1;
                continue;
            }
            // Find the first free column for this row
            // (Simple approach: assume no collisions because the user input is correct.)
            const layoutCell = createLayoutCell(cellValue, colPointer, rowIndex);
            layoutCells.push(layoutCell);

            // Insert placeholder cells for all covered positions except the top-left
            for (let ry = rowIndex; ry < rowIndex + layoutCell.height; ry++) {
                for (let rx = colPointer; rx < colPointer + layoutCell.width; rx++) {
                    if (rx === colPointer && ry === rowIndex) {
                        // the real cell
                        continue;
                    }
                    // placeholder
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
