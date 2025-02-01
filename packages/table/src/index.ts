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

/** Helper class to track occupied positions in the layout grid. */
class CellTracker {
  private readonly occupiedPositions = new Map<string, LayoutCell>();

  public isOccupied(column: number, row: number): boolean {
    return this.occupiedPositions.has(`${column},${row}`);
  }

  public occupy(column: number, row: number, layoutCell: LayoutCell): void {
    this.occupiedPositions.set(`${column},${row}`, layoutCell);
  }

  public findNextFree(startColumn: number, row: number): number {
    let currentColumn = startColumn;
    while (this.isOccupied(currentColumn, row)) {
      currentColumn++;
    }
    return currentColumn;
  }
}

/** Creates a layout cell from a given cell configuration. */
function createLayoutCell(cell: CellType, column: number, row: number): LayoutCell {
  const normalizedCell =
    typeof cell === "object" && cell !== null ? cell : { content: String(cell) };
  return {
    ...normalizedCell,
    content: String(normalizedCell.content ?? ""),
    height: normalizedCell.rowSpan ?? 1,
    width: normalizedCell.colSpan ?? 1,
    x: column,
    y: row,
  };
}

/** Creates span (placeholder) cells for every covered position except the starting one. */
function createSpanCells(parentCell: LayoutCell): LayoutCell[] {
  const spanCells: LayoutCell[] = [];
  for (let rowIndex = parentCell.y; rowIndex < parentCell.y + parentCell.height; rowIndex++) {
    for (let columnIndex = parentCell.x; columnIndex < parentCell.x + parentCell.width; columnIndex++) {
      if (columnIndex === parentCell.x && rowIndex === parentCell.y)
continue;
      spanCells.push({
        content: "",
        height: 1,
        isSpanCell: true,
        parentCell,
        width: 1,
        x: columnIndex,
        y: rowIndex,
      });
    }
  }
  return spanCells;
}

/** Computes the overall dimensions (in cells) of the layout. */
function calculateLayoutDimensions(layoutCells: LayoutCell[]): { height: number; width: number } {
  let maxColumn = 0;
  let maxRow = 0;
  for (const cell of layoutCells) {
    maxColumn = Math.max(maxColumn, cell.x + cell.width);
    maxRow = Math.max(maxRow, cell.y + cell.height);
  }
  return { height: maxRow, width: maxColumn };
}

/**
 * Creates a complete table layout from a 2D array of rows.
 * Assumes each row has been “filled” so that its logical width (the sum of colSpans) equals the table’s global column count.
 */
function createTableLayout(rows: CellType[][]): TableLayout {
  const tracker = new CellTracker();
  const layoutCells: LayoutCell[] = [];
  for (const [rowIndex, currentRow] of rows.entries()) {
    // Process each cell in order; the row array is assumed to have length equal to its logical width.
    for (const [cellIndex, currentCell] of currentRow.entries()) {
      if (currentCell === null)
continue; // Null cells are assumed to be covered by a spanning cell.
      const freeColumn = tracker.findNextFree(cellIndex, rowIndex);
      const layoutCell = createLayoutCell(currentCell, freeColumn, rowIndex);
      layoutCells.push(layoutCell);
      const spanCells = createSpanCells(layoutCell);
      layoutCells.push(...spanCells);
      for (let r = rowIndex; r < rowIndex + layoutCell.height; r++) {
        for (let c = freeColumn; c < freeColumn + layoutCell.width; c++) {
          tracker.occupy(c, r, layoutCell);
        }
      }
    }
  }
  const dimensions = calculateLayoutDimensions(layoutCells);
  return { cells: layoutCells, height: dimensions.height, width: dimensions.width };
}

/* ───────────── End Layout Code ───────────── */

/* ───────────── Table Code ───────────── */

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
    if (cell === null)
return total + 1;
    if (typeof cell === "object" && !Array.isArray(cell))
      return total + (cell.colSpan ?? 1);
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
  if (!layoutCell)
return null;
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
  // Global logical column count (widest row in terms of sum of colSpans)
  private columnCount = 0;
  private readonly options: RequiredDeep<TableConstructorOptions>;
  private columnWidths: number[] = [];
  private cachedColumnWidths: number[] | null = null;
  private cachedString: string | null = null;
  private isDirty = true;
  private layout: TableLayout | null = null;

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
    const parts: string[] = [];
    for (let colIndex = 0; colIndex < this.columnWidths.length; colIndex++) {
      parts.push(options.body.repeat(this.columnWidths[colIndex]));
      if (colIndex < this.columnWidths.length - 1) {
        parts.push(options.middle);
      }
    }
    return options.left + parts.join("") + options.right;
  };

  public toString(): string {
    const borderStyle = this.options.style.border;
    // If all border decorations are disabled, simply join cell contents.
    const borderDisabled = Object.values(borderStyle).every((value) => value === "");
    if (borderDisabled) {
      const allRows = this.options.showHeader ? [...this.headers, ...this.rows] : this.rows;
      return allRows.map((row) => row.map((cell) => (cell ? String(cell.content) : "")).join("  ")).join("\n");
    }
    if (!this.isDirty && this.cachedString !== null) {
      return this.cachedString;
    }
    if (this.rows.length === 0 && this.headers.length === 0) {
      this.cachedString = "";
      return "";
    }
    const allRows = this.options.showHeader ? [...this.headers, ...this.rows] : this.rows;
    this.layout = createTableLayout(allRows);
    // Sort layout cells by row then by column.
    this.layout.cells.sort((a, b) => a.y - b.y || a.x - b.x);
    this.columnWidths = this.calculateColumnWidths();
    const outputLines: string[] = [];

    // Top border.
    outputLines.push(
      this.createLine({
        body: borderStyle.topBody,
        left: borderStyle.topLeft ?? "",
        middle: borderStyle.topJoin ?? "",
        right: borderStyle.topRight ?? "",
      }),
    );

    // Render each logical row.
    for (let rowIndex = 0; rowIndex < allRows.length; rowIndex++) {
      const renderedRowLines = this.renderRow(allRows[rowIndex], this.columnWidths, rowIndex);
      outputLines.push(...renderedRowLines);

      // Separator between rows (if not last row).
      if (rowIndex < allRows.length - 1) {
        const spanned: boolean[] = [];
        for (let colIndex = 0; colIndex < this.columnCount; colIndex++) {
          const foundCell = this.layout.cells.find((layoutCell) =>
            !layoutCell.isSpanCell &&
            layoutCell.x <= colIndex &&
            layoutCell.x + layoutCell.width > colIndex &&
            layoutCell.y <= rowIndex &&
            layoutCell.y + layoutCell.height > rowIndex
          );
          spanned[colIndex] = foundCell ? (rowIndex + 1 < foundCell.y + foundCell.height) : false;
        }
        let separatorLine = "";
        separatorLine += spanned[0] ? (borderStyle.bodyLeft ?? "") : (borderStyle.joinLeft ?? "");
        for (let colIndex = 0; colIndex < this.columnCount; colIndex++) {
          separatorLine += spanned[colIndex] ? " ".repeat(this.columnWidths[colIndex]) : (borderStyle.joinBody ?? "").repeat(this.columnWidths[colIndex]);
          if (colIndex < this.columnCount - 1) {
            const leftSpanned = spanned[colIndex];
            const rightSpanned = spanned[colIndex + 1];
            let joinChar = "";
            if (leftSpanned && rightSpanned) {
              joinChar = borderStyle.joinJoin ?? "";
            } else if (leftSpanned && !rightSpanned) {
              joinChar = borderStyle.joinLeft ?? "";
            } else if (!leftSpanned && rightSpanned) {
              joinChar = borderStyle.joinRight ?? "";
            } else {
              joinChar = borderStyle.joinJoin ?? "";
            }
            separatorLine += joinChar;
          }
        }
        separatorLine += spanned[this.columnCount - 1] ? (borderStyle.bodyRight ?? "") : (borderStyle.joinRight ?? "");
        outputLines.push(separatorLine);
      }
    }

    // Bottom border.
    outputLines.push(
      this.createLine({
        body: borderStyle.bottomBody,
        left: borderStyle.bottomLeft ?? "",
        middle: borderStyle.bottomJoin ?? "",
        right: borderStyle.bottomRight ?? "",
      }),
    );

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
        if (currentColumnIndex >= this.columnCount)
break;
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
    if (text.charAt(targetIndex) === " ")
return targetIndex;
    const direction = searchRight ? 1 : -1;
    for (let offset = 0; offset <= 3; offset++) {
      const pos = targetIndex + offset * direction;
      if (text.charAt(pos) === " ")
return pos;
    }
    return targetIndex;
  }

  private preserveAnsiCodes(text: string, startIndex: number, endIndex: number): string {
    const openCodes: string[] = [];
    let match: RegExpExecArray | null = null;
    globalAnsiPattern.lastIndex = 0;
    while ((match = globalAnsiPattern.exec(text)) !== null) {
      if (match.index > endIndex)
break;
      const code = match[0];
      if (code === "\u001B[0m") {
        if (match.index < endIndex)
openCodes.length = 0;
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
    if (maxWidth < 1)
return "";
    if (maxWidth === 1)
return options.truncationCharacter;
    const visibleLength = stringWidth(text);
    if (visibleLength <= maxWidth)
return text;
    const lines = text.split("\n");
    let { truncationCharacter } = options;
    const truncatedLines = lines.map((line) => {
      const lineLength = stringWidth(line);
      if (lineLength <= maxWidth)
return line;
      if (options.position === "start") {
        if (options.preferTruncationOnSpace) {
          const nearestSpace = this.getIndexOfNearestSpace(line, lineLength - maxWidth + 1, true);
          return truncationCharacter + this.preserveAnsiCodes(line, nearestSpace, line.length).trim();
        }
        if (options.space)
truncationCharacter += " ";
        const visibleStart = stringWidth(line) - maxWidth + stringWidth(truncationCharacter);
        const realStart = findRealPosition(line, visibleStart);
        return truncationCharacter + this.preserveAnsiCodes(line, realStart, line.length);
      }
      if (options.position === "middle") {
        if (options.space)
truncationCharacter = ` ${truncationCharacter} `;
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
        return (
          this.preserveAnsiCodes(line, 0, firstHalf) +
          truncationCharacter +
          this.preserveAnsiCodes(line, secondHalf, line.length)
        );
      }
      if (options.position === "end") {
        if (options.preferTruncationOnSpace) {
          const nearestSpace = this.getIndexOfNearestSpace(line, maxWidth - 1);
          return this.preserveAnsiCodes(line, 0, nearestSpace) + truncationCharacter;
        }
        if (options.space)
truncationCharacter = ` ${truncationCharacter}`;
        const realEnd = findRealPosition(line, maxWidth - stringWidth(truncationCharacter));
        return this.preserveAnsiCodes(line, 0, realEnd) + truncationCharacter;
      }
      throw new Error(`Expected options.position to be either 'start', 'middle' or 'end', got ${options.position}`);
    });
    return truncatedLines.join("\n");
  }

  private wordWrap(text: string, maxWidth: number): string[] {
    if (maxWidth <= 0 || !text)
return [text];
    if (stringWidth(text) <= maxWidth)
return [text];
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
          if (lastAnsi)
currentLine += "\u001B[0m";
          wrappedLines.push(currentLine);
          currentLine = "";
          currentLineWidth = 0;
        }
        if (currentLine) {
          currentLine += " ";
          currentLineWidth += 1;
        }
        if (lastAnsi)
currentLine += lastAnsi;
        const wordStart = plainText.indexOf(word);
        let formattedWord = word;
        for (const format of formats) {
          if (format.index <= wordStart) {
            if (format.sequence.startsWith("\u001B["))
lastAnsi = format.sequence;
            formattedWord = format.sequence + formattedWord;
          }
        }
        currentLine += formattedWord;
        currentLineWidth += wordWidth;
      }
      if (currentLine) {
        if (lastAnsi)
currentLine += "\u001B[0m";
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
    const columnMapping: { cell: LayoutCell | null; isStart: boolean }[] = [];
    for (let columnIndex = 0; columnIndex < this.columnCount; columnIndex++) {
      const coveringCells = this.layout!.cells.filter((layoutCell) =>
        layoutCell.x <= columnIndex &&
        layoutCell.x + layoutCell.width > columnIndex &&
        layoutCell.y <= rowIndex &&
        layoutCell.y + layoutCell.height > rowIndex
      );
      let chosenCell: LayoutCell | null = null;
      if (coveringCells.length > 0) {
        const startingCells = coveringCells.filter((cell) => cell.y === rowIndex);
        chosenCell = startingCells.length > 0 ? startingCells[0]
          : coveringCells.reduce((previous, current) => (current.y > previous.y ? current : previous));
      }
      const isStart = chosenCell ? (chosenCell.y === rowIndex) : false;
      columnMapping.push({ cell: chosenCell, isStart });
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
      let totalWidth = 0;
      for (let col = group.start; col <= group.end; col++) {
        totalWidth += columnWidths[col];
      }
      return totalWidth;
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
        if (normalizedCell.wordWrap || (normalizedCell.maxWidth !== undefined && stringWidth(content) > normalizedCell.maxWidth)) {
          contentLines = normalizedCell.wordWrap
            ? this.wordWrap(content, availableWidth)
            : [this.truncate(content, normalizedCell.maxWidth!, normalizedCell.truncate as Required<TruncateOptions>)];
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
      let topPadding = 0; let bottomPadding = 0;
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
      paddedLines.push(...lines.map((line) => {
        const lineWidth = stringWidth(line);
        let availableWidth = effectiveWidth;
        if (line.trim() !== "" && groupCell) {
          availableWidth -= this.options.style.paddingLeft + this.options.style.paddingRight;
        }
        const extraSpace = Math.max(availableWidth - lineWidth, 0);
        let leftPadding = 0; let rightPadding = 0;
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
      }));
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
