import { Grid } from "./grid";
import { DEFAULT_BORDER } from "./style";
import type { ColumnDefault, Content, GridItem, GridOptions, TableCell, TableItem, TableOptions } from "./types";
import computeRowLogicalWidth from "./utils/compute-row-logical-width";
import sanitizeHref from "./utils/sanitize-href";

/**
 * A versatile table generator for CLI applications.
 */
export class Table {
    readonly #options: TableOptions;

    readonly #rows: TableCell[][] = [];

    #headers: TableCell[][] = [];

    #footers: TableCell[][] = [];

    #isDirty = true;

    #cachedString: string | undefined = undefined;

    /**
     * Emit a non-fatal diagnostic. Routes to the consumer-provided `onWarn`
     * handler when set, otherwise falls back to `console.warn`.
     */
    #warn(message: string): void {
        const handler = this.#options.onWarn;

        if (handler) {
            handler(message);

            return;
        }

        // eslint-disable-next-line no-console
        console.warn(message);
    }

    /**
     * Initializes a new Table instance.
     * @param options Configuration options for the table.
     */
    public constructor(options: TableOptions = {}) {
        this.#options = {
            ...options,
            showFooter: options.showFooter ?? true,
            showHeader: options.showHeader ?? true,
            style: {
                border: DEFAULT_BORDER,
                paddingLeft: 1,
                paddingRight: 1,
                ...options.style,
            },
        };
    }

    /**
     * Sets the header rows for the table.
     * Replaces any existing headers.
     * @param headers Array of header rows OR a single header row.
     * @returns The Table instance for chaining.
     */
    public setHeaders(headers: TableCell[] | TableCell[][]): this {
        // eslint-disable-next-line unicorn/prefer-ternary
        if (headers.length > 0 && !Array.isArray(headers[0])) {
            this.#headers = [headers as TableCell[]];
        } else {
            // eslint-disable-next-line @stylistic/no-extra-parens
            this.#headers = (headers as TableCell[][]).map((row) => (Array.isArray(row) ? row : [row]));
        }

        this.#isDirty = true;
        this.#cachedString = undefined;

        return this;
    }

    /**
     * Sets the footer rows for the table.
     * Replaces any existing footers.
     * @param footers Array of footer rows OR a single footer row.
     * @returns The Table instance for chaining.
     */
    public setFooter(footers: TableCell[] | TableCell[][]): this {
        // eslint-disable-next-line unicorn/prefer-ternary
        if (footers.length > 0 && !Array.isArray(footers[0])) {
            this.#footers = [footers as TableCell[]];
        } else {
            // eslint-disable-next-line @stylistic/no-extra-parens
            this.#footers = (footers as TableCell[][]).map((row) => (Array.isArray(row) ? row : [row]));
        }

        this.#isDirty = true;
        this.#cachedString = undefined;

        return this;
    }

    /**
     * Adds a single row to the table body.
     * @param row Array of cells representing the row.
     * @returns The Table instance for chaining.
     */
    public addRow(row: TableCell[]): this {
        if (!Array.isArray(row)) {
            throw new TypeError("Row must be an array");
        }

        this.#rows.push(row);
        this.#isDirty = true;
        this.#cachedString = undefined;

        return this;
    }

    /**
     * Adds multiple rows to the table body.
     * @param rows Array of rows to add.
     * @returns The Table instance for chaining.
     */
    public addRows(...rows: TableCell[][]): this {
        for (const row of rows) {
            this.addRow(row);
        }

        this.#isDirty = true;
        this.#cachedString = undefined;

        return this;
    }

    /**
     * Returns a shallow copy of the current body rows.
     *
     * The outer array is a fresh copy (mutating it does not affect the table),
     * but the row arrays and cell objects are the same references stored in the
     * table. Useful for live dashboards that need to inspect or re-render the
     * current data without keeping a separate shadow copy.
     * @returns A copy of the body rows.
     */
    // fallow-ignore-next-line unused-class-member -- public Table API, not called inside the repo.
    public getRows(): TableCell[][] {
        return this.#rows.map((row) => [...row]);
    }

    /**
     * Returns the number of body rows currently stored in the table.
     * @returns The body row count.
     */
    // fallow-ignore-next-line unused-class-member -- public Table API, not called inside the repo.
    public get rowCount(): number {
        return this.#rows.length;
    }

    /**
     * Removes a single body row by index.
     * @param index Zero-based index of the body row to remove.
     * @returns The Table instance for chaining.
     * @throws {RangeError} If the index is out of bounds.
     */
    // fallow-ignore-next-line unused-class-member -- public Table API, not called inside the repo.
    public removeRow(index: number): this {
        if (!Number.isInteger(index) || index < 0 || index >= this.#rows.length) {
            throw new RangeError(`Row index ${String(index)} is out of bounds (0..${String(this.#rows.length - 1)})`);
        }

        this.#rows.splice(index, 1);
        this.#isDirty = true;
        this.#cachedString = undefined;

        return this;
    }

    /**
     * Removes all body rows. Headers and footers are preserved.
     * @returns The Table instance for chaining.
     */
    // fallow-ignore-next-line unused-class-member -- public Table API, not called inside the repo.
    public clear(): this {
        this.#rows.length = 0;
        this.#isDirty = true;
        this.#cachedString = undefined;

        return this;
    }

    /**
     * Renders the table to a string.
     * @returns The string representation of the table.
     */
    // eslint-disable-next-line sonarjs/cognitive-complexity
    public toString(): string {
        // Use cached string if available and not dirty
        if (!this.#isDirty && this.#cachedString !== undefined) {
            return this.#cachedString;
        }

        // Combine headers, rows, and footers for processing
        // Use this.headers directly, check showHeader option
        const headerRows = this.#options.showHeader ? this.#headers : [];
        const footerRows = this.#options.showFooter ? this.#footers : [];
        const allRows = [...headerRows, ...this.#rows, ...footerRows];

        // If table is empty (considering showHeader), return empty string
        if (allRows.length === 0) {
            this.#cachedString = "";
            this.#isDirty = false;

            return "";
        }

        // 1. Determine Grid dimensions (columns)
        // Calculate based on the widest row found in headers or body
        let numberColumns = 0;

        for (const allRow of allRows) {
            const row = allRow;

            if (Array.isArray(row)) {
                numberColumns = Math.max(numberColumns, computeRowLogicalWidth(row));
            } else {
                this.#warn(`Unexpected non-array element found while calculating columns: ${JSON.stringify(row)}`);
            }
        }

        if (numberColumns === 0) {
            this.#cachedString = "";
            this.#isDirty = false;

            return "";
        }

        // Prepare fixedColumnWidths for the Grid
        let fixedGridWidths: (number | undefined)[] | undefined;

        if (Array.isArray(this.#options.columnWidths)) {
            const widthArray
                = this.#options.columnWidths.length >= numberColumns
                    ? this.#options.columnWidths.slice(0, numberColumns)
                    : [
                        ...this.#options.columnWidths,
                        ...Array.from<number | undefined>({ length: numberColumns - this.#options.columnWidths.length }).fill(undefined),
                    ];

            fixedGridWidths = widthArray;
        } else if (typeof this.#options.columnWidths === "number") {
            // If a single number is provided, create an array with that width for all columns
            fixedGridWidths = Array.from<number>({ length: numberColumns }).fill(this.#options.columnWidths);
        }

        let fixedGridRowHeights: number[] | undefined;
        const numberTotalRows = allRows.length;

        if (Array.isArray(this.#options.rowHeights)) {
            // Use the provided array, ensuring it's long enough (pad with undefined/null? Grid handles short arrays?)
            // Grid logic expects an array at least as long as the number of rows.
            // If shorter, the remaining rows will be calculated. Let's just pass it.
            fixedGridRowHeights = this.#options.rowHeights;
        } else if (typeof this.#options.rowHeights === "number") {
            // If a single number is provided, create an array for all rows
            fixedGridRowHeights = Array.from<number>({ length: numberTotalRows }).fill(this.#options.rowHeights);
        }

        // If no table-level columnWidths were provided but a cell requests an exact
        // `width`, seed an all-undefined width array so that width can be folded into
        // its logical column below. Columns without an explicit width stay auto-sized.
        if (!fixedGridWidths) {
            const hasCellWidth = allRows.some(
                (row) =>
                    Array.isArray(row)
                    && row.some(
                        (cell) => typeof cell === "object" && cell !== null && !Array.isArray(cell) && (cell as TableItem).width !== undefined,
                    ),
            );

            if (hasCellWidth) {
                fixedGridWidths = Array.from<number | undefined>({ length: numberColumns }).fill(undefined);
            }
        }

        // Adjust fixedColumnWidths based on cell maxWidth constraints before creating grid
        if (fixedGridWidths && Array.isArray(fixedGridWidths)) {
            const adjustedWidths = [...fixedGridWidths];

            // Find minimum maxWidth for each column across all cells
            for (const allRow of allRows) {
                const row = allRow;

                // Track the logical grid column of the current cell so cell-level
                // `width`/`maxWidth` land on the column they actually occupy rather
                // than on the cell's position in the row array (which drifts once an
                // earlier cell in the row uses `colSpan > 1`).
                let columnCursor = 0;

                for (const cellInput of row) {
                    let cellOptions: Omit<GridItem, "content"> = {};

                    if (typeof cellInput === "object" && cellInput !== null && !Array.isArray(cellInput)) {
                        // eslint-disable-next-line unused-imports/no-unused-vars
                        const { content, href, ...rest } = cellInput;

                        cellOptions = rest;
                    }

                    // width takes precedence - sets exact width, overriding table columnWidths
                    if (cellOptions.width !== undefined) {
                        adjustedWidths[columnCursor] = cellOptions.width;
                        // maxWidth constrains the width but doesn't override table columnWidths unless smaller than table columnWidths
                    } else if (cellOptions.maxWidth !== undefined && adjustedWidths[columnCursor] !== undefined) {
                        adjustedWidths[columnCursor] = Math.min(adjustedWidths[columnCursor] as number, cellOptions.maxWidth);
                    }

                    columnCursor += cellOptions.colSpan ?? 1;
                }
            }

            // Update fixedGridWidths with adjusted widths
            fixedGridWidths = adjustedWidths;
        }

        const options = {
            autoFlow: "row",
            backgroundColor: this.#options.style?.backgroundColor,
            balancedWidths: this.#options.balancedWidths ?? false,
            border: this.#options.style?.border,
            borderColor: this.#options.style?.borderColor,
            columns: numberColumns,
            fixedColumnWidths: fixedGridWidths,
            fixedRowHeights: fixedGridRowHeights,
            foregroundColor: this.#options.style?.foregroundColor,
            gap: this.#options.gap ?? 0,
            maxWidth: this.#options.maxWidth,
            onWarn: this.#options.onWarn,
            paddingLeft: this.#options.style?.paddingLeft,
            paddingRight: this.#options.style?.paddingRight,
            terminalWidth: this.#options.terminalWidth,
            truncate:
                this.#options.truncate
                ?? (fixedGridWidths?.every((w) => typeof w === "number")
                    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- intentional: false from .every() must fall through to maxWidth check
                    || (this.#options.maxWidth !== undefined && !this.#options.balancedWidths)),
            // eslint-disable-next-line sonarjs/deprecation -- forwarding deprecated option to grid for backward compatibility
            truncateOverflow: this.#options.truncateOverflow ?? true,
            wordWrap: this.#options.wordWrap ?? false,
        } satisfies GridOptions;

        const grid = new Grid(options);

        // Merge `colAligns` shorthand into the richer `columnDefaults` map so
        // there is a single source of per-column defaults to consult below.
        const columnDefaults: (ColumnDefault | undefined)[] = [];

        if (this.#options.columnDefaults) {
            for (const [index, value] of this.#options.columnDefaults.entries()) {
                if (value) {
                    columnDefaults[index] = { ...value };
                }
            }
        }

        if (this.#options.colAligns) {
            for (const [index, value] of this.#options.colAligns.entries()) {
                if (value !== undefined) {
                    columnDefaults[index] = { ...columnDefaults[index], hAlign: columnDefaults[index]?.hAlign ?? value };
                }
            }
        }

        const hasColumnDefaults = columnDefaults.length > 0;

        const gridItems: GridItem[] = [];

        for (const [currentRowIndex, allRow] of allRows.entries()) {
            const row = allRow;

            if (!Array.isArray(row)) {
                this.#warn(`Skipping non-array row while creating GridItems: ${JSON.stringify(row)}`);

                continue;
            }

            // Check if this is a header row and if the auto-span logic should apply
            const headerRowCount = this.#options.showHeader ? this.#headers.length : 0;
            const bodyRowCount = this.#rows.length;
            const isHeaderRow = this.#options.showHeader && currentRowIndex < headerRowCount;
            const isFooterRow = this.#options.showFooter && currentRowIndex >= headerRowCount + bodyRowCount;
            const applyHeaderColspan = isHeaderRow && row.length === 1 && numberColumns > 1;
            const applyFooterColspan = isFooterRow && row.length === 1 && numberColumns > 1;

            // Tracks the logical grid column of the current cell so per-column
            // defaults (`colAligns` / `columnDefaults`) can be looked up.
            let columnCursor = 0;

            for (const element of row) {
                let cellInput: Content | TableItem = element;
                let cellOptions: Omit<GridItem, "content"> = {};

                if (typeof cellInput === "object" && cellInput !== null && !Array.isArray(cellInput)) {
                    const { content, href, ...rest } = cellInput;

                    cellInput = href ? `\u001B]8;;${sanitizeHref(href)}\u001B\\${String(content)}\u001B]8;;\u001B\\` : content;

                    cellOptions = rest;
                }

                // Apply per-column defaults; cell-level options always win.
                const columnDefault = hasColumnDefaults ? columnDefaults[columnCursor] : undefined;

                if (columnDefault) {
                    cellOptions = {
                        ...cellOptions,
                        hAlign: cellOptions.hAlign ?? columnDefault.hAlign,
                        maxWidth: cellOptions.maxWidth ?? columnDefault.maxWidth,
                        truncate: cellOptions.truncate ?? columnDefault.truncate,
                        vAlign: cellOptions.vAlign ?? columnDefault.vAlign,
                        wordWrap: cellOptions.wordWrap ?? columnDefault.wordWrap,
                    };
                }

                columnCursor += cellOptions.colSpan ?? 1;

                // Apply auto colSpan for single-cell header rows
                if (applyHeaderColspan) {
                    // Ensure colSpan is set to the full table width
                    // Override any smaller, pre-existing colSpan on the cell object
                    cellOptions.colSpan = numberColumns;
                }

                // Apply auto colSpan for single-cell footer rows
                if (applyFooterColspan) {
                    // Ensure colSpan is set to the full table width
                    // Override any smaller, pre-existing colSpan on the cell object
                    cellOptions.colSpan = numberColumns;
                }

                // Replace real tab characters with spaces if needed
                const processedContent
                    = this.#options.transformTabToSpace && typeof cellInput === "string"
                        ? cellInput.replaceAll("\t", " ".repeat(this.#options.transformTabToSpace))
                        : cellInput;

                // For cell maxWidth, use the cell-specific value (table-level columnWidths are handled separately).
                // `width` is intentionally NOT forwarded to the Grid item: Table has already
                // folded any cell-level `width` into the fixed column widths above, and Grid
                // ignores `GridItem.width` (and would emit a dev warning for it).
                const { maxWidth } = cellOptions;

                gridItems.push({
                    backgroundColor: cellOptions.backgroundColor,
                    colSpan: cellOptions.colSpan,
                    content: processedContent as Content,
                    foregroundColor: cellOptions.foregroundColor,
                    hAlign: cellOptions.hAlign,
                    maxWidth, // Use the determined maxWidth
                    rowSpan: cellOptions.rowSpan,
                    truncate: cellOptions.truncate ?? (maxWidth === undefined ? undefined : true),
                    vAlign: cellOptions.vAlign,
                    wordWrap: cellOptions.wordWrap, // Enable wrap if maxWidth > 0
                } satisfies GridItem);
            }
            // Pad row with empty items if shorter than numColumns? Grid's auto-flow handles this.
        }

        grid.addItems(gridItems);

        this.#cachedString = grid.toString();
        this.#isDirty = false;

        return this.#cachedString;
    }
}

/**
 * Creates a new Table instance.
 * @param options Configuration options for the table.
 * @returns A new Table instance.
 */
export const createTable = (options?: TableOptions): Table => new Table(options);
