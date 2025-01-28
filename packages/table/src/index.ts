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
        const padding = ' '.repeat(this.padding);
        
        // Calculate available width for content (subtract padding)
        const availableWidth = Math.max(0, width - (this.padding * 2));
        
        // If no content or width is too small, return empty padding
        if (!content || availableWidth <= 0) {
            return ' '.repeat(Math.max(0, width));
        }

        // Handle multi-line content
        const lines = content.split('\n');
        const paddedLines = lines.map(line => {
            const lineWidth = this.strlen(line);
            const hAlign = normalizedCell.hAlign || this.align;

            // Calculate the actual space needed
            const spaceNeeded = Math.max(0, availableWidth - lineWidth);
            let padded = '';

            switch (hAlign) {
                case 'right': {
                    padded = ' '.repeat(spaceNeeded) + line;
                    break;
                }
                case 'center': {
                    const leftSpace = Math.floor(spaceNeeded / 2);
                    const rightSpace = spaceNeeded - leftSpace;
                    padded = ' '.repeat(leftSpace) + line + ' '.repeat(rightSpace);
                    break;
                }
                default: // 'left'
                    padded = line + ' '.repeat(spaceNeeded);
            }

            // Add cell padding
            return padding + padded + padding;
        });

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

    private createLine(left: string = '', body: string = '', join: string = '', right: string = ''): string {
        const result: string[] = [];
        let currentCol = 0;

        while (currentCol < this.columnWidths.length) {
            const width = this.columnWidths[currentCol];
            result.push(body.repeat(width));
            if (currentCol < this.columnWidths.length - 1) {
                result.push(join);
            }
            currentCol++;
        }

        return left + result.join('') + right + EOL;
    }

    private layoutTable() {
        const alloc: { [key: number]: number } = {};
        const positions = new Map<Cell, { x: number; y: number }>();
        
        // First pass: Layout the cells and handle rowSpans
        this.rows.forEach((row, rowIndex) => {
            let col = 0;
            row.forEach((cell) => {
                // Find next available column
                while (alloc[col] > 0) {
                    col++;
                }

                // Store cell position
                positions.set(cell, { x: col, y: rowIndex });

                // Set cell position
                const normalizedCell = this.normalizeCellOption(cell);
                const rowSpan = normalizedCell.rowSpan || 1;
                const colSpan = normalizedCell.colSpan || 1;

                // Mark columns as allocated for rowSpans
                if (rowSpan > 1) {
                    for (let i = 0; i < colSpan; i++) {
                        alloc[col + i] = rowSpan;
                    }
                }

                col += colSpan;
            });

            // Decrement allocation counts
            Object.keys(alloc).forEach((idx) => {
                alloc[parseInt(idx)]--;
                if (alloc[parseInt(idx)] < 1) {
                    delete alloc[parseInt(idx)];
                }
            });
        });

        // Second pass: Calculate column widths
        this.columnWidths = this.computeColumnWidths(positions);
    }

    private computeColumnWidths(positions: Map<Cell, { x: number; y: number }>): number[] {
        const widths: number[] = [];
        const spanningCells: Array<{ cell: Cell; x: number }> = [];

        // Calculate initial widths from headers and content
        const processCell = (cell: Cell, x: number) => {
            if (!cell) return;
            const normalizedCell = this.normalizeCellOption(cell);
            const colSpan = normalizedCell.colSpan || 1;
            
            if (colSpan === 1) {
                const cellWidth = this.getCellWidth(cell);
                widths[x] = Math.max(widths[x] || 0, cellWidth);
            } else {
                spanningCells.push({ cell, x });
            }
        };

        // Process headers
        this.headers.forEach(row => {
            row.forEach((cell, x) => processCell(cell, x));
        });

        // Process data rows
        this.rows.forEach(row => {
            row.forEach((cell, x) => {
                if (!cell) return;
                const pos = positions.get(cell);
                if (pos) {
                    processCell(cell, pos.x);
                }
            });
        });

        // Handle spanning cells
        spanningCells.forEach(({ cell, x }) => {
            const normalizedCell = this.normalizeCellOption(cell);
            const colSpan = normalizedCell.colSpan || 1;
            const cellWidth = this.getCellWidth(cell);

            // Calculate current width of spanned columns
            let currentWidth = 0;
            for (let i = 0; i < colSpan; i++) {
                currentWidth += (widths[x + i] || 0);
                if (i > 0) currentWidth++; // Add border width
            }

            if (cellWidth > currentWidth) {
                // Distribute extra width evenly
                const extra = cellWidth - currentWidth;
                const perColumn = Math.ceil(extra / colSpan);
                
                for (let i = 0; i < colSpan; i++) {
                    widths[x + i] = (widths[x + i] || 0) + perColumn;
                }
            }
        });

        // Add padding and ensure minimum width
        return widths.map(width => {
            const minContentWidth = Math.max(1, width || 0);
            return minContentWidth + (this.padding * 2); // Add padding for both sides
        });
    }

    private addSpanningCells() {
        const positions = new Map<Cell, { x: number; y: number }>();
        
        // First pass: Store positions
        this.rows.forEach((row, y) => {
            row.forEach((cell, x) => {
                positions.set(cell, { x, y });
            });
        });

        // Second pass: Handle spans
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

    private renderRow(row: Cell[], border: BorderStyle, isHeader: boolean = false): string {
        const leftBorder = border.bodyLeft || '';
        const rightBorder = border.bodyRight || '';
        const joinBorder = border.bodyJoin || '';

        let result = leftBorder;
        let currentCol = 0;
        const rowIndex = isHeader ? -1 : this.rows.length - 1;

        // Track which columns are part of a rowSpan
        const spanningColumns = new Map<number, CellOptions>();
        for (let i = 0; i < this.columnWidths.length; i++) {
            const key = `${rowIndex},${i}`;
            if (this.rowSpanningCells.has(key)) {
                spanningColumns.set(i, this.rowSpanningCells.get(key)!);
            }
        }

        while (currentCol < this.columnWidths.length) {
            // Handle row spanning cells
            if (spanningColumns.has(currentCol)) {
                const spanCell = spanningColumns.get(currentCol)!;
                result += this.padCell(spanCell, this.columnWidths[currentCol], isHeader);
                currentCol++;
                if (currentCol < this.columnWidths.length) {
                    result += joinBorder;
                }
                continue;
            }

            const cell = row[currentCol];
            // Skip undefined cells (used for rowSpan/colSpan)
            if (cell === undefined) {
                result += ' '.repeat(this.columnWidths[currentCol]);
                currentCol++;
                if (currentCol < this.columnWidths.length) {
                    result += joinBorder;
                }
                continue;
            }

            const normalizedCell = this.normalizeCellOption(cell);
            const colSpan = normalizedCell.colSpan || 1;
            let width = this.columnWidths[currentCol];

            // Calculate width for column spanning
            if (colSpan > 1) {
                for (let i = 1; i < colSpan; i++) {
                    if (currentCol + i < this.columnWidths.length) {
                        width += this.columnWidths[currentCol + i];
                        width += joinBorder.length;
                    }
                }
            }

            result += this.padCell(cell, width, isHeader);
            currentCol++;
            if (currentCol < this.columnWidths.length) {
                result += joinBorder;
            }
        }

        result += rightBorder + EOL;
        return result;
    }

    public setHeaders(headers: Cell[]): Table {
        this.headers = [headers];
        this.layoutTable();
        this.addSpanningCells();
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
                ...this.border,
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
                ...this.border,
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

// Convenient factory function
export const createTable = (options?: TableOptions): Table => new Table(options);

// Strip ANSI color codes for width calculation
function stripAnsi(str: string): string {
    return str.replace(/\u001b\[\d+m/g, '');
}
