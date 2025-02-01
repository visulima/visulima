import type { Cell as CellType, CellOptions } from "./types";

export interface LayoutCell extends CellOptions {
    x: number;
    y: number;
    width: number;
    height: number;
    isSpanCell?: boolean;
    parentCell?: LayoutCell;
}

export interface TableLayout {
    cells: LayoutCell[];
    width: number;
    height: number;
}

/**
 * Tracks cell positions and handles allocation of space in the table
 */
class CellTracker {
    private allocation: Map<string, LayoutCell> = new Map();

    isPositionOccupied(x: number, y: number): boolean {
        return this.allocation.has(`${x},${y}`);
    }

    occupyPosition(x: number, y: number, cell: LayoutCell): void {
        this.allocation.set(`${x},${y}`, cell);
    }

    getCellAt(x: number, y: number): LayoutCell | undefined {
        return this.allocation.get(`${x},${y}`);
    }

    findNextAvailablePosition(startX: number, y: number): number {
        let x = startX;
        while (this.isPositionOccupied(x, y)) {
            x++;
        }
        return x;
    }
}

/**
 * Creates a layout cell from a cell configuration
 */
function createLayoutCell(cell: CellType, x: number, y: number): LayoutCell {
    const normalizedCell = typeof cell === "object" && cell !== null ? cell : { content: String(cell) };

    return {
        ...normalizedCell,
        x,
        y,
        width: normalizedCell.colSpan ?? 1,
        height: normalizedCell.rowSpan ?? 1,
        content: String(normalizedCell.content ?? ""),
    };
}

/**
 * Creates span cells for a parent cell
 */
function createSpanCells(parentCell: LayoutCell): LayoutCell[] {
    const spanCells: LayoutCell[] = [];

    for (let y = parentCell.y; y < parentCell.y + parentCell.height; y++) {
        for (let x = parentCell.x; x < parentCell.x + parentCell.width; x++) {
            // Skip the parent cell position
            if (x === parentCell.x && y === parentCell.y) continue;

            spanCells.push({
                x,
                y,
                width: 1,
                height: 1,
                content: "",
                isSpanCell: true,
                parentCell,
            });
        }
    }

    return spanCells;
}

/**
 * Calculates the dimensions of the table
 */
function calculateTableDimensions(cells: LayoutCell[]): { width: number; height: number } {
    let maxWidth = 0;
    let maxHeight = 0;

    for (const cell of cells) {
        maxWidth = Math.max(maxWidth, cell.x + cell.width);
        maxHeight = Math.max(maxHeight, cell.y + cell.height);
    }

    return { width: maxWidth, height: maxHeight };
}

/**
 * Creates a complete table layout from raw rows
 */
export function createTableLayout(rows: CellType[][]): TableLayout {
    const tracker = new CellTracker();
    const layoutCells: LayoutCell[] = [];

    // Process each row
    for (let y = 0; y < rows.length; y++) {
        const row = rows[y];
        let x = 0;

        // Process each cell in the row
        for (const cell of row) {
            // Find next available position
            x = tracker.findNextAvailablePosition(x, y);

            // Create and add the main cell
            const layoutCell = createLayoutCell(cell, x, y);
            layoutCells.push(layoutCell);

            // Create and add span cells
            const spanCells = createSpanCells(layoutCell);
            layoutCells.push(...spanCells);

            // Mark all positions as occupied
            for (let spanY = y; spanY < y + layoutCell.height; spanY++) {
                for (let spanX = x; spanX < x + layoutCell.width; spanX++) {
                    tracker.occupyPosition(spanX, spanY, layoutCell);
                }
            }

            // Move to the next cell position
            x += layoutCell.width;
        }
    }

    // Calculate table dimensions
    const { width, height } = calculateTableDimensions(layoutCells);

    return {
        cells: layoutCells,
        width,
        height,
    };
}

/**
 * Gets all cells in a specific row
 */
export function getCellsInRow(layout: TableLayout, rowIndex: number): LayoutCell[] {
    return layout.cells
        .filter(cell => cell.y === rowIndex)
        .sort((a, b) => a.x - b.x);
}

/**
 * Gets all cells in a specific column
 */
export function getCellsInColumn(layout: TableLayout, columnIndex: number): LayoutCell[] {
    return layout.cells
        .filter(cell => cell.x === columnIndex)
        .sort((a, b) => a.y - b.y);
}

/**
 * Gets the effective width of a column considering spans
 */
export function getColumnWidth(layout: TableLayout, columnIndex: number): number {
    return Math.max(
        ...layout.cells
            .filter(cell => cell.x <= columnIndex && cell.x + cell.width > columnIndex)
            .map(cell => cell.width)
    );
}

/**
 * Gets the effective height of a row considering spans
 */
export function getRowHeight(layout: TableLayout, rowIndex: number): number {
    return Math.max(
        ...layout.cells
            .filter(cell => cell.y <= rowIndex && cell.y + cell.height > rowIndex)
            .map(cell => cell.height)
    );
}
