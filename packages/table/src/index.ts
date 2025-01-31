import { stripVTControlCharacters } from "node:util";

import stringWidth from "string-width";

import { DEFAULT_BORDER } from "./style";
import type { Cell as CellType, CellOptions, TableConstructorOptions } from "./types";

// Cache for string width calculations
const widthCache = new Map<string, number>();

/**
 * Gets the visible width of a string, accounting for ANSI escape codes.
 * @param str String to measure
 * @returns Visible width of the string
 */
const getContentWidth = (string_: string): number => {
    if (widthCache.has(string_)) {
        return widthCache.get(string_)!;
    }
    const width = stringWidth(stripVTControlCharacters(string_));
    widthCache.set(string_, width);
    return width;
};

/**
 * Normalizes a cell value into a CellType object.
 * @param cell The cell value to normalize
 * @returns Normalized cell object
 */
const normalizeCellOption = (cell: CellType): CellOptions & { content: string } => {
    if (cell === null || typeof cell !== "object") {
        if (cell === undefined || cell === null) {
            return { content: "" };
        }

        return { content: String(cell) };
    }

    if (cell.content === undefined || cell.content === null) {
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
    private readonly options: Required<TableConstructorOptions>;
    private columnWidths: number[] = [];
    private cachedColumnWidths: number[] | null = null;
    private cachedString: string | null = null;
    private isDirty = true;

    /**
     * Creates a new Table instance.
     * @param options Configuration options for the table
     */
    public constructor(options?: TableConstructorOptions) {
        // Avoid multiple spreads by doing a single merge
        const style = options?.style || {};
        this.options = {
            showHeader: options?.showHeader ?? true,
            style: {
                border: style.border || DEFAULT_BORDER,
                paddingLeft: style.paddingLeft ?? 1,
                paddingRight: style.paddingRight ?? 1,
            },
            truncate: options?.truncate ?? "…",
            wordWrap: options?.wordWrap ?? false,
        };
    }

    /**
     * Sets the table headers.
     * @param headers Array of header cells
     * @returns This table instance for chaining
     */
    public setHeaders(headers: CellType[]): this {
        const headerRows = [headers];
        let maxCol = 0;
        const length_ = headers.length;

        // Optimize loop for header column counting
        for (let index = 0; index < length_; index++) {
            const cell = headers[index];
            if (!cell) {
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
        const length_ = row.length;

        // Optimize loop for row column counting
        for (let index = 0; index < length_; index++) {
            const cell = row[index];
            if (cell) {
                const normalizedCell = normalizeCellOption(cell);
                const colSpan = normalizedCell.colSpan ?? 1;
                currentCol += colSpan;
                maxCol = Math.max(maxCol, currentCol);
            } else {
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
        const length_ = rows.length;
        for (let index = 0; index < length_; index++) {
            this.addRow(rows[index]);
        }
        return this;
    }

    /**
     * Computes column widths with caching
     * @private
     */
    private calculateColumnWidths(): number[] {
        if (!this.isDirty && this.cachedColumnWidths) {
            return this.cachedColumnWidths;
        }

        const widths: number[] = new Array(this.columnCount).fill(0);

        // Helper to get content width based on cell options
        const getContentWidth = (cell: CellType): number => {
            const normalizedCell = this.normalizeCellOption(cell);
            const content = String(normalizedCell.content ?? "");

            let contentWidth: number;
            if (normalizedCell.maxWidth) {
                // For truncated cells, use maxWidth
                contentWidth = Math.min(stringWidth(content), normalizedCell.maxWidth);
            } else if (normalizedCell.wordWrap) {
                // For word-wrapped cells, use the longest word length as minimum
                const words = content.split(/\s+/);
                contentWidth = Math.max(...words.map((word) => stringWidth(word)));
            } else {
                // For normal cells, use the maximum line width
                const lines = content.split("\n");
                contentWidth = Math.max(...lines.map((line) => stringWidth(line)));
            }

            return contentWidth + this.options.style.paddingLeft + this.options.style.paddingRight;
        };

        // Process all rows including headers if shown
        const allRows = this.options.showHeader ? [...this.headers, ...this.rows] : this.rows;

        // First pass: Calculate minimum widths for each column
        for (const row of allRows) {
            let currentCol = 0;
            for (const cell of row) {
                if (currentCol >= this.columnCount) {
                    break;
                }

                const normalizedCell = this.normalizeCellOption(cell);
                const colSpan = Math.min(normalizedCell.colSpan ?? 1, this.columnCount - currentCol);
                const cellWidth = getContentWidth(cell);

                if (colSpan === 1) {
                    widths[currentCol] = Math.max(widths[currentCol], cellWidth);
                } else {
                    // For spanning cells, calculate minimum width needed per column
                    const totalBorderWidth = colSpan - 1;
                    const widthNeeded = cellWidth - totalBorderWidth;
                    const minWidthPerCol = Math.ceil(widthNeeded / colSpan);

                    // Set minimum width for each column in span
                    for (let index = 0; index < colSpan && currentCol + index < this.columnCount; index++) {
                        widths[currentCol + index] = Math.max(widths[currentCol + index], minWidthPerCol);
                    }
                }

                currentCol += colSpan;
            }
        }

        // Second pass: Check if spanning cells fit and adjust if needed
        for (const row of allRows) {
            let currentCol = 0;
            for (const cell of row) {
                if (currentCol >= this.columnCount) {
                    break;
                }
                const normalizedCell = this.normalizeCellOption(cell);
                const colSpan = Math.min(normalizedCell.colSpan ?? 1, this.columnCount - currentCol);

                if (colSpan > 1) {
                    const cellWidth = getContentWidth(cell);
                    const currentWidth = widths.slice(currentCol, currentCol + colSpan).reduce((sum, w) => sum + w, 0);
                    const totalBorderWidth = colSpan - 1;

                    if (cellWidth > currentWidth + totalBorderWidth) {
                        const additionalNeeded = cellWidth - (currentWidth + totalBorderWidth);
                        const additionalPerCol = Math.ceil(additionalNeeded / colSpan);

                        for (let index = 0; index < colSpan && currentCol + index < this.columnCount; index++) {
                            widths[currentCol + index] += additionalPerCol;
                        }
                    }
                }

                currentCol += colSpan;
            }
        }

        this.cachedColumnWidths = widths;
        this.isDirty = false;

        return widths;
    }

    /**
     * Renders the table to a string.
     * @returns String representation of the table
     */
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
        if (this.options.style.border.topBody) {
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
                        left: this.options.style.border.bodyLeft ?? "",
                        middle: this.options.style.border.bodyJoin ?? "",
                        right: this.options.style.border.bodyRight ?? "",
                    }),
                );
            });

            // Add header separator if there are rows
            if (this.rows.length > 0 && this.options.style.border.joinBody) {
                lines.push(
                    this.createLine({
                        body: this.options.style.border.joinBody,
                        left: this.options.style.border.joinLeft ?? "",
                        middle: this.options.style.border.joinJoin ?? "",
                        right: this.options.style.border.joinRight ?? "",
                    }),
                );
            }
        }

        // Add rows
        this.rows.forEach((row, rowIndex) => {
            lines.push(
                ...this.renderRow(row, this.columnWidths, {
                    left: this.options.style.border.bodyLeft ?? "",
                    middle: this.options.style.border.bodyJoin ?? "",
                    right: this.options.style.border.bodyRight ?? "",
                }),
            );

            // Add row separator if not the last row
            if (rowIndex < this.rows.length - 1 && this.options.style.border.joinBody) {
                lines.push(
                    this.createLine({
                        body: this.options.style.border.joinBody,
                        left: this.options.style.border.joinLeft ?? "",
                        middle: this.options.style.border.joinJoin ?? "",
                        right: this.options.style.border.joinRight ?? "",
                    }),
                );
            }
        });

        // Add bottom border
        if (this.options.style.border.bottomBody) {
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
        return this.cachedString;
    }

    private normalizeCellOption(cell: CellType): CellOptions & { content: string } {
        if (cell === null || cell === undefined) {
            return {
                content: "",
                wordWrap: this.options.wordWrap,
            };
        }

        if (typeof cell === "object" && !Array.isArray(cell)) {
            return {
                ...cell,
                content: cell.content ?? "",
                wordWrap: cell.wordWrap ?? this.options.wordWrap,
            };
        }

        return {
            content: String(cell),
            wordWrap: this.options.wordWrap,
        };
    }

    private getLastColor(string_: string): string {
        const matches = string_.match(/\u001B\[[0-9;]*m/g);
        if (!matches) {
            return "";
        }
        return matches.at(-1);
    }

    private truncate(string_: string, maxWidth: number): string {
        if (getContentWidth(string_) <= maxWidth) {
            return string_;
        }

        // Handle strings with ANSI escape codes
        let currentWidth = 0;
        let result = "";
        let inEscapeSequence = false;
        let escapeSequence = "";
        let lastColorCode = "";

        for (const char of string_) {
            if (inEscapeSequence) {
                escapeSequence += char;
                if (char === "m") {
                    result += escapeSequence;
                    lastColorCode = escapeSequence;
                    inEscapeSequence = false;
                    escapeSequence = "";
                }
                continue;
            }

            if (char === "\u001B") {
                inEscapeSequence = true;
                escapeSequence = char;
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
        const colorPattern = /\u001B\[\d+m/g;
        const linkPattern = /\u001B\]8;;([^\u0007]*)\u0007([^\u0007]*)\u001B\]8;;\u0007/g;
        
        for (const line of lines) {
            // Handle empty lines or whitespace
            if (!line || !line.trim()) {
                result.push(line);
                continue;
            }

            // Extract and store formatting sequences
            const formats: Array<{ index: number; sequence: string }> = [];
            let plainText = line;

            // Extract color codes
            let match;
            while ((match = colorPattern.exec(line)) !== null) {
                formats.push({ index: match.index, sequence: match[0] });
            }

            // Extract hyperlinks
            while ((match = linkPattern.exec(line)) !== null) {
                formats.push({ 
                    index: match.index,
                    sequence: `\u001B]8;;${match[1]}\u0007${match[2]}\u001B]8;;\u0007`
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

            for (const word of words) {
                const wordWidth = stringWidth(word);

                // Check if we need to start a new line
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
                let wordStart = plainText.indexOf(word);
                let formattedWord = word;

                // Apply any formatting that should be present at this position
                for (const format of formats) {
                    if (format.index <= wordStart) {
                        if (format.sequence.startsWith("\u001B[")) {
                            lastColor = format.sequence;
                        }
                        formattedWord = format.sequence + formattedWord;
                    }
                }

                currentLine += formattedWord;
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

    private wrapPlainText(text: string, width: number): string[] {
        const result: string[] = [];
        let currentLine = "";
        let currentWidth = 0;

        // Split into words, preserving whitespace
        const words = text.split(/(\s+)/).filter(Boolean);

        for (const word of words) {
            // Handle whitespace
            if (/^\s+$/.test(word)) {
                if (currentWidth > 0 && currentWidth + 1 <= width) {
                    currentLine += word;
                    currentWidth += 1;
                }
                continue;
            }

            const wordWidth = stringWidth(word);

            // If the word is too long for a single line
            if (wordWidth > width) {
                // First add the current line if it has content
                if (currentLine) {
                    result.push(currentLine);
                    currentLine = "";
                    currentWidth = 0;
                }

                // Then split the long word
                let remaining = word;
                while (remaining) {
                    let chunk = "";
                    let index = 0;
                    while (index < remaining.length) {
                        const nextChar = remaining[index];
                        const nextWidth = stringWidth(chunk + nextChar);
                        if (nextWidth > width) {
                            break;
                        }
                        chunk += nextChar;
                        index++;
                    }
                    if (chunk) {
                        remaining = remaining.slice(chunk.length);
                    } else {
                        chunk = remaining[0];
                        remaining = remaining.slice(1);
                    }
                    result.push(chunk);
                }
                continue;
            }

            // If adding this word would exceed the width
            if (currentWidth + (currentWidth > 0 ? 1 : 0) + wordWidth > width) {
                result.push(currentLine);
                currentLine = word;
                currentWidth = wordWidth;
            } else {
                // Add word to current line
                if (currentWidth > 0) {
                    currentLine += " ";
                    currentWidth += 1;
                }
                currentLine += word;
                currentWidth += wordWidth;
            }
        }

        if (currentLine) {
            result.push(currentLine);
        }

        return result;
    }

    private renderRow(row: CellType[], columnWidths: number[], border: { left: string; middle: string; right: string }): string[] {
        const cells = row.map((cell) => this.normalizeCellOption(cell));
        const lines: string[] = [];

        // Process each cell and get their content lines
        const cellContents: string[][] = [];
        let maxLines = 1;

        for (const [index, cell] of cells.entries()) {
            const colSpan = Math.min(cell.colSpan ?? 1, this.columnCount - index);
            let totalWidth = columnWidths[index];
            for (let index_ = 1; index_ < colSpan; index_++) {
                totalWidth += columnWidths[index + index_] + 1;
            }

            const content = String(cell.content ?? "");
            const availableWidth = totalWidth - this.options.style.paddingLeft - this.options.style.paddingRight;

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
        for (let lineIndex = 0; lineIndex < maxLines; lineIndex++) {
            let line = border.left;
            let currentCol = 0;

            for (let cellIndex = 0; cellIndex < cells.length && currentCol < this.columnCount; cellIndex++) {
                const cell = cells[cellIndex];
                const colSpan = Math.min(cell.colSpan ?? 1, this.columnCount - currentCol);
                const content = cellContents[cellIndex][lineIndex] ?? "";

                if (currentCol > 0) {
                    line += border.middle;
                }

                let totalWidth = columnWidths[currentCol];
                for (let index = 1; index < colSpan; index++) {
                    totalWidth += columnWidths[currentCol + index] + 1;
                }

                const contentWidth = stringWidth(content);
                const availableWidth = totalWidth - this.options.style.paddingLeft - this.options.style.paddingRight;
                const remainingSpace = Math.max(0, availableWidth - contentWidth);

                line += " ".repeat(this.options.style.paddingLeft);

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

                line += " ".repeat(this.options.style.paddingRight);
                currentCol += colSpan;
            }

            while (currentCol < this.columnCount) {
                if (currentCol > 0) {
                    line += border.middle;
                }
                line += " ".repeat(columnWidths[currentCol]);
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

        for (let index = 0; index < this.columnWidths.length; index++) {
            const width = this.columnWidths[index];
            line.push(options.body.repeat(width));

            if (index < this.columnWidths.length - 1) {
                line.push(options.middle);
            }
        }

        return options.left + line.join("") + options.right;
    }

    private alignContent(content: string, availableSpace: number, alignment: string): string {
        const lines = content.split("\n");
        const contentWidth = Math.max(...lines.map((line) => stringWidth(line)));
        const effectiveWidth = Math.min(contentWidth, availableSpace);

        let paddedContent = "";
        for (const line of lines) {
            const lineWidth = stringWidth(line);
            const padding = effectiveWidth - lineWidth;

            switch (alignment) {
                case "right": {
                    paddedContent += " ".repeat(padding) + line + "\n";
                    break;
                }
                case "center": {
                    const leftPadding = Math.floor(padding / 2);
                    const rightPadding = padding - leftPadding;
                    paddedContent += " ".repeat(leftPadding) + line + " ".repeat(rightPadding) + "\n";
                    break;
                }
                default: {
                    // left alignment
                    paddedContent += line + " ".repeat(padding) + "\n";
                }
            }
        }

        return paddedContent.trim();
    }
}

/**
 * Creates a new Table instance.
 * @param options Configuration options for the table
 * @returns New Table instance
 */
export const createTable = (options?: TableConstructorOptions): Table => new Table(options);
