import { EOL } from "node:os";
import { stripVTControlCharacters } from "node:util";

// eslint-disable-next-line import/no-extraneous-dependencies
import stringWidth from "string-width";

import { DEFAULT_BORDER } from "./style";
import type { Border, BorderStyle, Cell, HorizontalAlign, TableOptions } from "./types";

interface NormalizedCell {
    colSpan?: number;
    content: number | string | null | undefined;
    hAlign: HorizontalAlign;
}

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

    public constructor(options: TableOptions = {}) {
        if (options.padding !== undefined && options.padding < 0) {
            throw new Error("padding must be a non-negative number");
        }

        if (options.maxWidth !== undefined && options.maxWidth <= 0) {
            throw new Error("maxWidth must be a positive number");
        }

        this.align = options.align ?? "left";
        this.border = options.border ?? DEFAULT_BORDER;
        this.columnWidths = [];
        this.headers = [];
        this.maxWidth = options.maxWidth;
        this.padding = options.padding ?? 1;
        this.rows = [];
        this.truncate = options.truncate ?? false;
        this.showHeader = options.showHeader ?? true;
    }

    public addRow(row: Cell[]): this {
        // Calculate the maximum column count from the current row
        let maxCol = 0;
        let currentCol = 0;

        row.forEach((cell) => {
            if (cell) {
                const normalizedCell = this.normalizeCellOption(cell);
                const colSpan = normalizedCell.colSpan ?? 1;
                maxCol = Math.max(maxCol, currentCol + colSpan);
                currentCol += colSpan;
            } else {
                maxCol = Math.max(maxCol, currentCol + 1);
                // eslint-disable-next-line no-plusplus
                currentCol++;
            }
        });

        // Update column count to be the maximum of current and new
        this.columnCount = Math.max(this.columnCount, maxCol);

        this.rows.push(row);
        this.layoutTable();

        return this;
    }

    public addRows(rows: Cell[][]): this {
        rows.forEach((row) => this.addRow(row));

        return this;
    }

    public setHeaders(headers: Cell[]): this {
        const processedHeaders: Cell[] = [];

        let maxCol = 0;
        let currentCol = 0;

        // First pass: Count total columns needed and create processed headers
        headers.forEach((cell) => {
            if (cell) {
                const normalizedCell = this.normalizeCellOption(cell);
                const colSpan = normalizedCell.colSpan ?? 1;

                // Add the cell
                // eslint-disable-next-line security/detect-object-injection
                processedHeaders[currentCol] = normalizedCell;

                // Add null cells for spanning columns
                // eslint-disable-next-line no-loops/no-loops,no-plusplus
                for (let index = 1; index < colSpan; index++) {
                    processedHeaders[currentCol + index] = null;
                }

                maxCol = Math.max(maxCol, currentCol + colSpan);
                currentCol += colSpan;
            } else {
                // eslint-disable-next-line security/detect-object-injection
                processedHeaders[currentCol] = null;
                maxCol = Math.max(maxCol, currentCol + 1);
                // eslint-disable-next-line no-plusplus
                currentCol++;
            }
        });

        // Second pass: Ensure array is fully populated
        // eslint-disable-next-line no-loops/no-loops,no-plusplus
        for (let index = 0; index < maxCol; index++) {
            // eslint-disable-next-line security/detect-object-injection
            if (processedHeaders[index] === undefined) {
                // eslint-disable-next-line security/detect-object-injection
                processedHeaders[index] = null;
            }
        }

        // Third pass: Verify column count matches header width
        let headerWidth = 0;

        processedHeaders.forEach((cell, index) => {
            if (cell) {
                const colSpan = this.normalizeCellOption(cell).colSpan ?? 1;

                headerWidth = Math.max(headerWidth, index + colSpan);
            } else {
                headerWidth = Math.max(headerWidth, index + 1);
            }
        });

        this.headers = [processedHeaders];
        this.columnCount = headerWidth;
        this.layoutTable();

        return this;
    }

    // eslint-disable-next-line sonarjs/cognitive-complexity
    public toString(): string {
        if (this.rows.length === 0) {
            return "";
        }

        this.columnWidths = this.computeColumnWidths();
        const lines: string[] = [];

        // Add top border
        if (this.border.topBody) {
            lines.push(
                this.createLine({
                    body: this.border.topBody,
                    left: this.border.topLeft ?? "",
                    middle: this.border.topJoin ?? "",
                    right: this.border.topRight ?? "",
                }),
            );
        }

        // Add headers if they exist and showHeader is true
        if (this.headers.length > 0 && this.showHeader) {
            this.headers.forEach((row) => {
                lines.push(
                    ...this.renderRow(row, this.columnWidths, {
                        left: this.border.bodyLeft ?? "",
                        middle: this.border.bodyJoin ?? "",
                        right: this.border.bodyRight ?? "",
                    }),
                );
            });

            // Add header separator
            if (this.border.joinBody) {
                lines.push(
                    this.createLine({
                        body: this.border.joinBody,
                        left: this.border.joinLeft ?? "",
                        middle: this.border.joinJoin ?? "",
                        right: this.border.joinRight ?? "",
                    }),
                );
            }
        }

        // Add rows
        this.rows.forEach((row, rowIndex) => {
            lines.push(
                ...this.renderRow(row, this.columnWidths, {
                    left: this.border.bodyLeft ?? "",
                    middle: this.border.bodyJoin ?? "",
                    right: this.border.bodyRight ?? "",
                }),
            );

            // Add row separator if not the last row
            if (rowIndex < this.rows.length - 1 && this.border.joinBody) {
                lines.push(
                    this.createLine({
                        body: this.border.joinBody,
                        left: this.border.joinLeft ?? "",
                        middle: this.border.joinJoin ?? "",
                        right: this.border.joinRight ?? "",
                    }),
                );
            }
        });

        // Add bottom border
        if (this.border.bottomBody) {
            lines.push(
                this.createLine({
                    body: this.border.bottomBody,
                    left: this.border.bottomLeft ?? "",
                    middle: this.border.bottomJoin ?? "",
                    right: this.border.bottomRight ?? "",
                }),
            );
        }

        return lines.join("");
    }

    private normalizeCellOption(cell: Cell): NormalizedCell {
        if (cell === null || cell === undefined) {
            return { content: cell, hAlign: this.align };
        }

        if (typeof cell === "object" && !Array.isArray(cell)) {
            return {
                colSpan: cell.colSpan,
                content: cell.content,
                hAlign: cell.hAlign ?? this.align,
            };
        }

        return { content: String(cell), hAlign: this.align };
    }

    // eslint-disable-next-line class-methods-use-this
    private strlen(string_: string): number {
        // First strip VT control characters (ANSI escape codes)
        const stripped = stripVTControlCharacters(string_);

        // Split into lines and find the longest one
        const lines = stripped.split("\n");

        // eslint-disable-next-line unicorn/no-array-reduce
        return lines.reduce((memo, s) => {
            // Use stringWidth to get the correct width for emojis and CJK characters
            const width = stringWidth(s);
            return width > memo ? width : memo;
        }, 0);
    }

    private truncateString(string_: string, maxWidth: number): string {
        if (!string_ || maxWidth <= 0) {
            return "";
        }

        // Get the actual visible length without ANSI codes
        const stringLength = this.strlen(string_);
        const ellipsis = "...";
        const ellipsisLength = this.strlen(ellipsis);

        if (stringLength <= maxWidth) {
            return string_;
        }

        if (maxWidth <= ellipsisLength) {
            return string_.slice(0, maxWidth);
        }

        // Extract ANSI codes and text content
        const ansiCodes: string[] = [];
        const ansiPositions: number[] = [];
        let plainText = string_;

        // Find all ANSI codes and store them with their positions
        // eslint-disable-next-line no-control-regex,regexp/no-control-character
        const ansiPattern = /\u001B\[\d+m/g;

        let match;
        let lastMatchEnd = 0;

        // eslint-disable-next-line no-loops/no-loops,no-cond-assign
        while ((match = ansiPattern.exec(string_)) !== null) {
            const code = match[0];
            const originalPosition = match.index;

            // Calculate position in plain text
            const adjustedPosition = originalPosition - lastMatchEnd;

            ansiCodes.push(code);
            ansiPositions.push(adjustedPosition);

            // Remove the code from plain text
            const beforeCode = plainText.slice(0, match.index - lastMatchEnd);
            const afterCode = plainText.slice(match.index - lastMatchEnd + code.length);

            plainText = beforeCode + afterCode;

            lastMatchEnd += code.length;
        }

        // Calculate truncation point for visible text
        const truncateAt = maxWidth - ellipsisLength;
        const truncatedText = plainText.slice(0, truncateAt);

        // Reconstruct the colored text
        let result = "";
        let lastPos = 0;
        let activeColorCode: string | undefined = "";

        // Find the last color code before truncation
        // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
        for (const [index, pos] of ansiPositions.entries()) {
            // eslint-disable-next-line security/detect-object-injection
            const code: string = ansiCodes[index] as string;

            if (pos <= truncateAt) {
                // This code is within the truncated text
                activeColorCode = code.includes("[0m") ? "" : code;
                result += truncatedText.slice(lastPos, pos) + code;
                lastPos = pos;
            }
        }

        // Add remaining text
        result += truncatedText.slice(lastPos);

        // Add ellipsis with active color
        result += activeColorCode ? ellipsis + "\u001B[0m" : ellipsis;

        return result;
    }

    private padCell(cell: Cell, width: number): string[] {
        const normalizedCell = this.normalizeCellOption(cell);

        if (normalizedCell.content === null || normalizedCell.content === undefined) {
            // For empty cells, return a fully padded line
            return [" ".repeat(width)];
        }

        const content = String(normalizedCell.content).replaceAll("\0", ""); // Remove null bytes
        const lines = content.split("\n");
        const paddedLines: string[] = [];

        // Calculate available width for content (subtract padding)
        const availableWidth = width;

        // For each line in the cell content
        // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
        for (const line of lines) {
            let processedLine = line;

            // If truncate is enabled and maxWidth is set, truncate the line
            if (this.truncate && this.maxWidth !== undefined) {
                // Account for borders and padding in maxWidth calculation
                const effectiveMaxWidth = availableWidth - this.padding * 2;
                processedLine = this.truncateString(line, effectiveMaxWidth);
            }

            const lineWidth = this.strlen(processedLine);
            const remainingWidth = Math.max(0, availableWidth - lineWidth - this.padding * 2);

            let contentWithPadding = "";

            switch (normalizedCell.hAlign) {
                case "right": {
                    contentWithPadding = " ".repeat(remainingWidth) + processedLine;
                    break;
                }
                case "center": {
                    const leftSpaces = Math.floor(remainingWidth / 2);
                    const rightSpaces = remainingWidth - leftSpaces;
                    contentWithPadding = " ".repeat(leftSpaces) + processedLine + " ".repeat(rightSpaces);
                    break;
                }
                default: {
                    // 'left'
                    contentWithPadding = processedLine + " ".repeat(remainingWidth);
                }
            }

            // Add left and right padding
            paddedLines.push(" ".repeat(this.padding) + contentWithPadding + " ".repeat(this.padding));
        }

        return paddedLines;
    }

    private createLine(border: Border): string {
        if (!border.body) {
            return "";
        }

        let line = "";

        // Add left border if present
        if (border.left) {
            line += border.left;
        }

        // Add body segments for each column with proper joins
        this.columnWidths.forEach((width, index) => {
            // Add the body character for the current column's width
            line += border.body.repeat(width);

            // Add middle join if not the last column
            if (index < this.columnWidths.length - 1 && border.middle) {
                line += border.middle;
            }
        });

        // Add right border if present
        if (border.right) {
            line += border.right;
        }

        return line + EOL;
    }

    private layoutTable(): void {
        // Calculate column widths
        this.columnWidths = this.computeColumnWidths();

        // Adjust column widths if maxWidth is set
        if (this.maxWidth) {
            const totalBorderWidth =
                (this.border.bodyLeft ? 1 : 0) + (this.border.bodyRight ? 1 : 0) + (this.columnWidths.length - 1) * (this.border.bodyJoin ? 1 : 0);
            const availableWidth = this.maxWidth - totalBorderWidth;

            if (this.columnWidths.reduce((sum, width) => sum + width, 0) > availableWidth) {
                const ratio = availableWidth / this.columnWidths.reduce((sum, width) => sum + width, 0);
                this.columnWidths = this.columnWidths.map((width) => Math.max(1, Math.floor(width * ratio)));
            }
        }
    }

    // eslint-disable-next-line sonarjs/cognitive-complexity
    private computeColumnWidths(): number[] {
        // Initialize widths array with minimum width for all columns
        const widths: number[] = Array.from<number>({ length: this.columnCount }).fill(1);

        // Process headers if they exist and are shown
        if (this.headers.length > 0 && this.showHeader) {
            this.headers.forEach((row) => {
                row.forEach((cell, columnIndex) => {
                    if (columnIndex < this.columnCount) {
                        const normalizedCell = this.normalizeCellOption(cell);
                        const colSpan = normalizedCell.colSpan ?? 1;

                        if (colSpan === 1) {
                            const content = String(normalizedCell.content ?? "");
                            const cellWidth = Math.max(1, this.strlen(content)) + this.padding * 2;

                            widths[columnIndex] = Math.max(widths[columnIndex] as number, cellWidth);
                        }
                    }
                });
            });
        }

        // Process rows
        this.rows.forEach((row) => {
            row.forEach((cell, columnIndex) => {
                if (columnIndex < this.columnCount) {
                    const normalizedCell = this.normalizeCellOption(cell);
                    const colSpan = normalizedCell.colSpan ?? 1;

                    if (colSpan === 1) {
                        const content = String(normalizedCell.content ?? "");
                        const cellWidth = Math.max(1, this.strlen(content)) + this.padding * 2;

                        // eslint-disable-next-line security/detect-object-injection
                        widths[columnIndex] = Math.max(widths[columnIndex] as number, cellWidth);
                    }
                }
            });
        });

        // If maxWidth is set, adjust column widths proportionally
        if (this.maxWidth !== undefined) {
            // Calculate border characters width
            const leftBorderWidth = this.border.bodyLeft ? 1 : 0;
            const rightBorderWidth = this.border.bodyRight ? 1 : 0;
            const joinWidth = this.border.bodyJoin ? this.columnCount - 1 : 0;
            const totalBorderWidth = leftBorderWidth + rightBorderWidth + joinWidth;

            // Calculate available width for content
            const availableWidth = this.maxWidth - totalBorderWidth;
            // Ensure each column has enough width for content plus padding
            const maxWidth = Math.floor(availableWidth / this.columnCount);

            widths.fill(maxWidth);

            return widths;
        }

        return widths;
    }

    // eslint-disable-next-line sonarjs/cognitive-complexity
    private renderRow(row: Cell[], columnWidths: number[], border: { left: string; middle: string; right: string }): string[] {
        if (row.length === 0) {
            return [];
        }

        const normalizedRow = row.map((cell) => this.normalizeCellOption(cell));
        const rowLines: string[] = [];
        const cellLines: string[][] = [];

        // Get lines for each cell
        normalizedRow.forEach((cell, columnIndex) => {
            // eslint-disable-next-line security/detect-object-injection
            let cellWidth: number = columnWidths[columnIndex] as number;

            const colSpan = cell.colSpan ?? 1;

            if (colSpan > 1) {
                // Add widths of spanned columns
                // eslint-disable-next-line no-loops/no-loops,no-plusplus
                for (let index = 1; index < colSpan && columnIndex + index < columnWidths.length; index++) {
                    cellWidth += columnWidths[columnIndex + index] as number;
                }

                // Add border width for the total span
                cellWidth += border.middle ? colSpan - 1 : 0;
            }

            const content = cell.content ?? "";

            // eslint-disable-next-line security/detect-object-injection
            cellLines[columnIndex] = this.padCell(
                {
                    ...cell,
                    content: this.truncate && String(content).length > cellWidth ? this.truncateString(String(content), cellWidth) : String(content),
                },
                cellWidth,
            );
        });

        // Get the maximum number of lines in any cell
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        const maxLines = Math.max(...cellLines.map((lines) => lines.length ?? 0));

        // For each line in the row
        // eslint-disable-next-line no-loops/no-loops,no-plusplus
        for (let lineIndex = 0; lineIndex < maxLines; lineIndex++) {
            let rowLine = border.left;
            let currentColumn = 0;

            // eslint-disable-next-line no-loops/no-loops
            while (currentColumn < normalizedRow.length) {
                // eslint-disable-next-line security/detect-object-injection
                const cell = normalizedRow[currentColumn];
                const colSpan = cell?.colSpan ?? 1;

                // eslint-disable-next-line security/detect-object-injection
                let cellWidth: number = columnWidths[currentColumn] as number;

                // Add widths of spanned columns
                // eslint-disable-next-line no-plusplus,no-loops/no-loops
                for (let index = 1; index < colSpan && currentColumn + index < columnWidths.length; index++) {
                    cellWidth += columnWidths[currentColumn + index] as number;
                }

                // Add border width for the total span
                if (colSpan > 1) {
                    cellWidth += border.middle ? colSpan - 1 : 0;
                }

                // Get the content for this line of the cell
                // eslint-disable-next-line security/detect-object-injection
                const cellContent = cellLines[currentColumn]?.[lineIndex] ?? " ".repeat(cellWidth);

                // Add the cell content
                rowLine += cellContent;

                // Add border unless it's the last cell or part of a spanning cell
                if (currentColumn + colSpan < normalizedRow.length && border.middle) {
                    rowLine += border.middle;
                }

                // Skip columns that are part of a span
                currentColumn += colSpan;
            }

            rowLine += border.right + EOL;
            rowLines.push(rowLine);
        }

        return rowLines;
    }
}

export const createTable = (options?: TableOptions): Table => new Table(options);

export type { BorderStyle, Cell, CellOptions, HorizontalAlign, TableOptions, VerticalAlign } from "./types";
