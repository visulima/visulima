import type { TruncateOptions, WordWrapOptions } from "@visulima/string";
// eslint-disable-next-line import/no-extraneous-dependencies
import { getStringWidth, truncate, wordWrap } from "@visulima/string";
// eslint-disable-next-line import/no-extraneous-dependencies
import terminalSize from "terminal-size";

import type {
    AnsiColorFunction,
    AnsiColorObject,
    AutoFlowDirection,
    BorderComponent,
    BorderStyle,
    BorderType,
    GridCell,
    GridItem,
    GridOptions,
    InternalGridItem,
} from "./types";
import { getHorizontalBorderChars, getVerticalBorderChars } from "./utils/border-utilities.ts";
import calculateCellTotalWidth from "./utils/calculate-cell-total-width";
import calculateRowHeights from "./utils/calculate-row-heights";
import determineCellVerticalPosition from "./utils/determine-cell-vertical-position";
import findFirstOccurrenceRow from "./utils/find-first-occurrence-row";
import { EMPTY_CELL_REPRESENTATION, normalizeGridCell } from "./utils/normalize-cell";
import padAndAlignContent from "./utils/pad-and-align-content";

const applyColor = (char: string, color: AnsiColorFunction | AnsiColorObject | null | undefined): string => {
    if (!char || !color) {
        return char;
    }

    if (typeof color === "function") {
        return color(char);
    }

    return color.open + char + color.close;
};

/**
 * Represents GridOptions after defaults have been applied
 * @internal
 */
export type GridOptionsWithDefaults = Omit<GridOptions, "border" | "fixedRowHeights" | "showBorders"> & {
    autoColumns: number;
    autoFlow: AutoFlowDirection;
    autoRows: number;
    border?: BorderStyle;
    defaultTerminalWidth: number;
    fixedRowHeights?: number[];
    gap: number;
    maxWidth?: number;
    paddingLeft: number;
    paddingRight: number;
    rows: number;
    showBorders: boolean;
    terminalWidth?: number;

    truncate: TruncateOptions | boolean;

    wordWrap: WordWrapOptions | boolean;
};

/**
 * A class that represents a grid layout with support for cell spanning, alignment, and borders
 */
export class Grid {
    readonly #options: GridOptionsWithDefaults;

    readonly #items: InternalGridItem[] = [];

    readonly #terminalWidth: number;

    // Cache for alignCellContent results
    readonly #alignCellContentCache = new WeakMap<GridItem, Map<number, string[]>>();

    // Cache for determineCellVerticalPosition results
    readonly #cellVerticalPositionCache = new WeakMap<GridItem, { firstRow: number; lastRow: number }>();

    /**
     * Create the initial grid layout array (will be dynamically sized later)
     * @returns An empty grid layout array
     */
    private static createGridLayout(): (GridItem | null)[][] {
        return [];
    }

    /**
     * Creates a new Grid instance
     * @param options Configuration options for the grid
     */
    public constructor(options: GridOptions) {
        // Apply defaults
        const defaultOptions: Omit<GridOptionsWithDefaults, "border" | "columns" | "fixedColumnWidths"> = {
            autoColumns: 1,
            autoFlow: "row",
            autoRows: 1,
            defaultTerminalWidth: 80,
            gap: 0,
            // maxWidth is optional, handled later
            paddingLeft: 1,
            paddingRight: 1,
            rows: 0, // Default to 0, meaning dynamic rows unless specified
            showBorders: options.border !== undefined,
            // terminalWidth is optional, handled later
            truncate: false,
            wordWrap: false,
        };

        let fixedRowHeights: number[] | undefined;

        if (Array.isArray(options.fixedRowHeights)) {
            fixedRowHeights = options.fixedRowHeights;
        } else if (typeof options.fixedRowHeights === "number") {
            fixedRowHeights = [options.fixedRowHeights];
        }

        this.#options = {
            ...defaultOptions,
            ...options, // User options override defaults
            // Ensure required options are present or derived if possible

            columns: options.columns ?? 1, // Default columns to 1 if not provided
            // Ensure fixedRowHeights is an array if provided as a number
            fixedRowHeights,
            // Recalculate showBorders based on final border presence
            showBorders: options.border !== undefined || (options.showBorders ?? false),
        };

        let { terminalWidth } = this.#options;

        if (terminalWidth === undefined) {
            let { columns } = terminalSize();

            if (columns === 80) {
                columns = this.#options.defaultTerminalWidth;
            }

            terminalWidth = columns;
        }

        this.#terminalWidth = terminalWidth;

        // Handle optional maxWidth relative to terminal width
        if (this.#options.maxWidth) {
            this.#options.maxWidth = Math.min(this.#options.maxWidth, this.#terminalWidth);
        }
    }

    /**
     * Adds a single item to the grid
     * @param cell The cell to add
     * @returns The grid instance for method chaining
     */
    public addItem(cell: GridCell): this {
        this.#items.push(normalizeGridCell(cell));

        return this;
    }

    /**
     * Adds multiple items to the grid
     * @param items Array of items to add
     * @returns The grid instance for method chaining
     */
    public addItems(items: GridCell[]): this {
        this.#items.push(...items.map((item) => normalizeGridCell(item)));

        return this;
    }

    /**
     * Sets the number of columns in the grid
     * @param columns Number of columns
     * @returns The grid instance for method chaining
     */
    public setColumns(columns: number): this {
        this.#options.columns = columns;

        return this;
    }

    /**
     * Sets the number of rows in the grid
     * @param rows Number of rows
     * @returns The grid instance for method chaining
     */
    public setRows(rows: number): this {
        this.#options.rows = rows;

        return this;
    }

    /**
     * Sets the border style for the grid
     * @param border Border style configuration
     * @returns The grid instance for method chaining
     */
    public setBorder(border: BorderStyle): this {
        this.#options.border = border;

        return this;
    }

    /**
     * Sets whether borders should be shown
     * @param show Whether to show borders
     * @returns The grid instance for method chaining
     */
    public setShowBorders(show: boolean): this {
        this.#options.showBorders = show;

        return this;
    }

    /**
     * Sets the maximum width for the grid
     * @param width Maximum width
     * @returns The grid instance for method chaining
     */
    public setMaxWidth(width: number): this {
        this.#options.maxWidth = width;

        return this;
    }

    /**
     * Converts the grid to a string representation
     * @returns A string containing the rendered grid
     */
    public toString(): string {
        const gridLayout = Grid.createGridLayout();

        this.placeItems(gridLayout);

        if (gridLayout.length === 0 || gridLayout[0]?.length === 0) {
            return "";
        }

        let columnWidths = this.calculateColumnWidths(gridLayout);

        const initialTotalGridWidth = this.calculateTotalGridWidth(columnWidths);
        const hasMaxWidthOption = typeof this.#options.maxWidth === "number" && this.#options.maxWidth > 0;
        const effectiveMaxWidth = hasMaxWidthOption ? Math.min(this.#options.maxWidth as number, this.#terminalWidth) : this.#terminalWidth;

        if (initialTotalGridWidth > effectiveMaxWidth) {
            columnWidths = this.adjustColumnWidthsForTerminal(columnWidths, initialTotalGridWidth);
        }

        // Call the separate renderGrid method
        return this.renderGrid(gridLayout, columnWidths);
    }

    /**
     * Places items in the grid layout, finding the next available slot.
     * Modifies the gridLayout array in place, potentially adding rows.
     * It iterates through items and searches row-by-row or column-by-column
     * (depending on autoFlow) for a position where the item fits according
     * to its colSpan and rowSpan, using `canPlaceItem`.
     * @param gridLayout The grid layout array (initially empty or partially filled).
     * Will be modified by placing items into it.
     */
    // eslint-disable-next-line sonarjs/cognitive-complexity
    private placeItems(gridLayout: (GridItem | null)[][]): void {
        let currentRow = 0;
        let currentCol = 0;

        const maxRows = this.#options.rows > 0 ? this.#options.rows : Number.POSITIVE_INFINITY; // Use explicit rows option if set

        for (const item of this.#items) {
            // Skip placement for designated empty cells that don't span
            if (item.content === EMPTY_CELL_REPRESENTATION && !(item.rowSpan && item.rowSpan > 1) && !(item.colSpan && item.colSpan > 1)) {
                if (this.#options.autoFlow === "row") {
                    currentCol += 1;

                    if (currentCol >= this.#options.columns) {
                        currentCol = 0;
                        currentRow += 1;
                    }
                } else {
                    // autoFlow === "column"
                    currentRow += 1;
                    // Wrap based on current grid height or maxRows
                    const effectiveMaxRows = gridLayout.length > 0 ? gridLayout.length : maxRows;

                    if (currentRow >= effectiveMaxRows && effectiveMaxRows !== Number.POSITIVE_INFINITY) {
                        currentRow = 0;
                        currentCol += 1;
                    } else if (gridLayout.length === 0 && effectiveMaxRows === Number.POSITIVE_INFINITY) {
                        // Special case for column flow in an initially empty grid with no row limit
                        currentCol += 1; // Just advance column
                    }
                }

                continue;
            }

            const itemColSpan = item.colSpan ?? 1;
            const itemRowSpan = item.rowSpan ?? 1;

            // Find the next available top-left position for the current item
            let foundPosition = false;
            let searchRow = currentRow;
            let searchCol = currentCol;

            // Safeguard against excessively long searches (e.g., impossible layouts)
            let attempts = 0;
            // Estimate max attempts based on grid size and item spans
            const maxAttempts = (gridLayout.length + itemRowSpan + 5) * this.#options.columns;

            while (!foundPosition && searchRow < maxRows && attempts < maxAttempts) {
                attempts += 1;
                // Ensure the grid layout array is tall enough for the placement check
                while (searchRow + itemRowSpan > gridLayout.length) {
                    gridLayout.push(Array.from<GridItem | null>({ length: this.#options.columns }).fill(null));
                }

                // Check if the item fits at the current search position
                if (this.canPlaceItem(gridLayout, searchRow, searchCol, itemColSpan, itemRowSpan)) {
                    // Place the item in the grid layout
                    this.placeItem(gridLayout, searchRow, searchCol, item);
                    foundPosition = true;

                    // Update the main cursor (currentRow, currentCol) to start the search
                    // for the *next* item from a logical position after the current placement.
                    if (this.#options.autoFlow === "row") {
                        // Move cursor to the right of the placed item on the same row
                        currentCol = searchCol + itemColSpan;
                        currentRow = searchRow;

                        // Wrap to the beginning of the next row if necessary
                        if (currentCol >= this.#options.columns) {
                            currentCol = 0;
                            currentRow += 1;
                        }
                    } else {
                        // autoFlow === "column"
                        // Move cursor below the placed item in the same column
                        currentRow = searchRow + itemRowSpan;
                        currentCol = searchCol;
                        // Wrap to the top of the next column if necessary
                        // Compare against current grid height or specified maxRows
                        const effectiveMaxRows = gridLayout.length > 0 ? gridLayout.length : maxRows;

                        if (currentRow >= effectiveMaxRows) {
                            currentRow = 0;
                            currentCol += 1;
                        }
                    }
                    // Item cannot be placed here, advance the search position
                } else if (this.#options.autoFlow === "row") {
                    searchCol += 1;

                    if (searchCol >= this.#options.columns) {
                        searchCol = 0;
                        searchRow += 1;
                    }
                } else {
                    // autoFlow === "column"
                    searchRow += 1;
                    // Ensure grid is tall enough for the *next* check
                    while (searchRow + itemRowSpan > gridLayout.length) {
                        gridLayout.push(Array.from<GridItem | null>({ length: this.#options.columns }).fill(null));
                    }
                    // Wrap search cursor if it goes past the bottom
                    const effectiveMaxRows = gridLayout.length > 0 ? gridLayout.length : maxRows;

                    if (searchRow >= effectiveMaxRows) {
                        searchRow = 0;
                        searchCol += 1;

                        // Stop searching if we go past the last column
                        if (searchCol >= this.#options.columns) {
                            // This indicates no place could be found within reasonable bounds
                            break; // Exit the while loop for this item
                        }
                    }
                }
            }

            if (!foundPosition) {
                // Warn if an item couldn't be placed after extensive search
                // eslint-disable-next-line no-console
                console.warn(
                    `@visulima/tabular: Could not find position for item: ${JSON.stringify(item)} after ${String(attempts)} attempts. Grid might be too small or layout impossible.`,
                );

                // Advance the main cursor slightly to prevent potential infinite loops
                // if multiple items cannot be placed consecutively.
                if (this.#options.autoFlow === "row") {
                    currentCol += 1;

                    if (currentCol >= this.#options.columns) {
                        currentCol = 0;
                        currentRow += 1;
                    }
                } else {
                    currentRow += 1;
                    const effectiveMaxRows = gridLayout.length > 0 ? gridLayout.length : maxRows;

                    if (currentRow >= effectiveMaxRows) {
                        currentRow = 0;
                        currentCol += 1;
                    }
                }
            }

            // Add safeguard against potential infinite loops in the outer loop
            if (attempts >= maxAttempts) {
                break;
            }
        }

        // Trim any fully empty rows added during placement if rows option was dynamic
        if (this.#options.rows === 0) {
            while (gridLayout.length > 0 && gridLayout.at(-1)?.every((cell) => cell === null)) {
                gridLayout.pop();
            }
        }
    }

    /**
     * Checks if an item can be placed at a specific position
     * @param gridLayout The grid layout array
     * @param startRow Starting row index
     * @param startCol Starting column index
     * @param colSpan Number of columns to span
     * @param rowSpan Number of rows to span
     * @param allowDynamicHeight If true, doesn't fail if startRow+rowSpan exceeds current gridLayout height
     * @returns True if the item can be placed at the position
     */
    private canPlaceItem(
        gridLayout: (GridItem | null)[][],
        startRow: number,
        startCol: number,
        colSpan: number,
        rowSpan: number,
        allowDynamicHeight = false,
    ): boolean {
        if (startCol + colSpan > this.#options.columns) {
            return false;
        }

        for (let row = startRow; row < startRow + rowSpan; row += 1) {
            if (row < gridLayout.length) {
                if (!gridLayout[row]) {
                    // eslint-disable-next-line no-console
                    console.warn(`Grid layout unexpectedly missing row ${String(row)} during canPlaceItem check.`);

                    return false;
                }

                for (let col = startCol; col < startCol + colSpan; col += 1) {
                    if (gridLayout[row]?.[col] !== null) {
                        return false;
                    }
                }
            } else if (!allowDynamicHeight) {
                return false;
            }
        }

        return true;
    }

    /**
     * Places an item in the grid layout
     * @param gridLayout The grid layout array
     * @param startRow Starting row index
     * @param startCol Starting column index
     * @param item The item to place
     */
    private placeItem(gridLayout: (GridItem | null)[][], startRow: number, startCol: number, item: GridItem): void {
        const rowSpan = item.rowSpan ?? 1;
        const colSpan = item.colSpan ?? 1;

        for (let row = startRow; row < startRow + rowSpan; row += 1) {
            while (row >= gridLayout.length) {
                gridLayout.push(Array.from<GridItem | null>({ length: this.#options.columns }).fill(null));
            }

            for (let col = startCol; col < startCol + colSpan; col += 1) {
                if (col < this.#options.columns) {
                    if (!gridLayout[row]) {
                        // eslint-disable-next-line no-console
                        console.error(`Logic error: Row ${String(row)} not found in placeItem despite check.`);
                        // eslint-disable-next-line no-param-reassign
                        gridLayout[row] = Array.from<GridItem | null>({ length: this.#options.columns }).fill(null);
                    }

                    // eslint-disable-next-line no-param-reassign
                    (gridLayout[row] as GridItem[])[col] = item;
                }
            }
        }
    }

    /**
     * Calculates the total width of the grid including columns, gaps, and borders.
     * @param columnWidths {number[]} The array of calculated column widths.
     * @returns The total width of the grid.
     */
    private calculateTotalGridWidth(columnWidths: number[]): number {
        let totalWidth = 0;

        const borderStyle = this.#options.showBorders ? this.#options.border : null;

        if (borderStyle) {
            totalWidth += borderStyle.bodyLeft.width;
            totalWidth += borderStyle.bodyRight.width;
        }

        const numberColumns = columnWidths.length;
        const borderJoinWidth = this.#options.showBorders ? borderStyle?.bodyJoin.width ?? 0 : 0;
        const gapWidth = this.#options.gap;

        for (let colIndex = 0; colIndex < numberColumns; colIndex += 1) {
            totalWidth += columnWidths[colIndex] ?? 0;

            if (colIndex < numberColumns - 1) {
                totalWidth += gapWidth;
                totalWidth += borderJoinWidth;
            }
        }

        return totalWidth;
    }

    /**
     * Adjusts column widths proportionally if the total grid width exceeds the available terminal width or maxWidth.
     * @param columnWidths The initial column widths.
     * @param totalGridWidth The calculated total width of the grid including borders and gaps.
     * @returns The adjusted column widths.
     */
    // eslint-disable-next-line sonarjs/cognitive-complexity
    private adjustColumnWidthsForTerminal(columnWidths: number[], totalGridWidth: number): number[] {
        const hasMaxWidthOption = typeof this.#options.maxWidth === "number" && this.#options.maxWidth > 0;
        const effectiveMaxWidth = hasMaxWidthOption ? Math.min(this.#options.maxWidth ?? 0, this.#terminalWidth) : this.#terminalWidth;

        if (totalGridWidth <= effectiveMaxWidth) {
            return columnWidths;
        }

        let fixedWidth = 0;
        const numberColumns = columnWidths.length;
        const borderStyle = this.#options.showBorders ? this.#options.border : null;

        // Calculate fixed width components (borders and gaps)
        if (borderStyle) {
            fixedWidth += borderStyle.bodyLeft.width;
            fixedWidth += borderStyle.bodyRight.width;
        }

        if (numberColumns > 1) {
            fixedWidth += (numberColumns - 1) * this.#options.gap;

            const innerBorderJoinWidth = borderStyle?.bodyJoin.width ?? 0; // Keep ?? here as borderStyle can be null

            fixedWidth += (numberColumns - 1) * innerBorderJoinWidth;
        }

        // Handle edge case where fixed width exceeds effective max width
        if (fixedWidth >= effectiveMaxWidth) {
            return Array.from<number>({ length: numberColumns }).fill(1); // Minimum width of 1 to prevent complete collapse
        }

        const availableWidth = effectiveMaxWidth - fixedWidth;
        const currentTotalContentWidth = columnWidths.reduce((sum, width) => sum + width, 0);

        if (currentTotalContentWidth === 0) {
            // Distribute evenly if no content
            const widthPerColumn = Math.floor(availableWidth / numberColumns);

            return Array.from<number>({ length: numberColumns }).fill(widthPerColumn);
        }

        // Calculate proportional widths
        const adjustedWidths = columnWidths.map((width) => {
            const proportion = width / currentTotalContentWidth;

            return Math.max(1, Math.floor(availableWidth * proportion));
        });

        // Distribute any remaining width
        let remainingWidth = availableWidth - adjustedWidths.reduce((sum, width) => sum + width, 0);

        if (remainingWidth > 0) {
            // Sort columns by their decimal remainder to distribute remaining width fairly
            const indices = adjustedWidths
                .map((_, index) => {
                    // Calculate proportion safely, avoiding division by zero

                    const proportion = currentTotalContentWidth > 0 ? (columnWidths[index] ?? 0) / currentTotalContentWidth : 1 / numberColumns;

                    return {
                        index,
                        remainder: (availableWidth * proportion) % 1,
                    };
                })
                .toSorted((a, b) => b.remainder - a.remainder);

            for (const { index } of indices) {
                if (remainingWidth <= 0) {
                    break;
                }

                // Add safety check for index bounds before incrementing

                if (adjustedWidths[index] !== undefined) {
                    adjustedWidths[index] += 1;
                    remainingWidth -= 1;
                }
            }
        }

        return adjustedWidths;
    }

    /**
     * Calculate column widths based on content, handling colSpan iteratively.
     * This version prioritizes minimum width based on single-cell content first,
     * then iteratively adjusts for cells spanning multiple columns.
     * @param gridLayout {GridItem[][]} The grid layout.
     * @returns Array of column widths.
     */
    // eslint-disable-next-line sonarjs/cognitive-complexity
    private calculateColumnWidths(gridLayout: (GridItem | null)[][]): number[] {
        // If fixed column widths are provided and match the column count, use them
        if (this.#options.fixedColumnWidths && this.#options.fixedColumnWidths.length === this.#options.columns) {
            return [...this.#options.fixedColumnWidths];
        }

        const columnWidths: number[] = Array.from<number>({ length: this.#options.columns }).fill(0);
        const totalPadding = this.#options.paddingLeft + this.#options.paddingRight;
        const singleInternalJoinWidth = this.#options.gap + (this.#options.showBorders ? this.#options.border?.bodyJoin.width ?? 0 : 0);

        // Calculate minimum width needed for non-spanning cells
        // and track the maximum content width for each column
        for (let colIndex = 0; colIndex < this.#options.columns; colIndex += 1) {
            for (let rowIndex = 0; rowIndex < gridLayout.length; rowIndex += 1) {
                const cell = gridLayout[rowIndex]?.[colIndex];

                // Skip if not a cell start position
                if (
                    !cell
                    || findFirstOccurrenceRow(gridLayout, rowIndex, colIndex, cell) !== rowIndex

                    || (colIndex > 0 && gridLayout[rowIndex]?.[colIndex - 1] === cell)
                ) {
                    continue;
                }

                const colSpan = cell.colSpan ?? 1;
                const cellMaxWidth = cell.maxWidth ?? Number.POSITIVE_INFINITY;
                const lines = String(cell.content ?? "").split(/\r?\n/);

                let contentWidth = 0;

                for (const line of lines) {
                    contentWidth = Math.max(contentWidth, Math.min(getStringWidth(line), cellMaxWidth));
                }

                if (colSpan === 1) {
                    columnWidths[colIndex] = Math.max(columnWidths[colIndex] ?? 0, contentWidth + totalPadding);
                }
            }
        }

        // Handle spanning cells more efficiently
        for (let rowIndex = 0; rowIndex < gridLayout.length; rowIndex += 1) {
            for (let colIndex = 0; colIndex < this.#options.columns; colIndex += 1) {
                const cell = gridLayout[rowIndex]?.[colIndex];

                // Skip if not a cell start position
                if (
                    !cell
                    || findFirstOccurrenceRow(gridLayout, rowIndex, colIndex, cell) !== rowIndex

                    || (colIndex > 0 && gridLayout[rowIndex]?.[colIndex - 1] === cell)
                ) {
                    continue;
                }

                const colSpan = cell.colSpan ?? 1;

                if (colSpan > 1) {
                    const cellMaxWidth = cell.maxWidth ?? Number.POSITIVE_INFINITY;
                    const lines = String(cell.content ?? "").split(/\r?\n/);
                    let contentWidth = 0;

                    for (const line of lines) {
                        contentWidth = Math.max(contentWidth, Math.min(getStringWidth(line), cellMaxWidth));
                    }

                    // Calculate total width currently occupied by the columns this cell will span
                    let currentWidthOfSpannedColumns = 0;

                    for (const width of columnWidths.slice(colIndex, colIndex + colSpan)) {
                        currentWidthOfSpannedColumns += width;
                    }

                    // Calculate the structural width (gaps, borders) within the span using pre-calculated value
                    const structuralWidthWithinSpan = colSpan > 1 ? (colSpan - 1) * singleInternalJoinWidth : 0;

                    // Calculate the minimum width required by the content itself, including padding
                    const requiredWidthForContent = contentWidth + totalPadding;

                    // Calculate the total width required by the spanning cell (content + structure)
                    const requiredTotalWidthForSpan = requiredWidthForContent + structuralWidthWithinSpan;

                    // Calculate the current total width available across the spanned columns + internal structure
                    const currentTotalAvailableWidthForSpan = currentWidthOfSpannedColumns + structuralWidthWithinSpan;

                    // Only adjust if the required total width exceeds the current total available width
                    if (requiredTotalWidthForSpan > currentTotalAvailableWidthForSpan) {
                        const additionalWidthNeeded = requiredTotalWidthForSpan - currentTotalAvailableWidthForSpan;

                        // Distribute additional width needed using Math.ceil for the base
                        const baseAdditionalWidth = Math.floor(additionalWidthNeeded / colSpan);

                        let totalAdded = 0;

                        for (let index = 0; index < colSpan && colIndex + index < this.#options.columns; index += 1) {
                            // Add the calculated base width, but don't exceed the total needed
                            const widthToAdd = Math.min(baseAdditionalWidth, additionalWidthNeeded - totalAdded);

                            columnWidths[colIndex + index] = (columnWidths[colIndex + index] ?? 0) + widthToAdd;

                            totalAdded += widthToAdd;

                            // Stop if we've added enough (handles cases where ceil was too much)
                            if (totalAdded >= additionalWidthNeeded) {
                                break;
                            }
                        }
                    }
                }
            }
        }

        if (this.#options.maxWidth) {
            const totalWidth = this.calculateTotalGridWidth(columnWidths);

            if (totalWidth > this.#options.maxWidth) {
                return this.adjustColumnWidthsForTerminal(columnWidths, totalWidth);
            }
        }

        return columnWidths;
    }

    /**
     * Renders a single *visual* line for a given logical row index.
     * @param gridLayout {GridItem[][]} The grid layout.
     * @param rowIndex The logical row index.
     * @param visualLineIndex The index of the visual line within the logical row to render (0-based).
     * @param columnWidths Calculated column widths.
     * @param rowHeights Calculated visual heights for all logical rows.
     * @returns The string representation of the visual row line.
     */
    // eslint-disable-next-line sonarjs/cognitive-complexity
    private renderVisualRowContent(
        gridLayout: (GridItem | null)[][],
        rowIndex: number,
        visualLineIndex: number,
        columnWidths: number[],
        rowHeights: number[],
    ): string {
        const row = gridLayout[rowIndex];

        if (!row) {
            return "";
        }

        const borderAnsiColor = this.#options.borderColor ?? this.#options.foregroundColor ?? null;

        const lineParts: string[] = []; // Use array for parts
        const borderChars = this.#options.showBorders && this.#options.border ? getVerticalBorderChars(this.#options.border) : null;
        const leftBorderChar = borderChars && borderChars.left.width > 0 ? borderChars.left.char : "";
        const rightBorderChar = borderChars && borderChars.right.width > 0 ? borderChars.right.char : "";
        const joinSeparator = borderChars && borderChars.join.width > 0 ? borderChars.join.char : "";
        const gapString = " ".repeat(this.#options.gap);

        if (leftBorderChar) {
            lineParts.push(applyColor(applyColor(leftBorderChar, borderAnsiColor), this.#options.backgroundColor));
        }

        let col = 0;

        while (col < this.#options.columns) {
            const cell: GridItem | null = row[col] ?? null;

            let currentCellColSpan = 1; // Track the span of the segment being processed
            let segmentToRender = "";

            if (cell) {
                const colSpan: number = cell.colSpan ?? 1;

                currentCellColSpan = colSpan; // Use the cell's actual span

                const firstOccurrenceRow = findFirstOccurrenceRow(gridLayout, rowIndex, col, cell);
                const currentCellTotalWidth = calculateCellTotalWidth(columnWidths, col, colSpan);
                const processedLines = this.alignCellContent(cell, currentCellTotalWidth);
                const actualContentHeight = processedLines.length;
                const verticalPosition = this.getCachedCellVerticalPosition(gridLayout, rowIndex, col, cell);

                if (verticalPosition.firstRow !== firstOccurrenceRow) {
                    // eslint-disable-next-line no-console
                    console.warn(
                        `Mismatch between findFirstOccurrenceRow (${String(firstOccurrenceRow)}) and determineCellVerticalPosition (${String(verticalPosition.firstRow)})`,
                    );
                }

                const totalRowSpanHeight = rowHeights.slice(firstOccurrenceRow, verticalPosition.lastRow + 1).reduce((a, b) => a + b, 0);
                const rowSpanCount = verticalPosition.lastRow - verticalPosition.firstRow + 1;

                let relativeVisualLineIndex = visualLineIndex;
                let bordersCrossed = 0;

                for (let index = firstOccurrenceRow; index < rowIndex; index += 1) {
                    if (index < rowHeights.length) {
                        relativeVisualLineIndex += rowHeights[index] ?? 1;
                    }

                    if (index < verticalPosition.lastRow) {
                        bordersCrossed += 1;
                    }
                }

                relativeVisualLineIndex += bordersCrossed;

                const vAlign = cell.vAlign ?? "top";

                let targetContentIndex = -1;
                let renderContentOnRow = false;

                switch (vAlign) {
                    case "bottom": {
                        let visualLineWithinSpan = visualLineIndex;

                        for (let index = firstOccurrenceRow; index < rowIndex; index += 1) {
                            visualLineWithinSpan += rowHeights[index] ?? 1;
                        }

                        const contentStartIndexInSpan = totalRowSpanHeight - actualContentHeight;

                        targetContentIndex = visualLineWithinSpan >= contentStartIndexInSpan ? visualLineWithinSpan - contentStartIndexInSpan : -1;
                        break;
                    }
                    case "middle": {
                        // Calculate padding lines needed above the content
                        const paddingTop = Math.round((totalRowSpanHeight - actualContentHeight) / 2);

                        // Determine the current visual line index RELATIVE to the start of the span
                        let visualLineWithinSpan = visualLineIndex;

                        for (let index = firstOccurrenceRow; index < rowIndex; index += 1) {
                            visualLineWithinSpan += rowHeights[index] ?? 1;
                        }

                        targetContentIndex
                            = visualLineWithinSpan >= paddingTop && visualLineWithinSpan < paddingTop + actualContentHeight
                                ? visualLineWithinSpan - paddingTop
                                : -1;

                        break;
                    }
                    case "top": {
                        targetContentIndex = relativeVisualLineIndex;
                        break;
                    }
                    default: {
                        // Default to 'top' alignment behavior
                        targetContentIndex = relativeVisualLineIndex;
                    }
                }

                renderContentOnRow = targetContentIndex >= 0 && targetContentIndex < actualContentHeight;
                segmentToRender = " ".repeat(Math.max(0, currentCellTotalWidth)); // Default to spaces

                if (renderContentOnRow) {
                    let skipRender = false;

                    if (vAlign === "middle") {
                        const isEvenSpan = rowSpanCount % 2 === 0;

                        if (isEvenSpan && targetContentIndex === 0) {
                            skipRender = true;
                        }
                    }

                    if (!skipRender) {
                        segmentToRender = processedLines[targetContentIndex] ?? segmentToRender;
                    }
                }

                if (cell.colSpan && cell.colSpan > 1) {
                    segmentToRender += gapString.repeat(cell.colSpan);
                }

                if (cell.foregroundColor) {
                    segmentToRender = applyColor(segmentToRender, cell.foregroundColor);
                } else if (this.#options.foregroundColor) {
                    segmentToRender = applyColor(segmentToRender, this.#options.foregroundColor);
                }

                if (cell.backgroundColor) {
                    segmentToRender = applyColor(segmentToRender, cell.backgroundColor);
                } else if (this.#options.backgroundColor) {
                    segmentToRender = applyColor(segmentToRender, this.#options.backgroundColor);
                }
            } else {
                // Handle null cell (part of another cell's span)

                const totalPadding = this.#options.paddingLeft + this.#options.paddingRight;

                const contentWidth = Math.max(0, (columnWidths[col] ?? 0) - totalPadding);
                const emptyCellContent = " ".repeat(this.#options.paddingLeft + contentWidth + this.#options.paddingRight);

                segmentToRender = applyColor(
                    applyColor(visualLineIndex === 0 ? emptyCellContent : " ".repeat(emptyCellContent.length), this.#options.foregroundColor),
                    this.#options.backgroundColor,
                );
            }

            // Add the rendered segment (content or spaces)
            lineParts.push(segmentToRender);

            // Add gap and separator *if* this segment doesn't reach the last grid column
            if (col + currentCellColSpan < this.#options.columns) {
                lineParts.push(gapString);

                if (this.#options.showBorders && joinSeparator) {
                    lineParts.push(applyColor(applyColor(joinSeparator, borderAnsiColor), this.#options.backgroundColor));
                }

                // Add second gap only if gap > 0 (consistent with previous logic)
                if (this.#options.gap > 0) {
                    lineParts.push(gapString);
                }
            }

            // Advance by the span of the processed segment
            col += currentCellColSpan;
        }

        if (rightBorderChar) {
            lineParts.push(applyColor(applyColor(rightBorderChar, borderAnsiColor), this.#options.backgroundColor));
        }

        return lineParts.join("");
    }

    /**
     * Aligns cell content, applies word wrap or truncation, and returns an array of processed lines.
     * @param cell The cell to align
     * @param totalWidth Total width available for the cell (including padding)
     * @returns An array of aligned content strings, one for each line after processing.
     */
    // eslint-disable-next-line sonarjs/cognitive-complexity
    private alignCellContent(cell: GridItem, totalWidth: number): string[] {
        const cellCache = this.#alignCellContentCache.get(cell);

        if (cellCache?.has(totalWidth)) {
            return cellCache.get(totalWidth) as string[];
        }

        const { paddingLeft, paddingRight } = this.#options;
        const horizontalPadding = paddingLeft + paddingRight;
        const baseContentWidth = totalWidth - horizontalPadding;

        if (baseContentWidth <= 0) {
            const emptyResult: string[] = [" ".repeat(horizontalPadding + this.#options.gap)]; // Original empty result

            if (cellCache) {
                cellCache.set(totalWidth, emptyResult);
            } else {
                this.#alignCellContentCache.set(cell, new Map([[totalWidth, emptyResult]]));
            }

            return emptyResult;
        }

        let processedLines: string[];
        const contentString = String(cell.content ?? "");

        processedLines = contentString.includes("\n") || contentString.includes("\r") ? contentString.split(/\r?\n/) : [contentString];

        // Apply word wrap
        if (this.#options.wordWrap && cell.wordWrap !== false) {
            const optionsWordWrap = typeof this.#options.wordWrap === "object" ? this.#options.wordWrap : {};
            const wrapOptions = typeof cell.wordWrap === "object" ? cell.wordWrap : optionsWordWrap;

            processedLines = wordWrap(contentString, { ...wrapOptions, width: baseContentWidth }).split("\n");
        }

        if (this.#options.truncate && cell.truncate !== false) {
            const optionsTruncate = typeof this.#options.truncate === "object" ? this.#options.truncate : {};
            const truncateOptions = typeof cell.truncate === "object" ? cell.truncate : optionsTruncate;

            processedLines = processedLines.map((line) => truncate(line, baseContentWidth, truncateOptions));
        } else {
            // Ensure lines fit even if truncate/wrap are off
            // eslint-disable-next-line @stylistic/no-extra-parens
            processedLines = processedLines.map((line) => (getStringWidth(line) > baseContentWidth ? truncate(line, baseContentWidth, {}) : line));
        }

        const finalLines = processedLines.map((line) => padAndAlignContent(line, baseContentWidth, cell.hAlign ?? "left", paddingLeft, paddingRight));

        if (cellCache) {
            cellCache.set(totalWidth, finalLines);
        } else {
            this.#alignCellContentCache.set(cell, new Map([[totalWidth, finalLines]]));
        }

        return finalLines;
    }

    /**
     * Renders a horizontal border line
     * @param gridLayout The grid layout array
     * @param rowHeights Array of row heights
     * @param rowIndex Row index *above* the border being drawn
     * @param columnWidths Pre-calculated column widths
     * @param borderType Type of border to render ('top', 'middle', 'bottom')
     * @param nextRowIndex Index of the next row (used for 'middle' borders)
     * @returns String representation of the border line
     */
    // eslint-disable-next-line sonarjs/cognitive-complexity
    private renderHorizontalBorder(
        gridLayout: (GridItem | null)[][],
        rowHeights: number[],
        rowIndex: number,
        columnWidths: number[],
        borderType: BorderType,
        nextRowIndex = -1,
    ): string {
        if (!this.#options.showBorders || !this.#options.border) {
            return "";
        }

        const borderStyle = this.#options.border;
        const borderChars = getHorizontalBorderChars(borderStyle, borderType);
        const bodyChar = borderChars.body.char;
        const bodyWidth = borderChars.body.width;
        const simpleVerticalChar = borderStyle.bodyJoin.char;

        if (borderType !== "middle" && bodyWidth === 0) {
            return "";
        }

        let finalLeftChar = borderChars.left.char;
        let finalRightChar = borderChars.right.char;

        // Adjust edge characters for vertical spans
        if (borderType === "middle" && nextRowIndex !== -1) {
            const cellAboveLeftmost = gridLayout[rowIndex]?.[0] ?? null;

            const cellBelowLeftmost = gridLayout[nextRowIndex]?.[0] ?? null;

            if (cellAboveLeftmost && cellBelowLeftmost && cellAboveLeftmost === cellBelowLeftmost) {
                finalLeftChar = simpleVerticalChar;
            }

            const lastColIndex = this.#options.columns - 1;

            const cellAboveRightmost = gridLayout[rowIndex]?.[lastColIndex] ?? null;

            const cellBelowRightmost = gridLayout[nextRowIndex]?.[lastColIndex] ?? null;

            if (cellAboveRightmost && cellBelowRightmost && cellAboveRightmost === cellBelowRightmost) {
                finalRightChar = simpleVerticalChar;
            }
        }

        const middleSegments: string[] = [];
        const gapString = " ".repeat(this.#options.gap);

        // Add left border character initially
        if (finalLeftChar) {
            middleSegments.push(applyColor(applyColor(finalLeftChar, this.#options.borderColor), this.#options.backgroundColor));
        }

        let segment = "";

        for (let col = 0; col < this.#options.columns; col += 1) {
            const cellAbove: GridItem | null = gridLayout[rowIndex]?.[col] ?? null;

            const cellBelow: GridItem | null = borderType === "middle" && nextRowIndex !== -1 ? gridLayout[nextRowIndex]?.[col] ?? null : null;

            let definingCell: GridItem | null = null;
            let isStartCol = false;

            if (cellAbove && (col === 0 || gridLayout[rowIndex]?.[col - 1] !== cellAbove)) {
                definingCell = cellAbove;
                isStartCol = true;
            }

            // Optimization: Skip if this column is part of a previous cell's span
            if (cellAbove && !isStartCol) {
                continue; // Covered by prior span
            }

            if (!cellAbove) {
                // Empty column in the row above the border

                const width = columnWidths[col] ?? 0;

                segment = bodyWidth > 0 ? bodyChar.repeat(width) : " ".repeat(width);

                middleSegments.push(applyColor(applyColor(segment, this.#options.borderColor), this.#options.backgroundColor));

                if (col < this.#options.columns - 1) {
                    const joinCharDefinition = this.determineJoinChar(borderType, gridLayout, rowIndex, nextRowIndex, col, col + 1);

                    middleSegments.push(gapString); // Use pre-calculated gap

                    if (joinCharDefinition.width > 0) {
                        middleSegments.push(applyColor(applyColor(joinCharDefinition.char, this.#options.borderColor), this.#options.backgroundColor));
                    }
                }

                continue;
            }

            // cellAbove starts here (isStartCol is true)
            // = cellAbove;

            const colSpan = definingCell?.colSpan ?? 1;
            const isVerticalSpan = borderType === "middle" && cellBelow && cellAbove === cellBelow;

            // Determine segment: content, spaces, or dashes
            if (borderType === "middle" && isVerticalSpan && definingCell) {
                // CASE: Cell spans vertically across this MIDDLE border
                const isMiddleAligned = definingCell?.vAlign === "middle";
                // Use cached vertical position
                const { firstRow, lastRow } = this.getCachedCellVerticalPosition(gridLayout, rowIndex, col, definingCell);
                const rowSpanCount = lastRow - firstRow + 1;
                const isEvenSpan = rowSpanCount % 2 === 0;
                const targetBorderRowIndex = firstRow + Math.ceil(rowSpanCount / 2) - 1;

                // Get processed lines for the cell content
                const fullSpanWidthForContent = calculateCellTotalWidth(columnWidths, col, colSpan); // Width without internal joins for content padding
                const processedLines = this.alignCellContent(definingCell, fullSpanWidthForContent);
                const actualContentHeight = processedLines.length;

                if (isMiddleAligned && isEvenSpan && rowIndex === targetBorderRowIndex) {
                    // SUBCASE 1: Middle-aligned, Even span, Target border -> Render FIRST content line, centered within full widthUse first line (already padded)
                    segment = applyColor(processedLines[0] ?? "", this.#options.borderColor); // Use the already padded line directly
                } else {
                    // SUBCASE 2: Any other vertical span (odd, not middle-aligned, or not target border row for even/middle)
                    // Calculate which content line falls on this border naturally
                    let heightUpToBorder = 0;

                    for (let index = firstRow; index <= rowIndex; index += 1) {
                        heightUpToBorder += rowHeights[index] ?? 1; // Sum heights of rows *within the span* up to the border

                        // Add 1 for each border crossed *within* the span before this one
                        if (index < rowIndex) {
                            heightUpToBorder += 1;
                        }
                    }

                    // The target index is the visual line index *within the cell's total visual height* that corresponds to the border
                    // Note: For vAlign=middle/even, this calculation might target a line index that differs from the one
                    // rendered in SUBCASE 1 if contentHeight is odd, but this logic handles rendering the *correct* line
                    // for non-middle-aligned or odd spans (like table 8).
                    const targetContentLineIndex = heightUpToBorder;

                    if (targetContentLineIndex >= 0 && targetContentLineIndex < actualContentHeight) {
                        segment = applyColor(processedLines[targetContentLineIndex] ?? "", this.#options.foregroundColor); // Use the already padded line directly
                    } else {
                        // No content line falls here, render spaces covering the full width including internal structure
                        const segmentWidth
                            = columnWidths.slice(col, col + colSpan).reduce((sum, w) => sum + w, 0)

                                + (colSpan - 1) * (this.#options.gap + (this.#options.showBorders ? this.#options.border.bodyJoin.width : 0));

                        segment = applyColor(" ".repeat(segmentWidth), this.#options.borderColor);
                    }
                }

                middleSegments.push(applyColor(segment, this.#options.backgroundColor));
            } else if (cellAbove === null && borderType !== "top" && borderType !== "bottom") {
                // CASE: Empty cell in the row above a MIDDLE border

                const width = columnWidths[col] ?? 0;

                segment = bodyWidth > 0 ? bodyChar.repeat(width) : " ".repeat(width);

                middleSegments.push(applyColor(applyColor(segment, this.#options.borderColor), this.#options.backgroundColor));
            } else {
                // CASE: Top/Bottom border OR cell does NOT span vertically across middle border
                const segmentParts: string[] = [];

                for (let innerCol = col; innerCol < col + colSpan; innerCol += 1) {
                    const innerWidth = columnWidths[innerCol] ?? 0;
                    const charToRepeat = bodyWidth > 0 ? bodyChar : " "; // Use dash or space

                    segmentParts.push(charToRepeat.repeat(innerWidth + this.#options.gap)); // Segment ONLY for column width

                    // Add gap and internal join char if not the last column of the current span
                    if (innerCol < col + colSpan - 1) {
                        const joinCharDefinition = this.determineJoinChar(borderType, gridLayout, rowIndex, nextRowIndex, innerCol, innerCol + 1);

                        // Use the determined join char (could be T, +, -, etc. or just space)
                        if (joinCharDefinition.width > 0) {
                            segmentParts.push(joinCharDefinition.char);
                        }
                    }
                }

                segment = segmentParts.join("");

                middleSegments.push(applyColor(applyColor(segment, this.#options.borderColor), this.#options.backgroundColor));
            }

            // Determine join char/gap *after* the current segment/span
            // This needs to be handled outside the segment rendering logic
            // to correctly place the join between distinct cells/spans.
            const endOfSpanCol = col + colSpan - 1;

            if (endOfSpanCol < this.#options.columns - 1) {
                // Determine the join between the end of this span and the start of the next column
                const joinCharDefinition = this.determineJoinChar(borderType, gridLayout, rowIndex, nextRowIndex, endOfSpanCol, endOfSpanCol + 1);

                if (joinCharDefinition.width > 0) {
                    middleSegments.push(applyColor(applyColor(joinCharDefinition.char, this.#options.borderColor), this.#options.backgroundColor));
                }
            }

            // eslint-disable-next-line sonarjs/updated-loop-counter
            col += colSpan - 1; // Advance loop counter
        }

        // Add right border character at the end
        if (finalRightChar) {
            middleSegments.push(applyColor(applyColor(finalRightChar, this.#options.borderColor), this.#options.backgroundColor));
        }

        return middleSegments.join("");
    }

    /**
     * Determines the appropriate join character definition for a border intersection.
     * Accounts for cells spanning rows and columns to draw correct joins.
     */
    // eslint-disable-next-line sonarjs/cognitive-complexity
    private determineJoinChar(
        borderType: BorderType,
        gridLayout: (GridItem | null)[][],
        rowIndex: number,
        nextRowIndex: number,
        colIndex: number,
        rightColIndex = -1, // Index of the column to the right of the intersection
    ): BorderComponent {
        if (!this.#options.showBorders || !this.#options.border) {
            // No borders shown, the join is just the gap
            return { char: " ", width: this.#options.gap };
        }

        const borderStyle = this.#options.border;

        // Logic for non-middle borders (top/bottom)
        if (borderType !== "middle") {
            const hChars = getHorizontalBorderChars(borderStyle, borderType);

            const cellLeft = gridLayout[rowIndex]?.[colIndex] ?? null;
            const checkRightCol = rightColIndex === -1 ? colIndex + 1 : rightColIndex;

            const cellRight = gridLayout[rowIndex]?.[checkRightCol] ?? null;
            const spansHorizontally = cellLeft !== null && cellRight !== null && cellLeft === cellRight;

            const joinCharDefinition = spansHorizontally ? hChars.body : hChars.join;

            const { char, width } = joinCharDefinition;

            return { char, width: width > 0 ? width : this.#options.gap };
        }

        // Logic specifically for middle borders
        if (nextRowIndex === -1 || rightColIndex === -1) {
            return { char: " ", width: this.#options.gap };
        }

        const verticalJoinCharDefinition = borderStyle.bodyJoin;

        const cellAboveLeft = gridLayout[rowIndex]?.[colIndex] ?? null;

        const cellBelowLeft = gridLayout[nextRowIndex]?.[colIndex] ?? null;

        const cellAboveRight = gridLayout[rowIndex]?.[rightColIndex] ?? null;

        const cellBelowRight = gridLayout[nextRowIndex]?.[rightColIndex] ?? null;

        const leftSpansVertically = cellAboveLeft !== null && cellBelowLeft !== null && cellAboveLeft === cellBelowLeft;
        const rightSpansVertically = cellAboveRight !== null && cellBelowRight !== null && cellAboveRight === cellBelowRight;
        const aboveSpansHorizontally = cellAboveLeft !== null && cellAboveRight !== null && cellAboveLeft === cellAboveRight;
        const belowSpansHorizontally = cellBelowLeft !== null && cellBelowRight !== null && cellBelowLeft === cellBelowRight;

        let joinCharDefinition: BorderComponent | undefined;
        const middleHChars = getHorizontalBorderChars(borderStyle, "middle");

        if (leftSpansVertically && rightSpansVertically) {
            // Use ternary expression for better readability
            joinCharDefinition = aboveSpansHorizontally ? { char: " ", width: verticalJoinCharDefinition.width } : verticalJoinCharDefinition;
        } else if (leftSpansVertically) {
            // Left side spans V, right doesn't.
            joinCharDefinition = borderStyle.joinLeft; // '├' (NOTE: Style override from original logic)
        } else if (rightSpansVertically) {
            // Right side spans V, left doesn't.
            joinCharDefinition = borderStyle.joinRight; // '┤' (NOTE: Style override from original logic)
            // Neither side spans V. Handle nested conditions directly
        } else if (aboveSpansHorizontally && belowSpansHorizontally) {
            // Spans H both above and below.
            joinCharDefinition = middleHChars.body; // '─'
        } else if (aboveSpansHorizontally) {
            // Spans H only ABOVE.
            joinCharDefinition = borderStyle.topJoin; // '┴' -> NOTE: Swapped from bottomJoin to match user revert/style
        } else if (belowSpansHorizontally) {
            // Spans H only BELOW.
            joinCharDefinition = borderStyle.bottomJoin; // '┬' -> NOTE: Swapped from topJoin to match user revert/style
        } else {
            // No connecting H spans.
            joinCharDefinition = borderStyle.joinJoin; // '┼'
        }

        // Final fallback for safety - add nullish coalescing
        const { char, width } = joinCharDefinition;

        return { char, width: width > 0 ? width : this.#options.gap };
    }

    /**
     * Renders the complete grid
     * @param gridLayout The grid layout array
     * @param columnWidths Array of column widths
     * @returns String representation of the grid
     */
    // eslint-disable-next-line sonarjs/cognitive-complexity
    private renderGrid(gridLayout: (GridItem | null)[][], columnWidths: number[]): string {
        if (gridLayout.length === 0) {
            return "";
        }

        const lines: string[] = [];
        const rowHeights = calculateRowHeights(gridLayout, columnWidths, this.#options, this.alignCellContent.bind(this), findFirstOccurrenceRow);
        const topBorderChars = this.#options.showBorders && this.#options.border ? getHorizontalBorderChars(this.#options.border, "top") : null;

        if (topBorderChars && topBorderChars.body.width > 0) {
            lines.push(this.renderHorizontalBorder(gridLayout, rowHeights, 0, columnWidths, "top"));
        }

        for (let rowIndex = 0; rowIndex < gridLayout.length; rowIndex += 1) {
            const visualHeight = rowHeights[rowIndex] ?? 1;

            for (let visualLineIndex = 0; visualLineIndex < visualHeight; visualLineIndex += 1) {
                lines.push(this.renderVisualRowContent(gridLayout, rowIndex, visualLineIndex, columnWidths, rowHeights));
            }

            const middleBorderChars = this.#options.showBorders && this.#options.border ? getHorizontalBorderChars(this.#options.border, "middle") : null;

            if (rowIndex < gridLayout.length - 1 && middleBorderChars && middleBorderChars.body.width > 0) {
                // Check if any cell in the current row does not continue into the next row

                const currentRow = gridLayout[rowIndex];

                const nextRow = gridLayout[rowIndex + 1];

                let needsBorder = false;

                if (currentRow && nextRow) {
                    for (let col = 0; col < this.#options.columns; col += 1) {
                        const currentCell = currentRow[col];

                        const nextCell = nextRow[col];

                        // If cells are different or one is null while the other isn't, we need a border
                        if (currentCell !== nextCell) {
                            needsBorder = true;
                            break;
                        }
                    }
                }

                if (needsBorder) {
                    // Pass rowHeights, not columnWidths
                    lines.push(this.renderHorizontalBorder(gridLayout, rowHeights, rowIndex, columnWidths, "middle", rowIndex + 1));
                }
            }
        }

        const bottomBorderChars = this.#options.showBorders && this.#options.border ? getHorizontalBorderChars(this.#options.border, "bottom") : null;

        if (bottomBorderChars && bottomBorderChars.body.width > 0) {
            // Pass rowHeights, not columnWidths
            lines.push(this.renderHorizontalBorder(gridLayout, rowHeights, gridLayout.length - 1, columnWidths, "bottom"));
        }

        return lines.join("\n");
    }

    /**
     * Gets the vertical position (first and last row) of a cell, using a cache.
     * @param gridLayout {GridItem[][]} The grid layout.
     * @param rowIndex Current row index (used as context, not start row).
     * @param colIndex Column index.
     * @param cell The cell item.
     * @returns The cached or calculated vertical position.
     */
    private getCachedCellVerticalPosition(
        gridLayout: (GridItem | null)[][],
        rowIndex: number,
        colIndex: number,
        cell: GridItem,
    ): { firstRow: number; lastRow: number } {
        const cached = this.#cellVerticalPositionCache.get(cell);

        if (cached) {
            return cached;
        }

        const position = determineCellVerticalPosition(gridLayout, rowIndex, colIndex, cell);

        this.#cellVerticalPositionCache.set(cell, position);

        return position;
    }
}

/**
 * Creates a new grid instance with the specified options
 * @param options Configuration options for the grid
 * @returns A new Grid instance
 */
export const createGrid = (options: GridOptions): Grid => new Grid(options);
