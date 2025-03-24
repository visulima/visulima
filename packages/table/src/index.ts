import type { TruncateOptions } from "@visulima/string";
import { getStringWidth, truncate, wordWrap } from "@visulima/string";
import type { RequiredDeep } from "type-fest";

import createTableLayout from "./layout";
import { DEFAULT_BORDER } from "./style";
import type { Cell as CellType, CellOptions, LayoutCell, TableConstructorOptions, TableLayout } from "./types";
import { areCellsEquivalent, computeRowLogicalWidth, fillRowToWidth, getRealCell } from "./utils";

type NormalizedCell = Omit<CellOptions, "content"> & { content: string };

/**
 * Processes the content of a cell based on the cell's options.
 * @param cell - The cell to process.
 * @param content - The content of the cell.
 * @param availableWidth - The available width for the content.
 * @returns An array of strings representing the processed content.
 */
const processContent = (cell: NormalizedCell, content: string, availableWidth: number): string[] => {
    if (cell.wordWrap && !content.includes(" ")) {
        return [truncate(content, availableWidth, cell.truncate as Required<TruncateOptions>)];
    }

    if (cell.wordWrap) {
        return wordWrap(content, { removeZeroWidthCharacters: true, ...cell.wordWrap, width: availableWidth }).split("\n");
    }

    if (cell.maxWidth !== undefined && getStringWidth(content) > cell.maxWidth) {
        return [truncate(content, cell.maxWidth, cell.truncate as Required<TruncateOptions>)];
    }

    return content.split("\n");
};

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

    /** Creates a new Table instance with the specified options. */

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

    // eslint-disable-next-line sonarjs/cognitive-complexity
    public toString(): string {
        // If borders are disabled, simply join cell contents.
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
                            const availableWidth = (widths[colIndex] as number) - this.options.style.paddingLeft - this.options.style.paddingRight;

                            // eslint-disable-next-line no-plusplus
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

        // Build the layout and calculate column widths.
        this.layout = createTableLayout(allRows);
        // Sort layout cells by row (y) then by column (x)
        this.layout.cells.sort((a, b) => a.y - b.y || a.x - b.x);
        this.columnWidths = this.calculateColumnWidths();

        const outputLines: string[] = [];

        // Groups cells by column for a given row
        // For a given row index, loop over logical columns 0..(this.columnCount - 1)
        // and find the covering layout cell. For each column we “prefer” a cell that
        // starts exactly at that row (i.e. a “main” cell) and, if none is found, use any cell covering it.
        // We normalize each cell via getRealCell(), then group adjacent columns whose normalized cells are equivalent.
        // Each group is an object { start, end, cell }.
        const groupRowForDisplay = (rowIndex: number): { cell: LayoutCell | null; end: number; start: number }[] => {
            const mapping: (LayoutCell | null)[] = [];

            for (let col = 0; col < this.columnCount; col++) {
                // Prefer a cell that starts exactly at rowIndex and isn’t a span placeholder.
                let cell = this.layout?.cells.find((c) => c.x <= col && c.x + c.width > col && c.y === rowIndex && !c.isSpanCell);

                if (!cell) {
                    // Fall back: pick any cell covering this column.
                    cell = this.layout?.cells.find((c) => c.x <= col && c.x + c.width > col && c.y <= rowIndex && c.y + c.height > rowIndex);
                }

                mapping.push(cell ? getRealCell(cell) : null);
            }

            const groups: { cell: LayoutCell | null; end: number; start: number }[] = [];

            if (mapping.length === 0) {
                return groups;
            }

            let currentGroup = { cell: mapping[0], end: 0, start: 0 };

            for (let index = 1; index < mapping.length; index++) {
                if (areCellsEquivalent(mapping[index] as LayoutCell, currentGroup.cell as LayoutCell)) {
                    currentGroup.end = index;
                } else {
                    groups.push(currentGroup as { cell: LayoutCell | null; end: number; start: number });
                    currentGroup = { cell: mapping[index], end: index, start: index };
                }
            }

            groups.push(currentGroup as { cell: LayoutCell | null; end: number; start: number });

            return groups;
        };

        // Calculate effective width for a group of cells spanning multiple columns
        const effectiveWidth = (group: { cell: LayoutCell | null; end: number; start: number }): number => {
            const base = this.columnWidths.slice(group.start, group.end + 1).reduce((sum, w) => sum + w, 0);

            return base + (group.end - group.start);
        };

        const {
            bodyJoin,
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

        // Render top border
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

        // Render rows and separators
        for (let rowIndex = 0; rowIndex < allRows.length; rowIndex++) {
            const renderedRowLines = this.renderRow(rowIndex);

            outputLines.push(...renderedRowLines);

            if (rowIndex < allRows.length - 1) {
                let separatorLine = "";

                if (rowIndex === this.headers.length - 1) {
                    const rowGroups = groupRowForDisplay(this.headers.length);

                    separatorLine += joinLeft;

                    rowGroups.forEach((group, index) => {
                        separatorLine += joinBody.repeat(effectiveWidth(group));
                        if (index < rowGroups.length - 1) {
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

                    // eslint-disable-next-line no-plusplus
                    for (let colIndex = 0; colIndex < this.columnCount; colIndex++) {
                        // eslint-disable-next-line security/detect-object-injection
                        separatorLine += (spanned[colIndex] as boolean)
                            ? // eslint-disable-next-line security/detect-object-injection
                              " ".repeat(this.columnWidths[colIndex] as number)
                            : // eslint-disable-next-line security/detect-object-injection
                              joinBody.repeat(this.columnWidths[colIndex] as number);

                        if (colIndex < this.columnCount - 1) {
                            let joinChar;

                            // eslint-disable-next-line security/detect-object-injection
                            const leftSpanned = spanned[colIndex]; // Boolean flag for left column (might be false if it's the starting column)
                            const rightSpanned = spanned[colIndex + 1]; // Boolean flag for right column (true if it’s a continuation of a spanning cell)

                            const cellBelowLeft = this.layout.cells.find(
                                (c) => c.x <= colIndex && c.x + c.width > colIndex && c.y <= rowIndex + 1 && c.y + c.height > rowIndex + 1,
                            );

                            const cellBelowRight = this.layout.cells.find(
                                (c) => c.x <= colIndex + 1 && c.x + c.width > colIndex + 1 && c.y <= rowIndex + 1 && c.y + c.height > rowIndex + 1,
                            );
                            const cellAboveLeft = this.layout.cells.find(
                                (c) => c.x <= colIndex && c.x + c.width > colIndex && c.y <= rowIndex && c.y + c.height > rowIndex,
                            );
                            const cellAboveRight = this.layout.cells.find(
                                (c) => c.x <= colIndex + 1 && c.x + c.width > colIndex + 1 && c.y <= rowIndex && c.y + c.height > rowIndex,
                            );
                            const partOfSameSpan = cellAboveLeft && cellAboveRight && areCellsEquivalent(cellAboveLeft, cellAboveRight);
                            const aboveSpansBoth = cellAboveLeft && cellAboveRight && areCellsEquivalent(cellAboveLeft, cellAboveRight);
                            const belowSpansBoth = cellBelowLeft && cellBelowRight && areCellsEquivalent(cellBelowLeft, cellBelowRight);

                            if (aboveSpansBoth && !belowSpansBoth) {
                                joinChar = topJoin;
                            } else if (!aboveSpansBoth && belowSpansBoth) {
                                joinChar = bottomJoin;
                            } else if (aboveSpansBoth && belowSpansBoth) {
                                joinChar = joinBody;
                            } else if (leftSpanned && rightSpanned) {
                                joinChar = bodyJoin;
                            } else if (rightSpanned) {
                                joinChar = joinRight;
                            } else if (leftSpanned) {
                                joinChar = joinLeft;
                            } else {
                                joinChar = partOfSameSpan ? topJoin : joinJoin;
                            }

                            separatorLine += joinChar;
                        }
                    }

                    separatorLine += spanned[this.columnCount - 1] ? bodyRight : joinRight;
                }

                outputLines.push(separatorLine);
            }
        }

        // Render bottom border
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

    /** Creates a horizontal line with the specified border characters. */
    private readonly createLine = (options: { body: string; left: string; middle: string; right: string }): string => {
        const { body, left, middle, right } = options;
        const parts = Array.from(
            { length: this.columnWidths.length },
            (_, index) => body.repeat(this.columnWidths[index] as number) + (index < this.columnWidths.length - 1 ? middle : ""),
        );
        return left + parts.join("") + right;
    };

    private calculateColumnWidths(): number[] {
        if (!this.isDirty && this.cachedColumnWidths) {
            return this.cachedColumnWidths;
        }
        const widths: number[] = Array.from<number>({ length: this.columnCount }).fill(0);
        const allRows = this.options.showHeader ? [...this.headers, ...this.rows] : this.rows;

        // Process each row and cell to calculate column widths
        allRows.forEach((currentRow) => {
            let currentColumnIndex = 0;
            currentRow.forEach((cell) => {
                if (currentColumnIndex >= this.columnCount) {
                    return;
                }

                const normalizedCell = this.normalizeCellOption(cell);
                const cellWidth = this.calculateCellWidth(normalizedCell);
                const colSpan = Math.min(normalizedCell.colSpan ?? 1, this.columnCount - currentColumnIndex);

                if (colSpan === 1) {
                    widths[currentColumnIndex] = Math.max(widths[currentColumnIndex] as number, cellWidth);
                } else {
                    const borderTotal = colSpan - 1;
                    const eachWidth = Math.ceil((cellWidth - borderTotal) / colSpan);
                    for (let offset = 0; offset < colSpan; offset++) {
                        widths[currentColumnIndex + offset] = Math.max(widths[currentColumnIndex + offset] as number, eachWidth);
                    }
                }
                currentColumnIndex += colSpan;
            });
        });

        this.cachedColumnWidths = widths;
        this.isDirty = false;
        return widths;
    }

    private calculateCellWidth(cell: CellOptions & { content: string }): number {
        if (cell.content === "") {
            return 0;
        }

        const getContentWidth = () => {
            if (cell.maxWidth) {
                return Math.min(getStringWidth(cell.content), cell.maxWidth);
            }

            if (cell.wordWrap) {
                return Math.max(...cell.content.split(/\s+/).map((input: string) => getStringWidth(input)));
            }

            return Math.max(...cell.content.split("\n").map((input: string) => getStringWidth(input)));
        };

        // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
        return getContentWidth() + this.options.style.paddingLeft + this.options.style.paddingRight;
    }

    // eslint-disable-next-line sonarjs/cognitive-complexity
    private normalizeCellOption(cell: CellType): NormalizedCell {
        // Handle empty or null cells
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

        // Handle object cells
        if (typeof cell === "object" && !Array.isArray(cell)) {
            const isValidContent =
                cell.content === null ||
                cell.content === undefined ||
                cell.content === "" ||
                typeof cell.content === "string" ||
                typeof cell.content === "number";

            if (!isValidContent) {
                throw new TypeError("Cell content must be a string, undefined, null or number");
            }

            const normalizedContent =
                cell.content === null || cell.content === undefined || cell.content === ""
                    ? ""
                    : String(cell.content).replaceAll("\t", " ".repeat(this.options.transformTabToSpace));

            return {
                ...cell,
                content: normalizedContent,
                hAlign: cell.hAlign || "left",
                maxWidth: cell.maxWidth ?? this.options.maxWidth,
                truncate: cell.truncate === undefined ? this.options.truncate : { ...this.options.truncate, ...cell.truncate },
                vAlign: cell.vAlign || "top",
                wordWrap: cell.wordWrap ?? this.options.wordWrap,
            };
        }

        // Handle primitive cells (string or number)
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

    /**
     * Renders a single logical row.
     * For each column (0 ... columnCount-1), we choose the layout cell covering that position.
     * If multiple cells cover the same column, we prefer the one that starts on the current row;
     * if none start here, we choose the one with the highest row index.
     * Then contiguous columns with equivalent (real) cells are grouped.
     * For groups where the cell starts on this row, we normalize it (fixing truncate options) and use its content;
     * otherwise, a blank is rendered.
     */
    private renderRow(rowIndex: number): string[] {
        // Map columns to their layout cells
        const columnMapping = this.mapColumnsToLayoutCells(rowIndex);

        // Group contiguous columns that share the same real cell
        const groups = this.groupColumnsByCell(columnMapping);

        // Calculate group widths and content
        const groupWidths = this.calculateGroupWidths(groups);
        const groupContents = this.extractGroupContents(groups, groupWidths);

        // Calculate row height and pad content
        const rowHeight = Math.max(...groupContents.map((lines) => lines.length));
        const paddedGroupContents = this.padGroupContents(groups, groupContents, groupWidths, rowHeight);

        // Render the final row lines
        return this.assembleRowLines(groups, paddedGroupContents, rowHeight);
    }

    private mapColumnsToLayoutCells(rowIndex: number): { cell: LayoutCell | null; isStart: boolean }[] {
        const columnMapping = new Array(this.columnCount);
        const { cells } = this.layout!;

        for (let columnIndex = 0; columnIndex < this.columnCount; columnIndex++) {
            const chosenCell = this.findCoveringCell(cells, columnIndex, rowIndex);
            const isStart = chosenCell ? chosenCell.y === rowIndex : false;
            columnMapping[columnIndex] = { cell: chosenCell, isStart };
        }

        return columnMapping;
    }

    private findCoveringCell(cells: LayoutCell[], columnIndex: number, rowIndex: number): LayoutCell | null {
        // We need a very specific order of precedence to handle complex nested spans correctly
        // 1. Cells that start exactly at this position (x,y) are highest priority
        // 2. Real cells (not span cells) that start on this row
        // 3. Real cells (not span cells) from any row
        // 4. Placeholder/span cells, prioritizing ones from most recent rows
        
        // First pass: Find cells that start exactly at this position
        for (const layoutCell of cells) {
            if (layoutCell.x === columnIndex && layoutCell.y === rowIndex) {
                return layoutCell; // Exact position match has highest priority
            }
        }
        
        // Second pass: Find real cells (not span cells) that start on this row
        for (const layoutCell of cells) {
            if (this.cellCoversPosition(layoutCell, columnIndex, rowIndex) && 
                !layoutCell.isSpanCell && 
                layoutCell.y === rowIndex) {
                return layoutCell;
            }
        }
        
        // Third pass: Find any real cells (not span cells)
        let highestRealCell: LayoutCell | null = null;
        let maxRealY = -1;
        
        for (const layoutCell of cells) {
            if (this.cellCoversPosition(layoutCell, columnIndex, rowIndex) && !layoutCell.isSpanCell) {
                // For multiple real cells, prefer the one with highest row (most recent)
                if (layoutCell.y > maxRealY) {
                    maxRealY = layoutCell.y;
                    highestRealCell = layoutCell;
                }
            }
        }
        
        if (highestRealCell) {
            return highestRealCell;
        }
        
        // Fourth pass: Fall back to placeholder/span cells
        let highestSpanCell: LayoutCell | null = null;
        let maxSpanY = -1;
        
        for (const layoutCell of cells) {
            if (this.cellCoversPosition(layoutCell, columnIndex, rowIndex)) {
                if (layoutCell.y > maxSpanY) {
                    maxSpanY = layoutCell.y;
                    highestSpanCell = layoutCell;
                }
            }
        }
        
        return highestSpanCell;
    }

    // eslint-disable-next-line class-methods-use-this
    private cellCoversPosition(cell: LayoutCell, columnIndex: number, rowIndex: number): boolean {
        return cell.x <= columnIndex && cell.x + cell.width > columnIndex && cell.y <= rowIndex && cell.y + cell.height > rowIndex;
    }

    private groupColumnsByCell(
        columnMapping: { cell: LayoutCell | null; isStart: boolean }[],
    ): { cell: LayoutCell | null; end: number; isStart: boolean; start: number }[] {
        const groups: { cell: LayoutCell | null; end: number; isStart: boolean; start: number }[] = [];
        const column = columnMapping[0] as { cell: LayoutCell | null; isStart: boolean };

        let currentGroup = { cell: column.cell, end: 0, isStart: column.isStart, start: 0 };

        for (let col = 1; col < this.columnCount; col++) {
            const mappingEntry = columnMapping[col] as { cell: LayoutCell | null; isStart: boolean };

            if (areCellsEquivalent(mappingEntry.cell, currentGroup.cell)) {
                currentGroup.end = col;
            } else {
                groups.push(currentGroup);
                currentGroup = { cell: mappingEntry.cell, end: col, isStart: mappingEntry.isStart, start: col };
            }
        }

        groups.push(currentGroup);

        return groups;
    }

    private calculateGroupWidths(groups: { end: number; start: number }[]): number[] {
        return groups.map((group) => {
            const baseWidth = this.columnWidths.slice(group.start, group.end + 1).reduce((a, b) => a + b, 0);
            const extra = group.end - group.start; // (colSpan - 1)
            return baseWidth + extra;
        });
    }

    private extractGroupContents(groups: { cell: LayoutCell | NormalizedCell | null; isStart: boolean }[], groupWidths: number[]): string[][] {
        return groups.map((group, index) => {
            if (group.cell && group.isStart) {
                // eslint-disable-next-line no-param-reassign
                group.cell = this.normalizeCellOption(group.cell);

                const normalizedCell = group.cell as NormalizedCell;

                let availableWidth = groupWidths[index] as number;

                if (normalizedCell.content.trim() !== "") {
                    // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
                    availableWidth -= this.options.style.paddingLeft + this.options.style.paddingRight;
                }

                return processContent(normalizedCell, normalizedCell.content, availableWidth);
            }

            return [""];
        });
    }

    private padGroupContents(groups: { cell: LayoutCell | null }[], groupContents: string[][], groupWidths: number[], rowHeight: number): string[][] {
        return groupContents.map((lines, index) => {
            const effectiveWidth = groupWidths[index] as number;
            const groupCell = (groups[index] as { cell: LayoutCell | null }).cell;
            const extraLines = rowHeight - lines.length;
            const { bottomPadding, topPadding } = this.calculateVerticalPadding(extraLines, groupCell);

            const blankLine = " ".repeat(effectiveWidth);
            const paddedLines: string[] = [];

            // Add top padding
            for (let index_ = 0; index_ < topPadding; index_++) paddedLines.push(blankLine);

            // Add content lines with horizontal padding
            paddedLines.push(...this.padContentLines(lines, effectiveWidth, groupCell));

            // Add bottom padding
            for (let index_ = 0; index_ < bottomPadding; index_++) paddedLines.push(blankLine);

            return paddedLines;
        });
    }

    private calculateVerticalPadding(extraLines: number, cell: LayoutCell | null): { bottomPadding: number; topPadding: number } {
        if (cell && cell.vAlign === "middle") {
            const topPadding = Math.floor(extraLines / 2);
            return { bottomPadding: extraLines - topPadding, topPadding };
        }

        if (cell && cell.vAlign === "bottom") {
            return { bottomPadding: 0, topPadding: extraLines };
        }

        return { bottomPadding: extraLines, topPadding: 0 };
    }

    private padContentLines(lines: string[], effectiveWidth: number, cell: LayoutCell | null): string[] {
        return lines.map((line) => {
            let availableWidth = effectiveWidth;

            if (line.trim() !== "" && cell) {
                availableWidth -= this.options.style.paddingLeft + this.options.style.paddingRight;
            }

            const lineWidth = getStringWidth(line);
            const { leftPadding, rightPadding } = this.calculateHorizontalPadding(availableWidth - lineWidth, cell);

            const padLeft = line.trim() !== "" && cell ? " ".repeat(this.options.style.paddingLeft) : "";
            const padRight = line.trim() !== "" && cell ? " ".repeat(this.options.style.paddingRight) : "";

            return padLeft + (leftPadding > 0 ? " ".repeat(leftPadding) : "") + line + (rightPadding > 0 ? " ".repeat(rightPadding) : "") + padRight;
        });
    }

    private calculateHorizontalPadding(extraSpace: number, cell: LayoutCell | null): { leftPadding: number; rightPadding: number } {
        if (cell && cell.hAlign === "center") {
            const leftPadding = Math.floor(extraSpace / 2);

            return { leftPadding, rightPadding: extraSpace - leftPadding };
        }

        if (cell && cell.hAlign === "right") {
            return { leftPadding: extraSpace, rightPadding: 0 };
        }

        return { leftPadding: 0, rightPadding: extraSpace };
    }

    private assembleRowLines(groups: { cell: LayoutCell | null }[], paddedGroupContents: string[][], rowHeight: number): string[] {
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
