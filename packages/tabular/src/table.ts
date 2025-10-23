import { Grid } from "./grid";
import { DEFAULT_BORDER } from "./style";
import type { Content, GridItem, GridOptions, TableCell, TableItem, TableOptions } from "./types";
import computeRowLogicalWidth from "./utils/compute-row-logical-width";

/**
 * A versatile table generator for CLI applications.
 */
export class Table {
    readonly #options: TableOptions;

    readonly #rows: TableCell[][] = [];

    #headers: TableCell[][] = [];

    #isDirty = true;

    #cachedString: string | undefined = undefined;

    /**
     * Initializes a new Table instance.
     * @param options Configuration options for the table.
     */
    public constructor(options: TableOptions = {}) {
        this.#options = {
            ...options,
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
     * Renders the table to a string.
     * @returns The string representation of the table.
     */
    // eslint-disable-next-line sonarjs/cognitive-complexity
    public toString(): string {
        // Use cached string if available and not dirty
        if (!this.#isDirty && this.#cachedString !== undefined) {
            return this.#cachedString;
        }

        // Combine headers and rows for processing
        // Use this.headers directly, check showHeader option
        const allRows = this.#options.showHeader ? [...this.#headers, ...this.#rows] : this.#rows;

        // If table is empty (considering showHeader), return empty string
        if (allRows.length === 0) {
            this.#cachedString = "";
            this.#isDirty = false;

            return "";
        }

        // 1. Determine Grid dimensions (columns)
        // Calculate based on the widest row found in headers or body
        let numberColumns = 0;

        for (const row of allRows) {
            if (Array.isArray(row)) {
                numberColumns = Math.max(numberColumns, computeRowLogicalWidth(row));
            } else {
                // eslint-disable-next-line no-console
                console.error(`Unexpected non-array element found while calculating columns:`, row);
            }
        }

        if (numberColumns === 0) {
            this.#cachedString = "";
            this.#isDirty = false;

            return "";
        }

        // Prepare fixedColumnWidths for the Grid
        let fixedGridWidths: number[] | undefined;

        if (Array.isArray(this.#options.columnWidths)) {
            const widthArray
                = this.#options.columnWidths.length >= numberColumns
                    ? this.#options.columnWidths.slice(0, numberColumns)
                    : [
                        ...this.#options.columnWidths,
                        ...Array.from<number | undefined>({ length: numberColumns - this.#options.columnWidths.length }).fill(undefined),
                    ];

            // Only treat as fully fixed if all entries are defined numbers
            const allDefined = widthArray.every((w) => typeof w === "number" && Number.isFinite(w));

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            fixedGridWidths = allDefined ? (widthArray as number[]) : (widthArray as any);
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
            paddingLeft: this.#options.style?.paddingLeft,
            paddingRight: this.#options.style?.paddingRight,
            terminalWidth: this.#options.terminalWidth,
            truncate:
                this.#options.truncate
                || (fixedGridWidths !== undefined && fixedGridWidths.every((w) => typeof w === "number"))
                || (this.#options.maxWidth !== undefined && !this.#options.balancedWidths),
            wordWrap: this.#options.wordWrap ?? false,
        } satisfies GridOptions;

        const grid = new Grid(options);

        const gridItems: GridItem[] = [];

        // eslint-disable-next-line guard-for-in, no-restricted-syntax
        for (const rowIndex in allRows) {
            const row = allRows[rowIndex];

            if (!Array.isArray(row)) {
                // eslint-disable-next-line no-console
                console.error(`Skipping non-array row while creating GridItems:`, row);

                continue;
            }

            // Check if this is a header row and if the auto-span logic should apply
            const isHeaderRow = this.#options.showHeader && Number.parseInt(rowIndex, 10) < this.#headers.length;
            const applyHeaderColspan = isHeaderRow && row.length === 1 && numberColumns > 1;

            // eslint-disable-next-line prefer-const
            for (let [cellIndex, cellInput] of row.entries()) {
                let cellOptions: Omit<GridItem, "content"> = {};

                if (typeof cellInput === "object" && cellInput !== null && !Array.isArray(cellInput)) {
                    const { content, href, ...rest } = cellInput as TableItem;

                    // eslint-disable-next-line sonarjs/updated-loop-counter
                    cellInput = href ? `\u001B]8;;${href}\u001B\\${String(content)}\u001B]8;;\u001B\\` : content;

                    cellOptions = rest;
                }

                // Apply auto colSpan for single-cell header rows
                if (applyHeaderColspan) {
                    // Ensure colSpan is set to the full table width
                    // Override any smaller, pre-existing colSpan on the cell object
                    cellOptions.colSpan = numberColumns;
                }

                // Replace real tab characters with spaces if needed
                const processedContent
                    = this.#options.transformTabToSpace && typeof cellInput === "string"
                        ? cellInput.replaceAll("\t", " ".repeat(this.#options.transformTabToSpace))
                        : cellInput;

                let maxWidth: number | undefined;

                // Table-level columnWidths override cell-specific maxWidth if defined

                if (fixedGridWidths?.[cellIndex] !== undefined) {
                    maxWidth = fixedGridWidths[cellIndex];
                }

                if (cellOptions.maxWidth) {
                    maxWidth = cellOptions.maxWidth;
                }

                gridItems.push({
                    backgroundColor: cellOptions.backgroundColor,
                    colSpan: cellOptions.colSpan,
                    content: processedContent as Content,
                    foregroundColor: cellOptions.foregroundColor,
                    hAlign: cellOptions.hAlign,
                    maxWidth, // Use the determined maxWidth
                    rowSpan: cellOptions.rowSpan,
                    truncate: cellOptions.truncate || maxWidth !== undefined,
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
