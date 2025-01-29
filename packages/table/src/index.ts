import { EOL } from "node:os";

// eslint-disable-next-line import/no-extraneous-dependencies
import stringWidth from "string-width";
// eslint-disable-next-line import/no-extraneous-dependencies
import stripAnsi from "strip-ansi";

import { DEFAULT_BORDER } from "./style";
import type { BorderStyle, Cell, CellOptions, HorizontalAlign, TableOptions } from "./types";

export class Table {
    private readonly rows: Cell[][] = [];

    private headers: Cell[][] = [];

    private columnWidths: number[] = [];

    private columnCount = 0;

    private readonly border: BorderStyle;

    private readonly align: HorizontalAlign;

    private readonly padding: number;

    private readonly truncate: boolean;

    private readonly maxWidth?: number;

    private readonly showHeader: boolean;

    constructor(options: TableOptions = {}) {
        this.border = options.border || DEFAULT_BORDER;
        this.align = options.align || "left";
        this.padding = options.padding || 1;
        this.truncate = options.truncate || false;
        this.maxWidth = options.maxWidth;
        this.showHeader = options.showHeader || true;
    }

    private normalizeCellOption(cell: Cell): CellOptions {
        if (cell === null || cell === undefined) {
            return { content: "" };
        }

        // Handle primitive types
        if (["bigint", "boolean", "number", "string"].includes(typeof cell)) {
            return { content: String(cell) };
        }

        // Handle object options
        if (typeof cell === "object") {
            const options = cell as CellOptions;
            return {
                ...options,
                colSpan: options.colSpan || 1,
                content: String(options.content || ""),
                hAlign: options.hAlign || this.align,
                rowSpan: options.rowSpan || 1,
                vAlign: options.vAlign || "middle",
            };
        }

        throw new Error("Cell content must be a primitive or object with content property");
    }

    private getCellWidth(cell: Cell): number {
        const normalizedCell = this.normalizeCellOption(cell);
        const content = normalizedCell.content.toString() || "";

        // For multi-line content, get the maximum line width
        return Math.max(...content.split("\n").map((line) => this.strlen(line)));
    }

    private strlen(string_: string): number {
        const split = stripAnsi(string_).split("\n");

        // eslint-disable-next-line unicorn/no-array-reduce
        return split.reduce((memo, s) => {
            const width = stringWidth(s);
            return width > memo ? width : memo;
        }, 0);
    }

    private truncateString(string_: string, maxWidth: number): string {
        if (!this.truncate || !maxWidth || this.strlen(string_) <= maxWidth) {
            return string_;
        }

        const truncateChar = "…";
        const truncateWidth = stringWidth(truncateChar);
        let result = "";
        let currentWidth = 0;

        // Handle ANSI escape sequences
        const chars = string_.split("");
        let inEscapeSequence = false;
        let currentEscapeSequence = "";

        for (const char of chars) {
            if (char === "\u001B") {
                inEscapeSequence = true;
                currentEscapeSequence = char;
                continue;
            }

            if (inEscapeSequence) {
                currentEscapeSequence += char;
                if (char === "m") {
                    result += currentEscapeSequence;
                    inEscapeSequence = false;
                }
                continue;
            }

            const charWidth = stringWidth(char);

            if (currentWidth + charWidth + truncateWidth > maxWidth) {
                break;
            }

            result += char;
            currentWidth += charWidth;
        }

        return result + truncateChar;
    }

    private padCell(cell: Cell, width: number): string[] {
        const normalizedCell = this.normalizeCellOption(cell);
        const content = normalizedCell.content.toString() || "";
        const lines = content.split("\n");
        const paddedLines: string[] = [];

        // Calculate maximum line width for truncation
        const maxContentWidth = this.maxWidth || width - this.padding * 2;

        // For each line in the cell content
        for (const line of lines) {
            const truncatedLine = this.truncateString(line, maxContentWidth);
            const lineWidth = this.strlen(truncatedLine);
            const padWidth = Math.max(0, width - this.padding * 2 - lineWidth);

            let paddedLine = "";
            // Left padding
            paddedLine += " ".repeat(this.padding);

            // Content with alignment
            switch (normalizedCell.hAlign || "left") {
                case "right": {
                    paddedLine += " ".repeat(padWidth) + truncatedLine;
                    break;
                }
                case "center": {
                    const leftPad = Math.floor(padWidth / 2);
                    const rightPad = padWidth - leftPad;
                    paddedLine += " ".repeat(leftPad) + truncatedLine + " ".repeat(rightPad);
                    break;
                }
                default: {
                    // 'left'
                    paddedLine += truncatedLine + " ".repeat(padWidth);
                }
            }

            // Right padding
            paddedLine += " ".repeat(this.padding);

            // Add the padded line to our list
            paddedLines.push(paddedLine);
        }

        return paddedLines;
    }

    private createLine(left: string, body: string, join: string, right: string): string {
        const result: string[] = [];
        for (let index = 0; index < this.columnCount; index++) {
            result.push(body.repeat(this.columnWidths[index]));
            if (index < this.columnCount - 1) {
                result.push(join);
            }
        }
        return left + result.join("") + right + EOL;
    }

    private layoutTable(): void {
        this.columnWidths = this.computeColumnWidths();
    }

    private computeColumnWidths(): number[] {
        const widths = new Array(this.columnCount).fill(0);
        const alignments = new Array(this.columnCount).fill("");

        // First pass: Calculate widths for header cells and store alignments
        this.headers.forEach((row) => {
            row.forEach((cell, index) => {
                if (cell) {
                    const normalizedCell = this.normalizeCellOption(cell);
                    const colSpan = normalizedCell.colSpan || 1;

                    if (colSpan === 1) {
                        widths[index] = Math.max(widths[index], this.getCellWidth(normalizedCell));
                        alignments[index] = normalizedCell.hAlign || "left";
                    }
                }
            });
        });

        // Second pass: Calculate widths for non-spanning cells in rows
        this.rows.forEach((row) => {
            row.forEach((cell, index) => {
                if (cell) {
                    const normalizedCell = this.normalizeCellOption(cell);
                    const colSpan = normalizedCell.colSpan || 1;

                    if (colSpan === 1) {
                        widths[index] = Math.max(widths[index], this.getCellWidth(normalizedCell));
                        // Use header alignment if not specified in cell
                        if (!normalizedCell.hAlign && alignments[index]) {
                            normalizedCell.hAlign = alignments[index];
                        }
                    }
                }
            });
        });

        // Add padding to all columns
        return widths.map((width) => width + this.padding * 2);
    }

    private addSpanningCells() {
        const positions = new Map<Cell, { x: number; y: number }>();

        this.rows.forEach((row, rowIndex) => {
            let x = 0;
            row.forEach((cell) => {
                if (cell) {
                    positions.set(cell, { x, y: rowIndex + this.headers.length });
                    const colSpan = this.normalizeCellOption(cell).colSpan || 1;

                    // Add the cell
                    x += colSpan;
                } else {
                    x++;
                }
            });
        });

        this.rows.forEach((row) => {
            row.forEach((cell) => {
                const normalizedCell = this.normalizeCellOption(cell);
                const colSpan = normalizedCell.colSpan || 1;
                const pos = positions.get(cell);

                if (!pos) {
                    return;
                }

                if (colSpan > 1) {
                    for (let index = 1; index < colSpan; index++) {
                        if (pos.x + index < row.length) {
                            row[pos.x + index] = undefined;
                        }
                    }
                }
            });
        });
    }

    private renderRow(row: Cell[], border: BorderStyle): string {
        const leftBorder = border.bodyLeft || "";
        const rightBorder = border.bodyRight || "";
        const joinBorder = border.bodyJoin || "";

        // Split each cell into lines
        const cellLines: string[][] = row.map((cell, index) => {
            if (cell === undefined || cell === null) {
                // For empty cells, create a properly padded empty cell
                let emptyCell = " ".repeat(this.padding); // Left padding
                emptyCell += " ".repeat(this.columnWidths[index] - this.padding * 2); // Content space
                emptyCell += " ".repeat(this.padding); // Right padding
                return [emptyCell];
            }

            const normalizedCell = this.normalizeCellOption(cell);
            const colSpan = normalizedCell.colSpan || 1;
            let totalWidth = this.columnWidths[index];

            // Calculate total width including borders for spanning cells
            for (let index_ = 1; index_ < colSpan && index + index_ < this.columnCount; index_++) {
                totalWidth += this.columnWidths[index + index_] + joinBorder.length;
            }

            return this.padCell(normalizedCell, totalWidth);
        });

        const maxLines = Math.max(...cellLines.map((lines) => lines.length));

        // Build each line of the row
        const rowLines: string[] = [];
        for (let lineIndex = 0; lineIndex < maxLines; lineIndex++) {
            let lineString = leftBorder;
            let currentCol = 0;

            while (currentCol < this.columnCount) {
                const cell = row[currentCol];
                if (cell === undefined || cell === null) {
                    lineString += cellLines[currentCol][0];
                    currentCol++;
                } else {
                    const normalizedCell = this.normalizeCellOption(cell);
                    const colSpan = normalizedCell.colSpan || 1;
                    const lines = cellLines[currentCol];

                    // For subsequent lines of multi-line cells, use empty space for the first and last columns
                    if (lineIndex > 0 && (currentCol === 0 || currentCol === this.columnCount - 1)) {
                        const emptyLine = " ".repeat(this.padding); // Left padding
                        const contentSpace = " ".repeat(this.columnWidths[currentCol] - this.padding * 2);
                        const rightPad = " ".repeat(this.padding); // Right padding
                        lineString += emptyLine + contentSpace + rightPad;
                    } else {
                        lineString += lines[lineIndex] || lines[0];
                    }

                    currentCol += colSpan;
                }

                if (currentCol < this.columnCount) {
                    lineString += joinBorder;
                }
            }

            lineString += rightBorder;
            rowLines.push(lineString);
        }

        return rowLines.join(EOL) + EOL;
    }

    public setHeaders(headers: Cell[]): this {
        const processedHeaders: Cell[] = [];
        let maxCol = 0;
        let currentCol = 0;

        // First pass: Count total columns needed and create processed headers
        headers.forEach((cell) => {
            if (cell) {
                const normalizedCell = this.normalizeCellOption(cell);
                const colSpan = normalizedCell.colSpan || 1;

                // Add the cell
                processedHeaders[currentCol] = normalizedCell;

                // Add null cells for spanning columns
                for (let index = 1; index < colSpan; index++) {
                    processedHeaders[currentCol + index] = null;
                }

                maxCol = Math.max(maxCol, currentCol + colSpan);
                currentCol += colSpan;
            } else {
                processedHeaders[currentCol] = null;
                maxCol = Math.max(maxCol, currentCol + 1);
                currentCol++;
            }
        });

        // Second pass: Ensure array is fully populated
        for (let index = 0; index < maxCol; index++) {
            if (processedHeaders[index] === undefined) {
                processedHeaders[index] = null;
            }
        }

        // Third pass: Verify column count matches header width
        let headerWidth = 0;
        processedHeaders.forEach((cell, index) => {
            if (cell) {
                const colSpan = this.normalizeCellOption(cell).colSpan || 1;
                headerWidth = Math.max(headerWidth, index + colSpan);
            } else {
                headerWidth = Math.max(headerWidth, index + 1);
            }
        });

        this.headers = [processedHeaders];
        this.columnCount = headerWidth;
        this.columnWidths = new Array(headerWidth).fill(0);
        this.layoutTable();
        return this;
    }

    public addRow(row: Cell[]): this {
        this.rows.push(row);
        this.layoutTable();
        this.addSpanningCells();
        return this;
    }

    public addRows(rows: Cell[][]): this {
        rows.forEach((row) => this.addRow(row));
        return this;
    }

    public toString(): string {
        let result = "";

        // Top border
        if (this.border.topBody) {
            result += this.createLine(this.border.topLeft || "", this.border.topBody, this.border.topJoin || "", this.border.topRight || "");
        }

        // Headers - only render if showHeader is true
        if (this.showHeader) {
            this.headers.forEach((row, index) => {
                result += this.renderRow(row, {
                    bodyJoin: this.border.bodyJoin || "",
                    bodyLeft: this.border.bodyLeft || "",
                    bodyRight: this.border.bodyRight || "",
                });

                // Add separator after header
                if (index === this.headers.length - 1 && this.border.joinBody) {
                    result += this.createLine(this.border.joinLeft || "", this.border.joinBody, this.border.joinJoin || "", this.border.joinRight || "");
                }
            });
        }

        // Body rows
        this.rows.forEach((row, index) => {
            result += this.renderRow(row, {
                bodyJoin: this.border.bodyJoin || "",
                bodyLeft: this.border.bodyLeft || "",
                bodyRight: this.border.bodyRight || "",
            });

            // Add row separator except for last row
            if (index < this.rows.length - 1 && this.border.joinBody) {
                result += this.createLine(this.border.joinLeft || "", this.border.joinBody, this.border.joinJoin || "", this.border.joinRight || "");
            }
        });

        // Bottom border
        if (this.border.bottomBody) {
            result += this.createLine(this.border.bottomLeft || "", this.border.bottomBody, this.border.bottomJoin || "", this.border.bottomRight || "");
        }

        return result;
    }
}

export const createTable = (options?: TableOptions): Table => new Table(options);

export type { BorderStyle, Cell, CellOptions, HorizontalAlign, TableOptions, VerticalAlign } from "./types";
