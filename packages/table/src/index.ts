import { stripVTControlCharacters } from "node:util";

import ansiRegex from "ansi-regex";
import stringWidth from "string-width";
import type { RequiredDeep } from "type-fest";

import { DEFAULT_BORDER } from "./style";
import type { Cell as CellType, CellOptions, TableConstructorOptions, TruncateOptions } from "./types";

/* ─────────────── Layout Code ─────────────── */

/** Describes a cell’s layout (its position and span). */
export interface LayoutCell extends CellOptions {
    height: number;
    isSpanCell?: boolean;
    parentCell?: LayoutCell;
    width: number;
    x: number;
    y: number;
}

/** The complete table layout. */
export interface TableLayout {
    cells: LayoutCell[];
    height: number;
    width: number;
}

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
function createTableLayout(rows: CellType[][]): TableLayout {
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
    // (But some cells might extend downward. We’ll find the max.)
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

const globalAnsiPattern = ansiRegex();

/** Finds the real (non‑ANSI) character index in text corresponding to the visible position. */
function findRealPosition(text: string, visiblePosition: number): number {
    let visibleIndex = 0;
    let match: RegExpExecArray | null = null;
    const ansiRanges: { end: number; start: number }[] = [];
    globalAnsiPattern.lastIndex = 0;
    while ((match = globalAnsiPattern.exec(text)) !== null) {
        ansiRanges.push({ end: match.index + match[0].length, start: match.index });
    }
    let currentIndex = 0;
    while (currentIndex < text.length) {
        const range = ansiRanges.find((r) => currentIndex >= r.start && currentIndex < r.end);
        if (range) {
            currentIndex = range.end;
            continue;
        }
        const charWidth = stringWidth(text[currentIndex]);
        if (visibleIndex + charWidth > visiblePosition) {
            return currentIndex;
        }
        visibleIndex += charWidth;
        currentIndex++;
    }
    return Math.min(stringWidth(text), visiblePosition) - 1;
}

/** Computes the logical width of a row (the sum of colSpans, defaulting to 1 per cell). */
function computeRowLogicalWidth(row: CellType[]): number {
    return row.reduce((total, cell) => {
        if (cell === null) return total + 1;
        if (typeof cell === "object" && !Array.isArray(cell)) return total + (cell.colSpan ?? 1);
        return total + 1;
    }, 0);
}

/** Pads a row with null cells so that its logical width equals targetWidth. */
function fillRowToWidth(row: CellType[], targetWidth: number): CellType[] {
    const currentWidth = computeRowLogicalWidth(row);
    if (currentWidth < targetWidth) {
        return row.concat(new Array(targetWidth - currentWidth).fill(null));
    }
    return row;
}

/** Returns the underlying “real” cell (if a span cell, returns its parent). */
function getRealCell(layoutCell: LayoutCell | null): LayoutCell | null {
    if (!layoutCell) return null;
    return layoutCell.isSpanCell ? layoutCell.parentCell || layoutCell : layoutCell;
}

/** Checks whether two layout cells represent the same originating cell. */
function areCellsEquivalent(cellA: LayoutCell | null, cellB: LayoutCell | null): boolean {
    const realA = getRealCell(cellA);
    const realB = getRealCell(cellB);
    return realA === realB;
}

/** The main Table class. */
export class Table {
    private readonly rows: CellType[][] = [];
    private headers: CellType[][] = [];
    private columnCount = 0; // Global logical column count (widest row in terms of sum of colSpans)
    private readonly options: RequiredDeep<TableConstructorOptions>;
    private columnWidths: number[] = [];
    private cachedColumnWidths: number[] | null = null;
    private cachedString: string | null = null;
    private isDirty = true;
    private layout: TableLayout | null = null;
    private readonly borderStyle: typeof DEFAULT_BORDER;

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
        this.borderStyle = this.options.style.border;
    }

    public setHeaders(headers: CellType[]): this {
        const logicalWidth = computeRowLogicalWidth(headers);
        this.columnCount = Math.max(this.columnCount, logicalWidth);
        this.headers = [fillRowToWidth(headers, this.columnCount)];
        this.isDirty = true;
        return this;
    }

    public addRow(row: CellType[]): this {
        const logicalWidth = computeRowLogicalWidth(row);
        this.columnCount = Math.max(this.columnCount, logicalWidth);
        this.rows.push(fillRowToWidth(row, this.columnCount));
        this.isDirty = true;
        this.layout = null;
        return this;
    }

    public addRows(...rows: CellType[][]): this {
        for (const row of rows) {
            this.addRow(row);
        }
        return this;
    }

    // Use an arrow function for createLine so that "this" is bound.
    private readonly createLine = (options: { body: string; left: string; middle: string; right: string }): string => {
        const { body, left, middle, right } = options;
        const parts = Array.from({ length: this.columnWidths.length });
        for (let index = 0; index < this.columnWidths.length; index++) {
            parts[index] = body.repeat(this.columnWidths[index]);
            if (index < this.columnWidths.length - 1) parts[index] += middle;
        }
        return left + parts.join("") + right;
    };

    public toString(): string {
        // ─── If borders are disabled, simply join cell contents.
        const borderDisabled = Object.values(this.borderStyle).every((v) => v === "");
        if (borderDisabled) {
            const allRows = this.options.showHeader ? [...this.headers, ...this.rows] : this.rows;
            const widths = this.calculateColumnWidths();
            return allRows
                .map((row) => {
                    let colIndex = 0;
                    return row
                        .map((cell) => {
                            const norm = this.normalizeCellOption(cell);
                            const leftPad = " ".repeat(this.options.style.paddingLeft);
                            const rightPad = " ".repeat(this.options.style.paddingRight);
                            const availableWidth = widths[colIndex] - this.options.style.paddingLeft - this.options.style.paddingRight;
                            colIndex++;
                            return leftPad + norm.content.padEnd(availableWidth, " ") + rightPad;
                        })
                        .join("");
                })
                .join("\n");
        }

        if (!this.isDirty && this.cachedString !== null) {
            return this.cachedString;
        }
        if (this.rows.length === 0 && this.headers.length === 0) {
            this.cachedString = "";
            return "";
        }
        const allRows = this.options.showHeader ? [...this.headers, ...this.rows] : this.rows;

        // ─── Build the layout and calculate column widths.
        this.layout = createTableLayout(allRows);
        // Sort layout cells by row (y) then by column (x)
        this.layout.cells.sort((a, b) => a.y - b.y || a.x - b.x);
        this.columnWidths = this.calculateColumnWidths();

        const outputLines: string[] = [];

        // ─── Helper: groupRowForDisplay ───
        // For a given row index, loop over logical columns 0..(this.columnCount - 1)
        // and find the covering layout cell. For each column we “prefer” a cell that
        // starts exactly at that row (i.e. a “main” cell) and, if none is found, use any cell covering it.
        // We normalize each cell via getRealCell(), then group adjacent columns whose normalized cells are equivalent.
        // Each group is an object { start, end, cell }.
        const groupRowForDisplay = (rowIndex: number): { cell: LayoutCell | null; end: number; start: number }[] => {
            const mapping: (LayoutCell | null)[] = [];
            for (let col = 0; col < this.columnCount; col++) {
                // Prefer a cell that starts exactly at rowIndex and isn’t a span placeholder.
                let cell = this.layout.cells.find((c) => c.x <= col && c.x + c.width > col && c.y === rowIndex && !c.isSpanCell);
                if (!cell) {
                    // Fall back: pick any cell covering this column.
                    cell = this.layout.cells.find((c) => c.x <= col && c.x + c.width > col && c.y <= rowIndex && c.y + c.height > rowIndex);
                }
                mapping.push(cell ? getRealCell(cell) : null);
            }
            const groups: { cell: LayoutCell | null; end: number; start: number }[] = [];
            if (mapping.length === 0) return groups;
            let currentGroup = { cell: mapping[0], end: 0, start: 0 };
            for (let index = 1; index < mapping.length; index++) {
                if (areCellsEquivalent(mapping[index], currentGroup.cell)) {
                    currentGroup.end = index;
                } else {
                    groups.push(currentGroup);
                    currentGroup = { cell: mapping[index], end: index, start: index };
                }
            }
            groups.push(currentGroup);
            return groups;
        };

        // ─── Helper: effectiveWidth ───
        // For a group covering columns from group.start to group.end,
        // effective width = sum(columnWidths) + (group.end - group.start) extra for omitted joins.
        const effectiveWidth = (group: { cell: LayoutCell | null; end: number; start: number }): number => {
            const base = this.columnWidths.slice(group.start, group.end + 1).reduce((sum, w) => sum + w, 0);
            return base + (group.end - group.start);
        };

        const {
            bodyLeft,
            bodyRight,
            bottomBody,
            bottomJoin,
            bottomLeft,
            bottomRight,
            joinBody,
            joinJoin,
            joinLeft,
            joinRight,
            topBody,
            topJoin,
            topLeft,
            topRight,
        } = this.borderStyle;

        // ─── Top Border ───
        // First, get the grouping for row 0 (if headers are used, row 0 is the header row).
        const groups = groupRowForDisplay(0);
        // If the number of groups is less than the total column count, then some cells are merged.
        if (groups.length < this.columnCount) {
            // Build a merged top border using the effective widths of the groups.
            let topBorder = topLeft;

            groups.forEach((group, index) => {
                // Effective width = (sum of columnWidths for group) + (group.end - group.start)
                const baseWidth = this.columnWidths.slice(group.start, group.end + 1).reduce((sum, w) => sum + w, 0);
                const extra = group.end - group.start;
                const groupWidth = baseWidth + extra;

                topBorder += topBody.repeat(groupWidth);

                if (index < groups.length - 1) {
                    topBorder += topJoin;
                }
            });

            topBorder += topRight;
            outputLines.push(topBorder);
        } else {
            // Otherwise, use the normal createLine method.
            outputLines.push(
                this.createLine({
                    body: topBody,
                    left: topLeft,
                    middle: topJoin,
                    right: topRight,
                }),
            );
        }

        // ─── Render Rows and Separators ───
        for (let rowIndex = 0; rowIndex < allRows.length; rowIndex++) {
            const renderedRowLines = this.renderRow(allRows[rowIndex], this.columnWidths, rowIndex);

            outputLines.push(...renderedRowLines);

            if (rowIndex < allRows.length - 1) {
                let separatorLine = "";

                if (rowIndex === this.headers.length - 1) {
                    const rowGroups = groupRowForDisplay(this.headers.length);

                    separatorLine += joinLeft;

                    rowGroups.forEach((group, index) => {
                        separatorLine += joinBody.repeat(effectiveWidth(group));
                        if (index < rowGroups.length - 1) {
                            // For header separator, use headerJoin if defined; otherwise, default to joinJoin.
                            separatorLine += joinJoin;
                        }
                    });

                    separatorLine += joinRight;
                } else {
                    // Normal separators between body rows – use spanned flags.
                    const spanned: boolean[] = [];

                    for (let colIndex = 0; colIndex < this.columnCount; colIndex++) {
                        const cell = this.layout.cells.find((c) => c.x <= colIndex && c.x + c.width > colIndex && c.y <= rowIndex && c.y + c.height > rowIndex);

                        spanned[colIndex] = cell ? rowIndex + 1 < cell.y + cell.height : false;
                    }

                    separatorLine += spanned[0] ? bodyLeft : joinLeft;

                    for (let colIndex = 0; colIndex < this.columnCount; colIndex++) {
                        separatorLine += spanned[colIndex] ? " ".repeat(this.columnWidths[colIndex]) : joinBody.repeat(this.columnWidths[colIndex]);

                        if (colIndex < this.columnCount - 1) {
                            const cellBelowLeft = this.layout.cells.find(
                                (c) => c.x <= colIndex && c.x + c.width > colIndex && c.y <= rowIndex + 1 && c.y + c.height > rowIndex + 1,
                            );

                            const cellBelowRight = this.layout.cells.find(
                                (c) => c.x <= colIndex + 1 && c.x + c.width > colIndex + 1 && c.y <= rowIndex + 1 && c.y + c.height > rowIndex + 1,
                            );

                            let joinChar;

                            if (cellBelowLeft && cellBelowRight && areCellsEquivalent(cellBelowLeft, cellBelowRight)) {
                                joinChar = bottomJoin;
                            } else {
                                const leftSpanned = spanned[colIndex]; // Boolean flag for left column (might be false if it's the starting column)
                                const rightSpanned = spanned[colIndex + 1]; // Boolean flag for right column (true if it’s a continuation of a spanning cell)

                                if (leftSpanned && rightSpanned) {
                                    joinChar = topJoin;
                                } else if (rightSpanned) {
                                    joinChar = joinRight;
                                } else if (leftSpanned) {
                                    joinChar = joinLeft;
                                } else {
                                    joinChar = joinJoin;
                                }
                            }

                            separatorLine += joinChar;
                        }
                    }

                    separatorLine += spanned[this.columnCount - 1] ? bodyRight : joinRight;
                }

                outputLines.push(separatorLine);
            }
        }

        // ─── Bottom Border ───
        let bottomBorder = bottomLeft;
        const bottomGroups = groupRowForDisplay(allRows.length - 1);
        bottomGroups.forEach((group, index) => {
            bottomBorder += (bottomBody ?? "").repeat(effectiveWidth(group));
            if (index < bottomGroups.length - 1) {
                bottomBorder += bottomJoin ?? "";
            }
        });
        bottomBorder += bottomRight ?? "";
        outputLines.push(bottomBorder);

        this.cachedString = outputLines.join("\n");
        this.isDirty = false;
        return this.cachedString;
    }

    private calculateColumnWidths(): number[] {
        if (!this.isDirty && this.cachedColumnWidths) {
            return this.cachedColumnWidths;
        }
        const widths: number[] = new Array(this.columnCount).fill(0);
        const allRows = this.options.showHeader ? [...this.headers, ...this.rows] : this.rows;
        for (const currentRow of allRows) {
            let currentColumnIndex = 0;
            for (const cell of currentRow) {
                if (currentColumnIndex >= this.columnCount) {
                    break;
                }
                const normalizedCell = this.normalizeCellOption(cell);
                const cellWidth = this.calculateCellWidth(normalizedCell);
                const colSpan = Math.min(normalizedCell.colSpan ?? 1, this.columnCount - currentColumnIndex);
                if (colSpan === 1) {
                    widths[currentColumnIndex] = Math.max(widths[currentColumnIndex], cellWidth);
                } else {
                    const borderTotal = colSpan - 1;
                    const eachWidth = Math.ceil((cellWidth - borderTotal) / colSpan);
                    for (let offset = 0; offset < colSpan; offset++) {
                        widths[currentColumnIndex + offset] = Math.max(widths[currentColumnIndex + offset], eachWidth);
                    }
                }
                currentColumnIndex += colSpan;
            }
        }
        this.cachedColumnWidths = widths;
        this.isDirty = false;
        return widths;
    }

    private calculateCellWidth(cell: CellOptions & { content: string }): number {
        const isEmpty = cell.content === "";
        let contentWidth: number;
        if (cell.maxWidth) {
            contentWidth = Math.min(stringWidth(cell.content), cell.maxWidth);
        } else if (cell.wordWrap) {
            const words = cell.content.split(/\s+/);
            contentWidth = Math.max(...words.map((word) => stringWidth(word)));
        } else {
            const lines = cell.content.split("\n");
            contentWidth = Math.max(...lines.map((line) => stringWidth(line)));
        }
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
                truncate: cell.truncate === undefined ? this.options.truncate : { ...this.options.truncate, ...cell.truncate },
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

    private getIndexOfNearestSpace(text: string, targetIndex: number, searchRight = false): number {
        if (text.charAt(targetIndex) === " ") {
            return targetIndex;
        }
        const direction = searchRight ? 1 : -1;
        for (let offset = 0; offset <= 3; offset++) {
            const pos = targetIndex + offset * direction;
            if (text.charAt(pos) === " ") {
                return pos;
            }
        }
        return targetIndex;
    }

    private preserveAnsiCodes(text: string, startIndex: number, endIndex: number): string {
        const openCodes: string[] = [];
        let match: RegExpExecArray | null = null;
        globalAnsiPattern.lastIndex = 0;
        while ((match = globalAnsiPattern.exec(text)) !== null) {
            if (match.index > endIndex) {
                break;
            }
            const code = match[0];
            if (code === "\u001B[0m") {
                if (match.index < endIndex) {
                    openCodes.length = 0;
                }
            } else if (code.startsWith("\u001B[") && match.index < endIndex) {
                openCodes.push(code);
            }
        }
        const slicedText = text.slice(startIndex, endIndex);
        return openCodes.join("") + slicedText + (openCodes.length > 0 ? "\u001B[0m" : "");
    }

    private truncate(text: string, maxWidth: number, options: Required<TruncateOptions>): string {
        if (typeof text !== "string") {
            throw new TypeError(`Expected input to be a string, got ${typeof text}`);
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
        const visibleLength = stringWidth(text);
        if (visibleLength <= maxWidth) {
            return text;
        }
        const lines = text.split("\n");
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
                const visibleStart = stringWidth(line) - maxWidth + stringWidth(truncationCharacter);
                const realStart = findRealPosition(line, visibleStart);
                return truncationCharacter + this.preserveAnsiCodes(line, realStart, line.length);
            }
            if (options.position === "middle") {
                if (options.space) {
                    truncationCharacter = ` ${truncationCharacter} `;
                }
                const halfWidth = Math.floor(maxWidth / 2);
                if (options.preferTruncationOnSpace) {
                    const spaceNearFirst = this.getIndexOfNearestSpace(line, halfWidth);
                    const spaceNearSecond = this.getIndexOfNearestSpace(line, line.length - (maxWidth - halfWidth) + 1, true);
                    return (
                        this.preserveAnsiCodes(line, 0, spaceNearFirst) +
                        truncationCharacter +
                        this.preserveAnsiCodes(line, spaceNearSecond, line.length).trim()
                    );
                }
                const firstHalf = findRealPosition(line, halfWidth);
                const secondHalfStart = stringWidth(line) - (maxWidth - halfWidth) + stringWidth(truncationCharacter);
                const secondHalf = findRealPosition(line, secondHalfStart);
                return this.preserveAnsiCodes(line, 0, firstHalf) + truncationCharacter + this.preserveAnsiCodes(line, secondHalf, line.length);
            }
            if (options.position === "end") {
                if (options.preferTruncationOnSpace) {
                    const nearestSpace = this.getIndexOfNearestSpace(line, maxWidth - 1);
                    return this.preserveAnsiCodes(line, 0, nearestSpace) + truncationCharacter;
                }
                if (options.space) {
                    truncationCharacter = ` ${truncationCharacter}`;
                }
                const realEnd = findRealPosition(line, maxWidth - stringWidth(truncationCharacter));
                return this.preserveAnsiCodes(line, 0, realEnd) + truncationCharacter;
            }
            throw new Error(`Expected options.position to be either 'start', 'middle' or 'end', got ${options.position}`);
        });
        return truncatedLines.join("\n");
    }

    private wordWrap(text: string, maxWidth: number): string[] {
        if (maxWidth <= 0 || !text) {
            return [text];
        }
        if (stringWidth(text) <= maxWidth) {
            return [text];
        }
        const lines = text.split(/\r?\n/);
        const wrappedLines: string[] = [];
        const colorPattern = ansiRegex();
        const linkPattern = /\u001B\]8;;([^\u0007]*)\u0007([^\u0007]*)\u001B\]8;;\u0007/g;
        for (const line of lines) {
            if (!line.trim()) {
                wrappedLines.push(line);
                continue;
            }
            const formats: { index: number; sequence: string }[] = [];
            let plainText = line;
            let match: RegExpExecArray | null = null;
            colorPattern.lastIndex = 0;
            while ((match = colorPattern.exec(line)) !== null) {
                formats.push({ index: match.index, sequence: match[0] });
            }
            linkPattern.lastIndex = 0;
            while ((match = linkPattern.exec(line)) !== null) {
                formats.push({
                    index: match.index,
                    sequence: `\u001B]8;;${match[1]}\u0007${match[2]}\u001B\]8;;\u0007`,
                });
            }
            formats.sort((a, b) => a.index - b.index);
            plainText = stripVTControlCharacters(line);
            const words = plainText.split(/\s+/);
            let currentLine = "";
            let currentLineWidth = 0;
            let lastAnsi = "";
            for (const word of words) {
                const wordWidth = stringWidth(word);
                if (currentLineWidth + wordWidth + (currentLine ? 1 : 0) > maxWidth && currentLine) {
                    if (lastAnsi) {
                        currentLine += "\u001B[0m";
                    }
                    wrappedLines.push(currentLine);
                    currentLine = "";
                    currentLineWidth = 0;
                }
                if (currentLine) {
                    currentLine += " ";
                    currentLineWidth += 1;
                }
                if (lastAnsi) {
                    currentLine += lastAnsi;
                }
                const wordStart = plainText.indexOf(word);
                let formattedWord = word;
                for (const format of formats) {
                    if (format.index <= wordStart) {
                        if (format.sequence.startsWith("\u001B[")) {
                            lastAnsi = format.sequence;
                        }
                        formattedWord = format.sequence + formattedWord;
                    }
                }
                currentLine += formattedWord;
                currentLineWidth += wordWidth;
            }
            if (currentLine) {
                if (lastAnsi) {
                    currentLine += "\u001B[0m";
                }
                wrappedLines.push(currentLine);
            }
        }
        return wrappedLines;
    }

    // ───────────── Render a Single Row ─────────────

    /**
     * Renders a single logical row.
     * For each column (0 ... columnCount-1), we choose the layout cell covering that position.
     * If multiple cells cover the same column, we prefer the one that starts on the current row;
     * if none start here, we choose the one with the highest row index.
     * Then contiguous columns with equivalent (real) cells are grouped.
     * For groups where the cell starts on this row, we normalize it (fixing truncate options) and use its content;
     * otherwise, a blank is rendered.
     */
    private renderRow(row: CellType[], columnWidths: number[], rowIndex: number): string[] {
        const columnMapping = new Array(this.columnCount);
        const { cells } = this.layout!;
        for (let columnIndex = 0; columnIndex < this.columnCount; columnIndex++) {
            let chosenCell: LayoutCell | null = null;
            let maxY = -1;
            for (const layoutCell of cells) {
                if (
                    layoutCell.x <= columnIndex &&
                    layoutCell.x + layoutCell.width > columnIndex &&
                    layoutCell.y <= rowIndex &&
                    layoutCell.y + layoutCell.height > rowIndex
                ) {
                    if (layoutCell.y === rowIndex) {
                        chosenCell = layoutCell;
                        break;
                    } else if (layoutCell.y > maxY) {
                        maxY = layoutCell.y;
                        chosenCell = layoutCell;
                    }
                }
            }
            const isStart = chosenCell ? chosenCell.y === rowIndex : false;
            columnMapping[columnIndex] = { cell: chosenCell, isStart };
        }

        // Group contiguous columns that share the same real cell.
        const groups: { cell: LayoutCell | null; end: number; isStart: boolean; start: number }[] = [];
        let currentGroup = { cell: columnMapping[0].cell, end: 0, isStart: columnMapping[0].isStart, start: 0 };
        for (let col = 1; col < this.columnCount; col++) {
            const mappingEntry = columnMapping[col];
            if (areCellsEquivalent(mappingEntry.cell, currentGroup.cell)) {
                currentGroup.end = col;
            } else {
                groups.push(currentGroup);
                currentGroup = { cell: mappingEntry.cell, end: col, isStart: mappingEntry.isStart, start: col };
            }
        }
        groups.push(currentGroup);

        // Compute each group's effective width.
        const groupWidths = groups.map((group) => {
            const baseWidth = this.columnWidths.slice(group.start, group.end + 1).reduce((a, b) => a + b, 0);
            const extra = group.end - group.start; // (colSpan - 1)
            return baseWidth + extra;
        });

        // For each group, if the cell starts on this row, normalize it and extract its content.
        const groupContents: string[][] = groups.map((group, index) => {
            if (group.cell && group.isStart) {
                group.cell = this.normalizeCellOption(group.cell);
                const normalizedCell = group.cell;
                const { content } = normalizedCell;
                let availableWidth = groupWidths[index];
                if (content.trim() !== "") {
                    availableWidth -= this.options.style.paddingLeft + this.options.style.paddingRight;
                }
                let contentLines: string[];
                // If wordWrap is enabled but the content has no spaces, use truncation instead.
                if (normalizedCell.wordWrap && !content.includes(" ")) {
                    contentLines = [this.truncate(content, availableWidth, normalizedCell.truncate as Required<TruncateOptions>)];
                } else if (normalizedCell.wordWrap) {
                    contentLines = this.wordWrap(content, availableWidth);
                } else if (normalizedCell.maxWidth !== undefined && stringWidth(content) > normalizedCell.maxWidth) {
                    contentLines = [this.truncate(content, normalizedCell.maxWidth, normalizedCell.truncate as Required<TruncateOptions>)];
                } else {
                    contentLines = content.split("\n");
                }

                return contentLines;
            }
            return [""];
        });

        const rowHeight = Math.max(...groupContents.map((lines) => lines.length));

        // Pad each group both vertically and horizontally.
        const paddedGroupContents = groupContents.map((lines, index) => {
            const effectiveWidth = groupWidths[index];
            const groupCell = groups[index].cell;
            const extraLines = rowHeight - lines.length;
            let topPadding = 0;
            let bottomPadding = 0;
            if (groupCell && groupCell.vAlign === "center") {
                topPadding = Math.floor(extraLines / 2);
                bottomPadding = extraLines - topPadding;
            } else if (groupCell && groupCell.vAlign === "bottom") {
                topPadding = extraLines;
                bottomPadding = 0;
            } else {
                topPadding = 0;
                bottomPadding = extraLines;
            }
            const blankLine = " ".repeat(effectiveWidth);
            const paddedLines: string[] = [];
            for (let index_ = 0; index_ < topPadding; index_++) paddedLines.push(blankLine);
            paddedLines.push(
                ...lines.map((line) => {
                    const lineWidth = stringWidth(line);
                    let availableWidth = effectiveWidth;
                    if (line.trim() !== "" && groupCell) {
                        availableWidth -= this.options.style.paddingLeft + this.options.style.paddingRight;
                    }
                    const extraSpace = Math.max(availableWidth - lineWidth, 0);
                    let leftPadding = 0;
                    let rightPadding = 0;
                    if (groupCell && groupCell.hAlign === "center") {
                        leftPadding = Math.floor(extraSpace / 2);
                        rightPadding = extraSpace - leftPadding;
                    } else if (groupCell && groupCell.hAlign === "right") {
                        leftPadding = extraSpace;
                        rightPadding = 0;
                    } else {
                        leftPadding = 0;
                        rightPadding = extraSpace;
                    }
                    const padLeft = line.trim() !== "" && groupCell ? " ".repeat(this.options.style.paddingLeft) : "";
                    const padRight = line.trim() !== "" && groupCell ? " ".repeat(this.options.style.paddingRight) : "";
                    return padLeft + " ".repeat(leftPadding) + line + " ".repeat(rightPadding) + padRight;
                }),
            );
            for (let index_ = 0; index_ < bottomPadding; index_++) paddedLines.push(blankLine);
            return paddedLines;
        });

        const renderedRowLines: string[] = [];
        for (let lineIndex = 0; lineIndex < rowHeight; lineIndex++) {
            let assembledLine = "";
            assembledLine += this.options.style.border.bodyLeft ?? "";
            for (let groupIndex = 0; groupIndex < groups.length; groupIndex++) {
                assembledLine += paddedGroupContents[groupIndex][lineIndex];
                if (groupIndex < groups.length - 1) {
                    assembledLine += areCellsEquivalent(groups[groupIndex].cell, groups[groupIndex + 1].cell)
                        ? " "
                        : (this.options.style.border.bodyJoin ?? "");
                }
            }
            assembledLine += this.options.style.border.bodyRight ?? "";
            renderedRowLines.push(assembledLine);
        }
        return renderedRowLines;
    }
}

export const createTable = (options?: TableConstructorOptions): Table => new Table(options);
