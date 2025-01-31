import { stripVTControlCharacters } from "node:util";

import stringWidth from "string-width";
import type { RequiredDeep } from "type-fest";

import { DEFAULT_BORDER } from "./style";
import type { Cell as CellType, CellOptions, TableConstructorOptions } from "./types";

// Cache for string width calculations
const widthCache: Map<string, number> = new Map<string, number>();

/**
 * Normalizes a cell value into a CellType object.
 * @param cell The cell value to normalize
 * @returns Normalized cell object
 */
const normalizeCellOption = (cell: CellType): CellOptions & { content: string } => {
    if (cell === null || typeof cell !== "object") {
        if (cell === undefined || cell === null || cell === "") {
            return { content: "" };
        }

        return { content: String(cell) };
    }

    if (cell.content === undefined || cell.content === null || cell.content === "") {
        // eslint-disable-next-line no-param-reassign
        cell.content = "";
    }

    if (typeof cell.content === "object") {
        throw new TypeError("Cell content must be a string, undefined, null or number");
    }

    return cell as CellOptions & { content: string };
};

/**
 * Fills missing cells in a row to match the target column count.
 * @param row Array of cells to fill
 * @param targetColumnCount Desired number of columns
 * @returns Array with filled cells
 */
const fillMissingCells = (row: CellType[], targetColumnCount: number): CellType[] => {
    const filledRow = [...row];

    // eslint-disable-next-line no-loops/no-loops
    while (filledRow.length < targetColumnCount) {
        filledRow.push({ content: "" });
    }

    return filledRow;
};

/**
 * A class for creating and rendering ASCII/Unicode tables in the terminal.
 * Supports features like:
 * - Custom border styles
 * - Cell padding and alignment
 * - Column spanning
 * - Row spanning
 * - Word wrapping
 * - ANSI color support
 */
export class Table {
    private readonly rows: CellType[][] = [];
    private headers: CellType[][] = [];
    private columnCount = 0;
    private readonly options: RequiredDeep<TableConstructorOptions>;
    private columnWidths: number[] = [];
    private cachedColumnWidths: number[] | null = null;
    private cachedString: string | null = null;
    private isDirty = true;

    /**
     * Creates a new Table instance.
     * @param options Configuration options for the table
     */
    public constructor(options?: TableConstructorOptions) {
        this.options = {
            showHeader: options?.showHeader ?? true,
            style: {
                border: DEFAULT_BORDER,
                paddingLeft: 1,
                paddingRight: 1,
                ...options?.style,
            },
            truncate: options?.truncate ?? "…",
            wordWrap: options?.wordWrap ?? false,
        } as RequiredDeep<TableConstructorOptions>;
    }

    /**
     * Sets the table headers.
     * @param headers Array of header cells
     * @returns This table instance for chaining
     */
    public setHeaders(headers: CellType[]): this {
        let maxCol = 0;

        const headerRows = [headers];
        // eslint-disable-next-line @typescript-eslint/naming-convention,no-underscore-dangle
        const length_ = headers.length;

        // Optimize loop for header column counting
        // eslint-disable-next-line no-loops/no-loops,no-plusplus
        for (let index = 0; index < length_; index++) {
            const cell = headers[index];
            if (!cell) {
                // eslint-disable-next-line no-continue
                continue;
            }

            const colSpan = (cell as CellOptions).colSpan ?? 1;
            maxCol += colSpan;
        }

        this.columnCount = Math.max(this.columnCount, maxCol);
        this.headers = headerRows.map((headerRow) => fillMissingCells(headerRow, this.columnCount));
        this.isDirty = true;

        return this;
    }

    /**
     * Adds a row to the table.
     * @param row Array of cells for the row
     * @returns This table instance for chaining
     */
    public addRow(row: CellType[]): this {
        let maxCol = 0;
        let currentCol = 0;

        // eslint-disable-next-line @typescript-eslint/naming-convention,no-underscore-dangle
        const length_ = row.length;

        // Optimize loop for row column counting
        // eslint-disable-next-line no-loops/no-loops,no-plusplus
        for (let index = 0; index < length_; index++) {
            const cell = row[index];

            if (cell) {
                const normalizedCell = normalizeCellOption(cell);
                const colSpan = normalizedCell.colSpan ?? 1;

                currentCol += colSpan;
                maxCol = Math.max(maxCol, currentCol);
            } else {
                // eslint-disable-next-line no-plusplus
                currentCol++;
                maxCol = Math.max(maxCol, currentCol);
            }
        }

        this.columnCount = Math.max(this.columnCount, maxCol);

        if (this.headers.length > 0) {
            this.headers = this.headers.map((headerRow) => fillMissingCells(headerRow, this.columnCount));
        }

        this.rows.push(fillMissingCells(row, this.columnCount));
        this.isDirty = true;

        return this;
    }

    /**
     * Adds multiple rows to the table.
     * @param rows Array of rows to add
     * @returns This table instance for chaining
     */
    public addRows(rows: CellType[][]): this {
        // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
        for (const row of rows) {
            this.addRow(row as CellType[]);
        }

        return this;
    }

    /**
     * Renders the table to a string.
     * @returns String representation of the table
     */
    // eslint-disable-next-line sonarjs/cognitive-complexity
    public toString(): string {
        if (!this.isDirty && this.cachedString !== null) {
            return this.cachedString;
        }

        if (this.rows.length === 0 && this.headers.length === 0) {
            this.cachedString = "";
            return "";
        }

        this.columnWidths = this.calculateColumnWidths();
        const lines: string[] = [];

        // Add top border
        if (this.options.style.border?.topBody) {
            lines.push(
                this.createLine({
                    body: this.options.style.border.topBody,
                    left: this.options.style.border.topLeft ?? "",
                    middle: this.options.style.border.topJoin ?? "",
                    right: this.options.style.border.topRight ?? "",
                }),
            );
        }

        // Add headers if they exist and showHeader is true
        if (this.headers.length > 0 && this.options.showHeader) {
            this.headers.forEach((row) => {
                lines.push(
                    ...this.renderRow(row, this.columnWidths, {
                        left: this.options.style.border?.bodyLeft ?? "",
                        middle: this.options.style.border?.bodyJoin ?? "",
                        right: this.options.style.border?.bodyRight ?? "",
                    }),
                );
            });

            // Add header separator if there are rows
            if (this.rows.length > 0 && this.options.style.border?.joinBody) {
                lines.push(
                    this.createLine({
                        body: this.options.style.border?.joinBody,
                        left: this.options.style.border?.joinLeft ?? "",
                        middle: this.options.style.border?.joinJoin ?? "",
                        right: this.options.style.border?.joinRight ?? "",
                    }),
                );
            }
        }

        // Add rows
        this.rows.forEach((row, rowIndex) => {
            lines.push(
                ...this.renderRow(row, this.columnWidths, {
                    left: this.options.style.border?.bodyLeft ?? "",
                    middle: this.options.style.border?.bodyJoin ?? "",
                    right: this.options.style.border?.bodyRight ?? "",
                }),
            );

            // Add row separator if not the last row
            if (rowIndex < this.rows.length - 1 && this.options.style.border?.joinBody) {
                lines.push(
                    this.createLine({
                        body: this.options.style.border?.joinBody,
                        left: this.options.style.border?.joinLeft ?? "",
                        middle: this.options.style.border?.joinJoin ?? "",
                        right: this.options.style.border?.joinRight ?? "",
                    }),
                );
            }
        });

        // Add bottom border
        if (this.options.style.border?.bottomBody) {
            lines.push(
                this.createLine({
                    body: this.options.style.border?.bottomBody,
                    left: this.options.style.border?.bottomLeft ?? "",
                    middle: this.options.style.border?.bottomJoin ?? "",
                    right: this.options.style.border?.bottomRight ?? "",
                }),
            );
        }

        this.cachedString = lines.join("\n");
        return this.cachedString;
    }

    /**
     * Computes column widths with caching
     * @private
     */
    // eslint-disable-next-line sonarjs/cognitive-complexity
    private calculateColumnWidths(): number[] {
        if (!this.isDirty && this.cachedColumnWidths) {
            return this.cachedColumnWidths;
        }

        const widths: number[] = Array.from<number>({ length: this.columnCount }).fill(0);

        // Helper to get content width based on cell options
        const getContentWidth = (cell: CellType): number => {
            const normalizedCell = this.normalizeCellOption(cell);
            const isEmpty = normalizedCell.content === "";

            let contentWidth: number;
            if (normalizedCell.maxWidth) {
                // For truncated cells, use maxWidth
                contentWidth = Math.min(stringWidth(normalizedCell.content), normalizedCell.maxWidth);
            } else if (normalizedCell.wordWrap) {
                // For word-wrapped cells, use the longest word length as minimum
                const words = normalizedCell.content.split(/\s+/);
                contentWidth = Math.max(...words.map((word) => stringWidth(word)));
            } else {
                // For normal cells, use the maximum line width
                const lines = normalizedCell.content.split("\n");
                contentWidth = Math.max(...lines.map((line) => stringWidth(line)));
            }

            // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
            return isEmpty ? 0 : contentWidth + this.options.style.paddingLeft + this.options.style.paddingRight;
        };

        // Process all rows including headers if shown
        const allRows = this.options.showHeader ? [...this.headers, ...this.rows] : this.rows;

        // Calculate minimum widths for each column
        // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
        for (const row of allRows) {
            let currentCol = 0;
            // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
            for (const cell of row) {
                if (currentCol >= this.columnCount) {
                    break;
                }

                const normalizedCell = this.normalizeCellOption(cell);
                const colSpan = Math.min(normalizedCell.colSpan ?? 1, this.columnCount - currentCol);
                const cellWidth = getContentWidth(cell);

                if (colSpan === 1) {
                    widths[currentCol] = Math.max(widths[currentCol] as number, cellWidth);
                } else {
                    // For spanning cells, calculate minimum width needed per column
                    const totalBorderWidth = colSpan - 1;
                    const widthNeeded = cellWidth - totalBorderWidth;
                    const minWidthPerCol = Math.ceil(widthNeeded / colSpan);

                    // Set minimum width for each column in span
                    // eslint-disable-next-line no-plusplus,no-loops/no-loops
                    for (let index = 0; index < colSpan && currentCol + index < this.columnCount; index++) {
                        widths[currentCol + index] = Math.max(widths[currentCol + index] as number, minWidthPerCol);
                    }
                }

                currentCol += colSpan;
            }
        }

        this.cachedColumnWidths = widths;
        this.isDirty = false;

        return widths;
    }

    private normalizeCellOption(cell: CellType): CellOptions & { content: string } {
        if (cell === null || cell === undefined || cell === "") {
            return {
                content: "",
                wordWrap: this.options.wordWrap,
            };
        }

        if (typeof cell === "object" && !Array.isArray(cell)) {
            let { content } = cell;

            if (content === null || content === undefined || content === "") {
                content = "";
            }

            return {
                ...cell,
                content: String(content),
                wordWrap: cell.wordWrap ?? this.options.wordWrap,
            };
        }

        return {
            content: String(cell),
            wordWrap: this.options.wordWrap,
        };
    }

    // eslint-disable-next-line class-methods-use-this
    private truncate(string_: string, maxWidth: number): string {
        /**
         * Gets the visible width of a string, accounting for ANSI escape codes.
         * @param string_ String to measure
         * @returns Visible width of the string
         */
            // eslint-disable-next-line @typescript-eslint/no-shadow
        const getContentWidth = (string_: string): number => {
            if (widthCache.has(string_)) {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                return widthCache.get(string_)!;
            }

            const width = stringWidth(stripVTControlCharacters(string_));

            widthCache.set(string_, width);

            return width;
        };

        if (getContentWidth(string_) <= maxWidth) {
            return string_;
        }

        // Handle strings with ANSI escape codes
        let currentWidth = 0;
        let result = "";
        let inEscapeSequence = false;
        let escapeSequence = "";
        let lastColorCode = "";

        // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
        for (const char of string_) {
            if (inEscapeSequence) {
                escapeSequence += char;

                if (char === "m") {
                    result += escapeSequence;
                    lastColorCode = escapeSequence;
                    inEscapeSequence = false;
                    escapeSequence = "";
                }
                // eslint-disable-next-line no-continue
                continue;
            }

            if (char === "\u001B") {
                inEscapeSequence = true;
                escapeSequence = char;
                // eslint-disable-next-line no-continue
                continue;
            }

            const charWidth = getContentWidth(char);

            if (currentWidth + charWidth > maxWidth - 1) {
                break;
            }

            currentWidth += charWidth;
            result += char;
        }

        // Add ellipsis and close any open color codes
        result += "…";

        if (lastColorCode) {
            result += "\u001B[0m";
        }

        return result;
    }

    // eslint-disable-next-line class-methods-use-this,sonarjs/cognitive-complexity
    private wordWrap(string_: string, width: number): string[] {
        if (width <= 0 || !string_) {
            return [string_];
        }

        // Quick check for strings that don't need wrapping
        if (stringWidth(string_) <= width) {
            return [string_];
        }

        // First split by newlines to preserve them
        const lines = string_.split(/\r?\n/);
        const result: string[] = [];

        // Precompile regex patterns
        // eslint-disable-next-line no-control-regex,regexp/no-control-character
        const colorPattern = /\u001B\[\d+m/g;
        // eslint-disable-next-line no-control-regex,regexp/no-control-character
        const linkPattern = /\u001B\]8;;([^\u0007]*)\u0007([^\u0007]*)\u001B\]8;;\u0007/g;

        // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
        for (const line of lines) {
            // Handle empty lines or whitespace
            if (!line.trim()) {
                result.push(line);
                // eslint-disable-next-line no-continue
                continue;
            }

            // Extract and store formatting sequences
            const formats: { index: number; sequence: string }[] = [];

            let plainText = line;

            // Extract color codes
            let match;

            // eslint-disable-next-line no-loops/no-loops,no-cond-assign
            while ((match = colorPattern.exec(line)) !== null) {
                formats.push({ index: match.index, sequence: match[0] });
            }

            // Extract hyperlinks
            // eslint-disable-next-line no-loops/no-loops,no-cond-assign
            while ((match = linkPattern.exec(line)) !== null) {
                formats.push({
                    index: match.index,
                    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
                    sequence: `\u001B]8;;${match[1]}\u0007${match[2]}\u001B]8;;\u0007`,
                });
            }

            // Sort formats by index
            formats.sort((a, b) => a.index - b.index);

            // Remove all formatting sequences for width calculation
            plainText = stripVTControlCharacters(line);

            // Split into words and calculate
            const words = plainText.split(/\s+/);
            let currentLine = "";
            let currentWidth = 0;
            let lastColor = "";

            // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
            for (const word of words) {
                const wordWidth = stringWidth(word);

                // Check if we need to start a new line
                // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
                if (currentWidth + wordWidth + (currentWidth > 0 ? 1 : 0) > width && currentLine) {
                    // Add any active color sequence closing
                    if (lastColor) {
                        currentLine += "\u001B[0m";
                    }
                    result.push(currentLine);
                    currentLine = "";
                    currentWidth = 0;
                }

                // Add space if needed
                if (currentLine) {
                    currentLine += " ";
                    currentWidth += 1;
                }

                // Reapply active formatting
                if (lastColor) {
                    currentLine += lastColor;
                }

                // Add word with its original formatting
                const wordStart = plainText.indexOf(word);
                let formattedWord = word;

                // Apply any formatting that should be present at this position
                // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
                for (const format of formats) {
                    if (format.index <= wordStart) {
                        if (format.sequence.startsWith("\u001B[")) {
                            lastColor = format.sequence;
                        }
                        formattedWord = format.sequence + formattedWord;
                    }
                }

                currentLine += formattedWord;
                // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
                currentWidth += wordWidth;
            }

            // Add the last line if any
            if (currentLine) {
                if (lastColor) {
                    currentLine += "\u001B[0m";
                }
                result.push(currentLine);
            }
        }

        return result;
    }

    // eslint-disable-next-line sonarjs/cognitive-complexity
    private renderRow(row: CellType[], columnWidths: number[], border: { left: string; middle: string; right: string }): string[] {
        const cells = row.map((cell) => this.normalizeCellOption(cell));
        const lines: string[] = [];

        // Process each cell and get their content lines
        const cellContents: string[][] = [];
        let maxLines = 1;

        // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
        for (const [index, cell] of cells.entries()) {
            const colSpan = Math.min(cell.colSpan ?? 1, this.columnCount - index);

            let totalWidth = columnWidths[index] as number;

            // eslint-disable-next-line no-loops/no-loops,@typescript-eslint/naming-convention,no-plusplus,no-underscore-dangle
            for (let index_ = 1; index_ < colSpan; index_++) {
                totalWidth += (columnWidths[index + index_] as number) + 1;
            }

            const content = String(cell.content);
            const isEmpty = content === "";
            // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
            const availableWidth = totalWidth - (isEmpty ? 0 : this.options.style.paddingLeft + this.options.style.paddingRight);

            let cellLines: string[];
            if (cell.wordWrap) {
                cellLines = this.wordWrap(content, availableWidth);
            } else if (cell.maxWidth) {
                cellLines = [this.truncate(content, cell.maxWidth)];
            } else {
                cellLines = content.split("\n");
            }

            cellContents.push(cellLines);
            maxLines = Math.max(maxLines, cellLines.length);
        }

        // Generate each line of the row
        // eslint-disable-next-line no-loops/no-loops,no-plusplus
        for (let lineIndex = 0; lineIndex < maxLines; lineIndex++) {
            let line = border.left;
            let currentCol = 0;

            // eslint-disable-next-line no-loops/no-loops,no-plusplus
            for (let cellIndex = 0; cellIndex < cells.length && currentCol < this.columnCount; cellIndex++) {
                const cell = cells[cellIndex] as CellOptions & { content: string };
                const content = (cellContents[cellIndex] as string[])[lineIndex] ?? "";
                const colSpan = Math.min(cell.colSpan ?? 1, this.columnCount - currentCol);

                if (currentCol > 0) {
                    line += border.middle;
                }

                let totalWidth = columnWidths[currentCol] as number;
                // eslint-disable-next-line no-loops/no-loops,no-plusplus
                for (let index = 1; index < colSpan; index++) {
                    totalWidth += (columnWidths[currentCol + index] as number) + 1;
                }

                const contentWidth = stringWidth(content);
                const isEmpty = cell.content === "";
                // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
                const availableWidth = totalWidth - (isEmpty ? 0 : this.options.style.paddingLeft + this.options.style.paddingRight);
                const remainingSpace = Math.max(0, availableWidth - contentWidth);

                if (!isEmpty) {
                    line += " ".repeat(this.options.style.paddingLeft);
                }

                // eslint-disable-next-line @typescript-eslint/switch-exhaustiveness-check
                switch (cell.hAlign) {
                    case "right": {
                        line += " ".repeat(remainingSpace) + content;
                        break;
                    }
                    case "center": {
                        const leftSpace = Math.floor(remainingSpace / 2);
                        const rightSpace = remainingSpace - leftSpace;
                        line += " ".repeat(leftSpace) + content + " ".repeat(rightSpace);
                        break;
                    }
                    default: {
                        line += content + " ".repeat(remainingSpace);
                    }
                }

                if (!isEmpty) {
                    line += " ".repeat(this.options.style.paddingRight);
                }

                currentCol += colSpan;
            }

            // eslint-disable-next-line no-loops/no-loops
            while (currentCol < this.columnCount) {
                if (currentCol > 0) {
                    line += border.middle;
                }
                line += " ".repeat(columnWidths[currentCol] as number);
                // eslint-disable-next-line no-plusplus
                currentCol++;
            }

            line += border.right;
            lines.push(line);
        }

        return lines;
    }

    /**
     * Creates a borderline for the table.
     * @param options Options for creating the line
     * @returns The created line string
     */
    private createLine(options: { body: string; left: string; middle: string; right: string }): string {
        const line = [];

        // eslint-disable-next-line no-plusplus,no-loops/no-loops
        for (let index = 0; index < this.columnWidths.length; index++) {
            line.push(options.body.repeat(this.columnWidths[index] as number));

            if (index < this.columnWidths.length - 1) {
                line.push(options.middle);
            }
        }

        return options.left + line.join("") + options.right;
    }
}

/**
 * Creates a new Table instance.
 * @param options Configuration options for the table
 * @returns New Table instance
 */
export const createTable = (options?: TableConstructorOptions): Table => new Table(options);
