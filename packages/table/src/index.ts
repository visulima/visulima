import { EOL } from 'node:os';

export type HorizontalAlign = 'left' | 'center' | 'right';
export type VerticalAlign = 'top' | 'middle' | 'bottom';

export type CellOptions = {
    content: string | number;
    colSpan?: number;
    rowSpan?: number;
    hAlign?: HorizontalAlign;
    vAlign?: VerticalAlign;
};

export type Cell = string | number | CellOptions | null;

export type BorderStyle = {
    topBody?: string;
    topJoin?: string;
    topLeft?: string;
    topRight?: string;

    bottomBody?: string;
    bottomJoin?: string;
    bottomLeft?: string;
    bottomRight?: string;

    bodyLeft?: string;
    bodyRight?: string;
    bodyJoin?: string;

    joinBody?: string;
    joinLeft?: string;
    joinRight?: string;
    joinJoin?: string;
};

export type TableOptions = {
    /**
     * The style of the table borders
     */
    border?: BorderStyle;
    /**
     * The padding between the cell content and the cell border
     */
    padding?: number;
    /**
     * Whether to draw the outer border of the table
     */
    drawOuterBorder?: boolean;
    /**
     * The character to use for empty cells
     */
    emptyCellChar?: string;
    /**
     * Whether to truncate cells that are too long
     */
    truncate?: boolean;
    /**
     * The maximum width of a cell before truncation
     */
    maxWidth?: number;
    /**
     * The default alignment of the cell content
     */
    align?: HorizontalAlign;
    /**
     * The default vertical alignment of the cell content
     */
    vAlign?: VerticalAlign;
    /**
     * Style options for specific parts of the table
     */
    style?: {
        header?: string[];
        cells?: string[];
    };
};

export const DEFAULT_BORDER: BorderStyle = {
    topBody: '─',
    topJoin: '┬',
    topLeft: '┌',
    topRight: '┐',

    bottomBody: '─',
    bottomJoin: '┴',
    bottomLeft: '└',
    bottomRight: '┘',

    bodyLeft: '│',
    bodyRight: '│',
    bodyJoin: '│',

    joinBody: '─',
    joinLeft: '├',
    joinRight: '┤',
    joinJoin: '┼',
};

export class Table {
    private rows: Cell[][] = [];
    private headers: Cell[][] = [];
    private columnWidths: number[] = [];
    private columnCount: number = 0;
    private columnMaxWidths: Map<number, number> = new Map();
    private spanningCells: Map<string, CellOptions> = new Map();
    private rowSpanningCells: Map<string, CellOptions> = new Map();
    private border: BorderStyle;
    private align: HorizontalAlign;
    private padding: number;

    constructor(options: TableOptions = {}) {
        this.border = options.border || DEFAULT_BORDER;
        this.align = options.align || 'left';
        this.padding = options.padding || 1;
    }

    private normalizeCellOption(cell: Cell): CellOptions {
        if (cell === null || cell === undefined) {
            return { content: '' };
        }

        // Handle primitive types
        if (['boolean', 'number', 'bigint', 'string'].includes(typeof cell)) {
            return { content: String(cell) };
        }

        // Handle object options
        if (typeof cell === 'object') {
            const options = cell as CellOptions;
            return {
                ...options,
                content: String(options.content || ''),
                colSpan: options.colSpan || 1,
                rowSpan: options.rowSpan || 1,
                hAlign: options.hAlign || this.align,
                vAlign: options.vAlign || 'middle'
            };
        }

        throw new Error('Cell content must be a primitive or object with content property');
    }

    private getCellWidth(cell: Cell): number {
        const normalizedCell = this.normalizeCellOption(cell);
        const content = normalizedCell.content?.toString() || '';

        // For multi-line content, get the maximum line width
        return Math.max(
            ...content.split('\n').map(line => this.strlen(line))
        );
    }

    private strlen(str: string): number {
        const code = /\u001b\[(?:\d*;){0,5}\d*m/g;
        const stripped = str.replace(code, '');
        const split = stripped.split('\n');
        return split.reduce((memo, s) => {
            const width = this.stringWidth(s);
            return width > memo ? width : memo;
        }, 0);
    }

    private stringWidth(str: string): number {
        // Basic implementation - can be replaced with more sophisticated one
        let width = 0;
        for (let i = 0; i < str.length; i++) {
            const code = str.charCodeAt(i);
            if (code >= 0x1100 && (
                code <= 0x115f ||  // Hangul Jamo
                code === 0x2329 || // LEFT-POINTING ANGLE BRACKET
                code === 0x232a || // RIGHT-POINTING ANGLE BRACKET
                // CJK Radicals Supplement .. Enclosed CJK Letters and Months
                (0x2e80 <= code && code <= 0x3247 && code !== 0x303f) ||
                // Enclosed CJK Letters and Months .. CJK Unified Ideographs Extension A
                (0x3250 <= code && code <= 0x4dbf) ||
                // CJK Unified Ideographs .. Yi Radicals
                (0x4e00 <= code && code <= 0xa4c6) ||
                // Hangul Jamo Extended-A
                (0xa960 <= code && code <= 0xa97c) ||
                // Hangul Syllables
                (0xac00 <= code && code <= 0xd7a3) ||
                // CJK Compatibility Ideographs
                (0xf900 <= code && code <= 0xfaff) ||
                // Vertical Forms
                (0xfe10 <= code && code <= 0xfe19) ||
                // CJK Compatibility Forms .. Small Form Variants
                (0xfe30 <= code && code <= 0xfe6b) ||
                // Halfwidth and Fullwidth Forms
                (0xff01 <= code && code <= 0xff60) ||
                (0xffe0 <= code && code <= 0xffe6) ||
                // Kana Supplement
                (0x1b000 <= code && code <= 0x1b001) ||
                // Enclosed Ideographic Supplement
                (0x1f200 <= code && code <= 0x1f251) ||
                // CJK Unified Ideographs Extension B .. Tertiary Ideographic Plane
                (0x20000 <= code && code <= 0x3fffd)
            )) {
                width += 2;
            } else {
                width += 1;
            }
        }
        return width;
    }

    private padCell(cell: Cell, width: number, isHeader: boolean = false): string {
        const normalizedCell = this.normalizeCellOption(cell);
        const content = normalizedCell.content?.toString() || '';
        const lines = content.split('\n');
        const paddedLines: string[] = [];

        for (const line of lines) {
            const lineWidth = this.strlen(line);
            const availableWidth = Math.max(0, width - (this.padding * 2));
            const padWidth = Math.max(0, availableWidth - lineWidth);

            let paddedLine = '';
            // Left padding
            paddedLine += ' '.repeat(this.padding);

            // Content with alignment
            switch (normalizedCell.hAlign || 'left') {
                case 'right':
                    paddedLine += ' '.repeat(padWidth) + line;
                    break;
                case 'center':
                    const leftPad = Math.floor(padWidth / 2);
                    const rightPad = padWidth - leftPad;
                    paddedLine += ' '.repeat(leftPad) + line + ' '.repeat(rightPad);
                    break;
                default: // 'left'
                    paddedLine += line + ' '.repeat(padWidth);
            }

            // Right padding
            paddedLine += ' '.repeat(this.padding);
            paddedLines.push(paddedLine);
        }

        return paddedLines.join('\n');
    }

    private repeat(str: string, times: number): string {
        return Array(Math.max(0, times) + 1).join(str);
    }

    private truncate(str: string, desiredLength: number, truncateChar: string = '…'): string {
        const lengthOfStr = this.strlen(str);
        if (lengthOfStr <= desiredLength) {
            return str;
        }

        desiredLength -= this.strlen(truncateChar);
        let ret = '';
        let currentLength = 0;
        let inEscapeSequence = false;
        let escapeSequence = '';

        for (let i = 0; i < str.length; i++) {
            const char = str[i];
            if (char === '\u001b') {
                inEscapeSequence = true;
                escapeSequence = char;
                continue;
            }

            if (inEscapeSequence) {
                escapeSequence += char;
                if (char === 'm') {
                    inEscapeSequence = false;
                    ret += escapeSequence;
                }
                continue;
            }

            const charWidth = this.stringWidth(char);
            if (currentLength + charWidth > desiredLength) {
                break;
            }

            ret += char;
            currentLength += charWidth;
        }

        return ret + truncateChar;
    }

    private createLine(left: string, body: string, join: string, right: string): string {
        const result: string[] = [];
        for (let i = 0; i < this.columnCount; i++) {
            result.push(body.repeat(this.columnWidths[i]));
            if (i < this.columnCount - 1) {
                result.push(join);
            }
        }
        return left + result.join('') + right + EOL;
    }

    private layoutTable(): void {
        const positions = this.mapPositions();
        this.columnWidths = this.computeColumnWidths(positions);
        this.addSpanningCells();
    }

    private mapPositions(): Map<Cell, { x: number; y: number }> {
        const positions = new Map<Cell, { x: number; y: number }>();

        // Map header positions
        this.headers.forEach((row, y) => {
            let x = 0;
            row.forEach((cell) => {
                if (cell) {
                    positions.set(cell, { x, y });
                    const colSpan = this.normalizeCellOption(cell).colSpan || 1;
                    x += colSpan;
                } else {
                    x++;
                }
            });
        });

        // Map row positions
        this.rows.forEach((row, rowIndex) => {
            let x = 0;
            row.forEach((cell) => {
                if (cell) {
                    positions.set(cell, { x, y: rowIndex + this.headers.length });
                    const colSpan = this.normalizeCellOption(cell).colSpan || 1;
                    x += colSpan;
                } else {
                    x++;
                }
            });
        });

        return positions;
    }

    private computeColumnWidths(positions: Map<Cell, { x: number; y: number }>): number[] {
        const widths = new Array(this.columnCount).fill(0);
        const alignments = new Array(this.columnCount).fill('');

        // First pass: Calculate widths for header cells and store alignments
        this.headers.forEach(row => {
            row.forEach((cell, index) => {
                if (cell) {
                    const normalizedCell = this.normalizeCellOption(cell);
                    const colSpan = normalizedCell.colSpan || 1;
                    
                    if (colSpan === 1) {
                        widths[index] = Math.max(widths[index], this.getCellWidth(normalizedCell));
                        alignments[index] = normalizedCell.hAlign || 'left';
                    }
                }
            });
        });

        // Second pass: Calculate widths for non-spanning cells in rows
        this.rows.forEach(row => {
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

        // Third pass: Handle spanning cells in headers
        this.headers.forEach(row => {
            row.forEach((cell, index) => {
                if (cell) {
                    const normalizedCell = this.normalizeCellOption(cell);
                    const colSpan = normalizedCell.colSpan || 1;

                    if (colSpan > 1) {
                        const cellWidth = this.getCellWidth(normalizedCell);
                        let currentSpanWidth = 0;
                        
                        // Calculate current span width including borders
                        for (let i = 0; i < colSpan; i++) {
                            if (index + i < this.columnCount) {
                                currentSpanWidth += widths[index + i];
                                if (i < colSpan - 1) {
                                    currentSpanWidth += 1; // Add border width
                                }
                            }
                        }

                        if (cellWidth > currentSpanWidth) {
                            // Distribute the extra width proportionally
                            const extraWidth = cellWidth - currentSpanWidth;
                            const columnsToAdjust = Math.min(colSpan, this.columnCount - index);
                            const extraPerColumn = Math.ceil(extraWidth / columnsToAdjust);
                            
                            for (let i = 0; i < columnsToAdjust; i++) {
                                widths[index + i] += extraPerColumn;
                            }
                        }
                    }
                }
            });
        });

        // Fourth pass: Handle spanning cells in rows
        this.rows.forEach(row => {
            row.forEach((cell, index) => {
                if (cell) {
                    const normalizedCell = this.normalizeCellOption(cell);
                    const colSpan = normalizedCell.colSpan || 1;

                    if (colSpan > 1) {
                        const cellWidth = this.getCellWidth(normalizedCell);
                        let currentSpanWidth = 0;
                        
                        // Calculate current span width including borders
                        for (let i = 0; i < colSpan; i++) {
                            if (index + i < this.columnCount) {
                                currentSpanWidth += widths[index + i];
                                if (i < colSpan - 1) {
                                    currentSpanWidth += 1; // Add border width
                                }
                            }
                        }

                        if (cellWidth > currentSpanWidth) {
                            // Distribute the extra width proportionally
                            const extraWidth = cellWidth - currentSpanWidth;
                            const columnsToAdjust = Math.min(colSpan, this.columnCount - index);
                            const extraPerColumn = Math.ceil(extraWidth / columnsToAdjust);
                            
                            for (let i = 0; i < columnsToAdjust; i++) {
                                widths[index + i] += extraPerColumn;
                            }
                        }

                        // Use header alignment if not specified in cell
                        if (!normalizedCell.hAlign) {
                            // Find the dominant alignment in the spanned columns
                            const spannedAlignments = alignments.slice(index, index + colSpan).filter(Boolean);
                            if (spannedAlignments.length > 0) {
                                const alignmentCounts = spannedAlignments.reduce((acc, curr) => {
                                    acc[curr] = (acc[curr] || 0) + 1;
                                    return acc;
                                }, {} as Record<string, number>);
                                
                                const dominantAlignment = Object.entries(alignmentCounts)
                                    .reduce((a, b) => a[1] > b[1] ? a : b)[0];
                                normalizedCell.hAlign = dominantAlignment;
                            }
                        }
                    }
                }
            });
        });

        // Add padding to all columns
        return widths.map(width => width + (this.padding * 2));
    }

    private addSpanningCells() {
        const positions = new Map<Cell, { x: number; y: number }>();

        this.rows.forEach((row, rowIndex) => {
            let x = 0;
            row.forEach((cell) => {
                if (cell) {
                    positions.set(cell, { x, y: rowIndex + this.headers.length });
                    const colSpan = this.normalizeCellOption(cell).colSpan || 1;
                    x += colSpan;
                } else {
                    x++;
                }
            });
        });

        this.rows.forEach((row, rowIndex) => {
            row.forEach((cell) => {
                const normalizedCell = this.normalizeCellOption(cell);
                const rowSpan = normalizedCell.rowSpan || 1;
                const colSpan = normalizedCell.colSpan || 1;
                const pos = positions.get(cell);

                if (!pos) return;

                if (rowSpan > 1) {
                    for (let i = 1; i < rowSpan; i++) {
                        if (rowIndex + i < this.rows.length) {
                            const key = `${rowIndex + i},${pos.x}`;
                            this.rowSpanningCells.set(key, normalizedCell);
                        }
                    }
                }

                if (colSpan > 1) {
                    for (let i = 1; i < colSpan; i++) {
                        if (pos.x + i < row.length) {
                            row[pos.x + i] = undefined;
                        }
                    }
                }
            });
        });
    }

    private renderBorder(border: { topBody?: string; topJoin?: string; topLeft?: string; topRight?: string } = {}): string {
        if (!border || !border.topBody) {
            return '';
        }

        const left = border.topLeft || '';
        const body = border.topBody;
        const join = border.topJoin || '';
        const right = border.topRight || '';

        const result: string[] = [];
        let currentCol = 0;

        while (currentCol < this.columnWidths.length) {
            result.push(body.repeat(this.columnWidths[currentCol]));
            if (currentCol < this.columnWidths.length - 1) {
                result.push(join);
            }
            currentCol++;
        }

        return left + result.join('') + right + EOL;
    }

    private renderHeaders(): string {
        let result = '';

        // Headers (without top border)
        this.headers.forEach((row, index) => {
            result += this.renderRow(row, {
                bodyLeft: this.border.bodyLeft || '',
                bodyRight: this.border.bodyRight || '',
                bodyJoin: this.border.bodyJoin || ''
            }, true);

            // Add separator after header
            if (index === this.headers.length - 1 && this.border.joinBody) {
                result += this.createLine(
                    this.border.joinLeft || '',
                    this.border.joinBody,
                    this.border.joinJoin || '',
                    this.border.joinRight || ''
                );
            }
        });

        return result;
    }

    private renderRow(row: Cell[], border: BorderStyle, isHeader: boolean = false): string {
        const leftBorder = border.bodyLeft || '';
        const rightBorder = border.bodyRight || '';
        const joinBorder = border.bodyJoin || '';
        let result = leftBorder;

        let currentCol = 0;
        while (currentCol < this.columnCount) {
            const cell = row[currentCol];
            
            if (cell === undefined || cell === null) {
                result += ' '.repeat(this.columnWidths[currentCol]);
                currentCol++;
            } else {
                const normalizedCell = this.normalizeCellOption(cell);
                const colSpan = normalizedCell.colSpan || 1;
                let totalWidth = this.columnWidths[currentCol];
                
                // Calculate total width including borders for spanning cells
                for (let i = 1; i < colSpan && (currentCol + i) < this.columnCount; i++) {
                    totalWidth += this.columnWidths[currentCol + i] + joinBorder.length;
                }
                
                result += this.padCell(normalizedCell, totalWidth, isHeader);
                currentCol += colSpan;
            }
            
            if (currentCol < this.columnCount) {
                result += joinBorder;
            }
        }

        result += rightBorder + EOL;
        return result;
    }

    public setHeaders(headers: Cell[]): Table {
        const processedHeaders: Cell[] = [];
        let maxCol = 0;
        let currentCol = 0;

        // First pass: Count total columns needed and create processed headers
        headers.forEach(cell => {
            if (!cell) {
                processedHeaders[currentCol] = null;
                maxCol = Math.max(maxCol, currentCol + 1);
                currentCol++;
            } else {
                const normalizedCell = this.normalizeCellOption(cell);
                const colSpan = normalizedCell.colSpan || 1;

                // Add the cell
                processedHeaders[currentCol] = normalizedCell;
                
                // Add null cells for spanning columns
                for (let i = 1; i < colSpan; i++) {
                    processedHeaders[currentCol + i] = null;
                }
                
                maxCol = Math.max(maxCol, currentCol + colSpan);
                currentCol += colSpan;
            }
        });

        // Second pass: Ensure array is fully populated
        for (let i = 0; i < maxCol; i++) {
            if (processedHeaders[i] === undefined) {
                processedHeaders[i] = null;
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

    public addRow(row: Cell[]): Table {
        this.rows.push(row);
        this.layoutTable();
        this.addSpanningCells();
        return this;
    }

    public addRows(rows: Cell[][]): Table {
        rows.forEach(row => this.addRow(row));
        return this;
    }

    public toString(): string {
        let result = '';

        // Top border
        if (this.border.topBody) {
            result += this.createLine(
                this.border.topLeft || '',
                this.border.topBody,
                this.border.topJoin || '',
                this.border.topRight || ''
            );
        }

        // Headers
        this.headers.forEach((row, index) => {
            result += this.renderRow(row, {
                bodyLeft: this.border.bodyLeft || '',
                bodyRight: this.border.bodyRight || '',
                bodyJoin: this.border.bodyJoin || ''
            }, true);

            // Add separator after header
            if (index === this.headers.length - 1 && this.border.joinBody) {
                result += this.createLine(
                    this.border.joinLeft || '',
                    this.border.joinBody,
                    this.border.joinJoin || '',
                    this.border.joinRight || ''
                );
            }
        });

        // Body rows
        this.rows.forEach((row, index) => {
            result += this.renderRow(row, {
                bodyLeft: this.border.bodyLeft || '',
                bodyRight: this.border.bodyRight || '',
                bodyJoin: this.border.bodyJoin || ''
            });

            // Add row separator except for last row
            if (index < this.rows.length - 1 && this.border.joinBody) {
                result += this.createLine(
                    this.border.joinLeft || '',
                    this.border.joinBody,
                    this.border.joinJoin || '',
                    this.border.joinRight || ''
                );
            }
        });

        // Bottom border
        if (this.border.bottomBody) {
            result += this.createLine(
                this.border.bottomLeft || '',
                this.border.bottomBody,
                this.border.bottomJoin || '',
                this.border.bottomRight || ''
            );
        }

        return result;
    }
}

export const createTable = (options?: TableOptions): Table => new Table(options);

function stripAnsi(str: string): string {
    return str.replace(/\u001b\[(?:\d*;){0,5}\d*m/g, '');
}
