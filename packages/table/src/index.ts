import { stripVTControlCharacters } from "node:util";

// eslint-disable-next-line import/no-extraneous-dependencies
import ansiRegex from "ansi-regex";
// eslint-disable-next-line import/no-extraneous-dependencies
import stringWidth from "string-width";
import type { RequiredDeep } from "type-fest";

import { DEFAULT_BORDER } from "./style";
import type { Cell as CellType, CellOptions, TableConstructorOptions, TruncateOptions } from "./types";
import { createTableLayout, getCellsInColumn, type TableLayout } from "./layout";

type CellContent = { cell: CellOptions & { content: string }; lines: string[]; isSpanCell?: boolean };

const ansiPattern = ansiRegex();

const findRealPosition = (text: string, visiblePosition: number): number => {
    let visibleIndex = 0;
    let match;

    // First pass: collect ANSI code positions
    const ansiRanges: { end: number; start: number }[] = [];

    ansiPattern.lastIndex = 0;

    // eslint-disable-next-line no-loops/no-loops,no-cond-assign
    while ((match = ansiPattern.exec(text)) !== null) {
        // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
        ansiRanges.push({ end: match.index + match[0].length, start: match.index });
    }

    // Second pass: calculate visual width
    let currentPos = 0;
    // eslint-disable-next-line no-loops/no-loops
    while (currentPos < stringWidth(text)) {
        // Skip ANSI codes
        // eslint-disable-next-line @typescript-eslint/no-loop-func
        const ansi = ansiRanges.find((r) => r.start === currentPos);

        if (ansi) {
            currentPos = ansi.end;
            // eslint-disable-next-line no-continue
            continue;
        }

        const char = text[currentPos];
        const charWidth = stringWidth(char as string);

        // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
        if (visibleIndex + charWidth > visiblePosition) {
            return currentPos;
        }

        // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
        visibleIndex += charWidth;
        // eslint-disable-next-line no-plusplus
        currentPos++;
    }

    return Math.min(stringWidth(text), visiblePosition) - 1;
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
    private layout: TableLayout | null = null;

    /**
     * Creates a new Table instance.
     * @param options Configuration options for the table
     */
    public constructor(options?: TableConstructorOptions) {
        this.options = {
            maxWidth: options?.maxWidth,
            showHeader: options?.showHeader ?? true,
            style: {
                border: DEFAULT_BORDER,
                paddingLeft: 1,
                paddingRight: 1,
                ...options?.style,
            },
            transformTabToSpace: 4,
            truncate: {
                position: "end",
                preferTruncationOnSpace: false,
                space: false,
                truncationCharacter: "…",
                ...options?.truncate,
            },
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
            // eslint-disable-next-line security/detect-object-injection
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
            // eslint-disable-next-line security/detect-object-injection
            const cell = row[index];

            if (cell) {
                const normalizedCell = this.normalizeCellOption(cell);

                currentCol += normalizedCell.colSpan ?? 1;

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
        this.layout = null; // Reset layout since table structure changed

        return this;
    }

    /**
     * Adds multiple rows to the table.
     * @param rows Array of rows to add
     * @returns This table instance for chaining
     */
    public addRows(...rows: CellType[][]): this {
        // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
        for (const row of rows) {
            this.addRow(row);
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

        // Create and initialize the layout
        const allRows = this.options.showHeader ? [...this.headers, ...this.rows] : this.rows;
        this.layout = createTableLayout(allRows);
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

        // Process each row
        for (let rowIndex = 0; rowIndex < allRows.length; rowIndex++) {
            // Get cells for this row from layout
            const rowCells = this.layout.cells.filter(cell => cell.y === rowIndex);

            // Sort cells by x position
            rowCells.sort((a, b) => a.x - b.x);

            // Render the row
            lines.push(
                ...this.renderRow(allRows[rowIndex], this.columnWidths, {
                    left: this.options.style.border?.bodyLeft ?? "",
                    middle: this.options.style.border?.bodyJoin ?? "",
                    right: this.options.style.border?.bodyRight ?? "",
                }),
            );

            // Add row separator if needed
            if (rowIndex < allRows.length - 1 && this.options.style.border?.joinBody) {
                // Get cells that span into the next row
                const spanningCells = this.layout.cells.filter(cell => {
                    return !cell.isSpanCell && cell.y <= rowIndex && cell.y + cell.height > rowIndex + 1;
                });

                // Skip separator if the entire row is spanned
                const isRowFullySpanned = spanningCells.reduce((acc, cell) => acc + cell.width, 0) === this.columnCount;

                if (!isRowFullySpanned) {
                    // Create a special separator that respects row spans
                    lines.push(
                        this.createSpannedLine(
                            {
                                body: this.options.style.border.joinBody ?? "",
                                left: this.options.style.border.joinLeft ?? "",
                                middle: this.options.style.border.joinJoin ?? "",
                                right: this.options.style.border.joinRight ?? "",
                            },
                            spanningCells.map(cell => ({
                                cell: {
                                    content: cell.content,
                                    rowSpan: cell.height,
                                    colSpan: cell.width,
                                    ...cell
                                } as CellType,
                                remainingSpan: cell.height - (rowIndex - cell.y + 1)
                            })),
                            allRows[rowIndex + 1],
                            this.columnWidths,
                        ),
                    );
                }
            }
        }

        // Add bottom border
        if (this.options.style.border?.bottomBody) {
            lines.push(
                this.createLine({
                    body: this.options.style.border.bottomBody,
                    left: this.options.style.border.bottomLeft ?? "",
                    middle: this.options.style.border.bottomJoin ?? "",
                    right: this.options.style.border.bottomRight ?? "",
                }),
            );
        }

        this.cachedString = lines.join("\n");
        this.isDirty = false;

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

        // Process all rows including headers if shown
        const allRows = this.options.showHeader ? [...this.headers, ...this.rows] : this.rows;

        // Calculate minimum widths for each column
        for (const row of allRows) {
            let currentCol = 0;
            for (const cell of row) {
                if (currentCol >= this.columnCount) {
                    break;
                }

                const normalizedCell = this.normalizeCellOption(cell);
                const colSpan = Math.min(normalizedCell.colSpan ?? 1, this.columnCount - currentCol);
                const cellWidth = this.calculateCellWidth(normalizedCell);

                if (colSpan === 1) {
                    widths[currentCol] = Math.max(widths[currentCol], cellWidth);
                } else {
                    // For spanning cells, calculate minimum width needed per column
                    const totalBorderWidth = colSpan - 1;
                    const widthNeeded = cellWidth - totalBorderWidth;
                    const minWidthPerCol = Math.ceil(widthNeeded / colSpan);

                    // Set minimum width for each column in span
                    for (let i = 0; i < colSpan && currentCol + i < this.columnCount; i++) {
                        widths[currentCol + i] = Math.max(widths[currentCol + i], minWidthPerCol);
                    }
                }

                currentCol += colSpan;
            }
        }

        this.cachedColumnWidths = widths;
        this.isDirty = false;

        return widths;
    }

    private calculateCellWidth(cell: CellOptions & { content: string }): number {
        // Apply cell-specific maxWidth if set, otherwise use global maxWidth
        const isEmpty = cell.content === "";

        let contentWidth: number;

        if (cell.maxWidth) {
            // For truncated cells, use maxWidth
            contentWidth = Math.min(stringWidth(cell.content), cell.maxWidth);
        } else if (cell.wordWrap) {
            // For word-wrapped cells, use the longest word length as minimum
            const words = cell.content.split(/\s+/);
            contentWidth = Math.max(...words.map((word) => stringWidth(word)));
        } else {
            // For normal cells, use the maximum line width
            const lines = cell.content.split("\n");
            contentWidth = Math.max(...lines.map((line) => stringWidth(line)));
        }

        // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
        return isEmpty ? 0 : contentWidth + this.options.style.paddingLeft + this.options.style.paddingRight;
    }

    private normalizeCellOption(cell: CellType): CellOptions & { content: string } {
        if (cell === null || cell === undefined || cell === "") {
            return {
                content: "",
                hAlign: "left",
                maxWidth: this.options.maxWidth,
                truncate: this.options.truncate,
                vAlign: "top",
                wordWrap: this.options.wordWrap,
            };
        }

        if (typeof cell === "object" && !Array.isArray(cell)) {
            if (
                cell.content !== null &&
                cell.content !== undefined &&
                cell.content !== "" &&
                typeof cell.content !== "string" &&
                typeof cell.content !== "number"
            ) {
                throw new TypeError("Cell content must be a string, undefined, null or number");
            }

            return {
                ...cell,
                content:
                    cell.content === null || cell.content === undefined || cell.content === ""
                        ? ""
                        : String(cell.content).replaceAll("\t", " ".repeat(this.options.transformTabToSpace)),
                hAlign: cell.hAlign || "left",
                maxWidth: cell.maxWidth ?? this.options.maxWidth,
                truncate: {
                    ...this.options.truncate,
                    ...cell.truncate,
                },
                vAlign: cell.vAlign || "top",
                wordWrap: cell.wordWrap ?? this.options.wordWrap,
            };
        }

        if (typeof cell !== "string" && typeof cell !== "number") {
            throw new TypeError("Cell input must be a string, object (CellType) or number");
        }

        return {
            content: String(cell).replaceAll("\t", " ".repeat(this.options.transformTabToSpace)),
            hAlign: "left",
            maxWidth: this.options.maxWidth,
            truncate: this.options.truncate,
            vAlign: "top",
            wordWrap: this.options.wordWrap,
        };
    }

    // eslint-disable-next-line class-methods-use-this
    private getIndexOfNearestSpace(string_: string, wantedIndex: number, shouldSearchRight = false): number {
        if (string_.charAt(wantedIndex) === " ") {
            return wantedIndex;
        }

        const direction = shouldSearchRight ? 1 : -1;

        // eslint-disable-next-line no-loops/no-loops,no-plusplus
        for (let index = 0; index <= 3; index++) {
            const finalIndex = wantedIndex + index * direction;

            if (string_.charAt(finalIndex) === " ") {
                return finalIndex;
            }
        }

        return wantedIndex;
    }

    // eslint-disable-next-line class-methods-use-this
    private preserveAnsiCodes(text: string, start: number, end: number): string {
        const openCodes: string[] = [];
        let match;

        // Track codes through entire range up to end
        ansiPattern.lastIndex = 0;
        // eslint-disable-next-line no-loops/no-loops,no-cond-assign
        while ((match = ansiPattern.exec(text)) !== null) {
            if (match.index > end) {
                break;
            }

            const code = match[0];
            if (code === "\u001B[0m") {
                // Reset when explicit reset found before end
                if (match.index < end) {
                    openCodes.length = 0;
                }
            } else if (
                code.startsWith("\u001B[") && // Track if code starts before end of slice
                match.index < end
            ) {
                openCodes.push(code);
            }
        }

        const slicedContent = text.slice(start, end);

        return openCodes.join("") + slicedContent + (openCodes.length > 0 ? "\u001B[0m" : "");
    }

    // eslint-disable-next-line sonarjs/cognitive-complexity
    private truncate(string_: string, maxWidth: number, options: Required<TruncateOptions>): string {
        if (typeof string_ !== "string") {
            throw new TypeError(`Expected input to be a string, got ${typeof string_}`);
        }

        if (typeof maxWidth !== "number") {
            throw new TypeError(`Expected maxWidth to be a number, got ${typeof maxWidth}`);
        }

        if (maxWidth < 1) {
            return "";
        }

        if (maxWidth === 1) {
            return options.truncationCharacter;
        }

        const visibleLength = stringWidth(string_);

        if (visibleLength <= maxWidth) {
            return string_;
        }

        const lines = string_.split("\n");

        let { truncationCharacter } = options;

        const truncatedLines = lines.map((line) => {
            const lineLength = stringWidth(line);

            if (lineLength <= maxWidth) {
                return line;
            }

            if (options.position === "start") {
                if (options.preferTruncationOnSpace) {
                    const nearestSpace = this.getIndexOfNearestSpace(line, lineLength - maxWidth + 1, true);

                    return truncationCharacter + this.preserveAnsiCodes(line, nearestSpace, line.length).trim();
                }

                if (options.space) {
                    truncationCharacter += " ";
                }

                // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
                const visibleStart = stringWidth(line) - maxWidth + stringWidth(truncationCharacter);
                const realStart = findRealPosition(line, visibleStart);

                return truncationCharacter + this.preserveAnsiCodes(line, realStart, line.length);
            }

            if (options.position === "middle") {
                if (options.space) {
                    truncationCharacter = ` ${truncationCharacter} `;
                }

                const half = Math.floor(maxWidth / 2);

                if (options.preferTruncationOnSpace) {
                    const spaceNearFirstBreakPoint = this.getIndexOfNearestSpace(line, half);
                    const spaceNearSecondBreakPoint = this.getIndexOfNearestSpace(line, lineLength - (maxWidth - half) + 1, true);

                    return (
                        this.preserveAnsiCodes(line, 0, spaceNearFirstBreakPoint) +
                        truncationCharacter +
                        this.preserveAnsiCodes(line, spaceNearSecondBreakPoint, line.length).trim()
                    );
                }

                const firstHalf = findRealPosition(line, half);
                // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
                const secondHalfStart = stringWidth(line) - (maxWidth - half) + stringWidth(truncationCharacter);
                const secondHalf = findRealPosition(line, secondHalfStart);

                return this.preserveAnsiCodes(line, 0, firstHalf) + truncationCharacter + this.preserveAnsiCodes(line, secondHalf, line.length);
            }

            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
            if (options.position === "end") {
                if (options.preferTruncationOnSpace) {
                    const nearestSpace = this.getIndexOfNearestSpace(line, maxWidth - 1);

                    return this.preserveAnsiCodes(line, 0, nearestSpace) + truncationCharacter;
                }

                if (options.space) {
                    truncationCharacter = ` ${truncationCharacter}`;
                }

                const endPos = findRealPosition(line, maxWidth - stringWidth(truncationCharacter));

                return this.preserveAnsiCodes(line, 0, endPos) + truncationCharacter;
            }

            // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
            throw new Error(`Expected options.position to be either 'start', 'middle' or 'end', got ${options.position}`);
        });

        return truncatedLines.join("\n");
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
        const lines: string[] = [];
        const cellContents: CellContent[] = [];
        let maxLines = 1;

        // Get layout cells for this row if layout exists
        const allRows = this.options.showHeader ? [...this.headers, ...this.rows] : this.rows;
        const rowY = allRows.findIndex(r => r === row);
        const layoutCells = rowY >= 0 && this.layout ? this.layout.cells.filter(cell => cell.y === rowY) : [];
        const cellsByX = new Map<number, LayoutCell>();
        layoutCells.forEach(cell => cellsByX.set(cell.x, cell));

        // First pass: Process each cell and get their content lines
        for (let [index, cell] of row.entries()) {
            const layoutCell = cellsByX.get(index);

            // Skip if this cell is part of a span
            if (layoutCell?.isSpanCell) {
                cellContents.push({
                    cell: { content: '', colSpan: 1 },
                    lines: [''],
                    isSpanCell: true
                });
                continue;
            }

            // Handle null cells (part of rowSpan)
            if (cell === null) {
                // This cell is part of a rowSpan, find the parent cell
                const parentCell = this.findParentCell(row, index);
                if (parentCell) {
                    cellContents.push({
                        cell: parentCell,
                        lines: [''],
                        isSpanCell: true
                    });
                } else {
                    // If no parent found, use empty cell
                    cellContents.push({
                        cell: { content: '', colSpan: 1 },
                        lines: [''],
                        isSpanCell: false
                    });
                }
                continue;
            }

            const normalizedCell = this.normalizeCellOption(cell);
            const colSpan = layoutCell?.width ?? normalizedCell.colSpan ?? 1;

            // Calculate total width considering column spans
            let totalWidth = columnWidths[index] as number;
            for (let i = 1; i < colSpan && index + i < columnWidths.length; i++) {
                totalWidth += (columnWidths[index + i] as number) + 1;
            }

            const content = String(normalizedCell.content);
            const isEmpty = content.trim() === "";
            const availableWidth = totalWidth - (isEmpty ? 0 : this.options.style.paddingLeft + this.options.style.paddingRight);

            let cellLines: string[] = [];

            // Handle word wrapping and truncation
            if (normalizedCell.wordWrap || normalizedCell.maxWidth) {
                if (normalizedCell.wordWrap) {
                    cellLines = this.wordWrap(content, availableWidth);
                    if (normalizedCell.maxWidth !== undefined) {
                        cellLines = cellLines.map((line) => this.truncate(line, normalizedCell.maxWidth as number, normalizedCell.truncate as Required<TruncateOptions>));
                    }
                } else if (normalizedCell.maxWidth !== undefined) {
                    cellLines = [this.truncate(content, normalizedCell.maxWidth, normalizedCell.truncate as Required<TruncateOptions>)];
                }
            } else {
                cellLines = content.split("\n");
            }

            // Calculate height needed for rowSpan
            const rowSpan = layoutCell?.height ?? normalizedCell.rowSpan ?? 1;
            const cellHeight = Math.max(rowSpan, cellLines.length);
            const emptyLines = cellHeight - cellLines.length;

            // Apply vertical alignment with rowSpan
            if (emptyLines > 0) {
                const emptyLine = " ".repeat(availableWidth);
                const padding = new Array(emptyLines).fill(emptyLine);

                switch (normalizedCell.vAlign) {
                    case "bottom": {
                        cellLines = [...padding, ...cellLines];
                        break;
                    }
                    case "middle": {
                        const topPadding = Math.floor(emptyLines / 2);
                        const bottomPadding = emptyLines - topPadding;
                        cellLines = [...new Array(topPadding).fill(emptyLine), ...cellLines, ...new Array(bottomPadding).fill(emptyLine)];
                        break;
                    }
                    default: {
                        // top
                        cellLines = [...cellLines, ...padding];
                        break;
                    }
                }
            }

            cellContents.push({ cell: normalizedCell, lines: cellLines, isSpanCell: false });
            maxLines = Math.max(maxLines, cellHeight);
        }

        // Generate each line of the row
        for (let lineIndex = 0; lineIndex < maxLines; lineIndex++) {
            let line = border.left;
            let currentCol = 0;

            for (let cellIndex = 0; cellIndex < row.length && currentCol < this.columnCount; cellIndex++) {
                // eslint-disable-next-line @typescript-eslint/no-shadow
                const { cell, lines, isSpanCell } = cellContents[cellIndex] as CellContent;
                const content = lines[lineIndex] ?? "";
                const colSpan = Math.min(cell.colSpan ?? 1, this.columnCount - currentCol);

                if (currentCol > 0) {
                    // Only add middle border if not in a row span
                    const prevCell = cellContents[cellIndex - 1];
                    const prevIsSpan = prevCell && prevCell.isSpanCell;
                    const currentIsSpan = isSpanCell;

                    if (!prevIsSpan || !currentIsSpan) {
                        line += border.middle;
                    } else {
                        line += " ";
                    }
                }

                // Calculate total width for the cell
                let totalWidth = columnWidths[currentCol] as number;
                for (let index = 1; index < colSpan; index++) {
                    totalWidth += (columnWidths[currentCol + index] as number) + 1;
                }

                const contentWidth = stringWidth(content);
                const isEmpty = content.trim() === "";
                const availableWidth = totalWidth - (isEmpty ? 0 : this.options.style.paddingLeft + this.options.style.paddingRight);
                const remainingSpace = Math.max(0, availableWidth - contentWidth);

                if (!isEmpty) {
                    line += " ".repeat(this.options.style.paddingLeft);
                }

                // Apply horizontal alignment
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
                        break;
                    }
                }

                if (!isEmpty) {
                    line += " ".repeat(this.options.style.paddingRight);
                }

                currentCol += colSpan;
            }

            // Fill remaining columns
            while (currentCol < this.columnCount) {
                if (currentCol > 0) {
                    line += border.middle;
                }
                line += " ".repeat(columnWidths[currentCol] as number);
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
            // eslint-disable-next-line security/detect-object-injection
            line.push(options.body.repeat(this.columnWidths[index] as number));

            if (index < this.columnWidths.length - 1) {
                line.push(options.middle);
            }
        }

        return options.left + line.join("") + options.right;
    }

    private createSpannedLine(
        options: { body: string; left: string; middle: string; right: string },
        spans: { cell: CellType; remainingSpan: number }[],
        currentRow: CellType[],
        columnWidths: number[],
    ): string {
        const parts: string[] = [];
        let currentCol = 0;

        // Process each column
        for (let i = 0; i < columnWidths.length; i++) {
            const width = columnWidths[i] as number;
            const isSpanned = spans.some(span => {
                const cell = span.cell;
                if (typeof cell !== 'object') return false;

                // Check if this column is part of a rowspan
                if (span.remainingSpan > 1) {
                    const startCol = currentRow.findIndex(c => c === cell);
                    if (startCol === -1) return false;
                    const colSpan = cell.colSpan || 1;
                    return i >= startCol && i < startCol + colSpan;
                }
                return false;
            });

            // Add appropriate characters based on whether this column is spanned
            if (isSpanned) {
                parts.push(' '.repeat(width));
            } else {
                parts.push(options.body.repeat(width));
            }

            // Add separator if not at last column
            if (i < columnWidths.length - 1) {
                const nextIsSpanned = spans.some(span => {
                    const cell = span.cell;
                    if (typeof cell !== 'object') return false;
                    if (span.remainingSpan <= 1) return false;

                    const startCol = currentRow.findIndex(c => c === cell);
                    if (startCol === -1) return false;
                    const colSpan = cell.colSpan || 1;
                    return (i + 1) >= startCol && (i + 1) < startCol + colSpan;
                });

                // Only add middle character if either current or next column is not spanned
                if (!isSpanned || !nextIsSpanned) {
                    parts.push(options.middle);
                } else {
                    parts.push(' ');
                }
            }

            currentCol += width + 1;
        }

        return options.left + parts.join('') + options.right;
    }

    private findParentCell(row: CellType[], index: number): CellOptions & { content: string } | undefined {
        if (!this.layout) return undefined;

        // Get the current row's y position
        const allRows = this.options.showHeader ? [...this.headers, ...this.rows] : this.rows;
        const rowY = allRows.findIndex(r => r === row);
        if (rowY === -1) return undefined;

        // Find a cell in the layout that spans to this position
        const parentCell = this.layout.cells.find(cell => {
            // Check if this cell spans to our target position
            return !cell.isSpanCell &&
                   cell.y < rowY &&
                   cell.y + cell.height > rowY &&
                   cell.x <= index &&
                   cell.x + cell.width > index;
        });

        if (!parentCell) return undefined;

        // Convert layout cell to cell options
        return {
            content: parentCell.content,
            rowSpan: parentCell.height,
            colSpan: parentCell.width,
            ...parentCell
        };


    }
}

/**
 * Creates a new Table instance.
 * @param options Configuration options for the table
 * @returns New Table instance
 */
export const createTable = (options?: TableConstructorOptions): Table => new Table(options);
