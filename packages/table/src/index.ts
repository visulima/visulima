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
        const contentWidth = this.strlen(content);
        const availableWidth = width - (this.padding * 2);
        const paddingWidth = Math.max(0, availableWidth - contentWidth);
        const hAlign = normalizedCell.hAlign || 'left';

        let leftPad = ' '.repeat(this.padding);
        let rightPad = ' '.repeat(this.padding);

        if (paddingWidth > 0) {
            if (hAlign === 'right') {
                leftPad += ' '.repeat(paddingWidth);
            } else if (hAlign === 'center') {
                const leftExtra = Math.floor(paddingWidth / 2);
                const rightExtra = paddingWidth - leftExtra;
                leftPad += ' '.repeat(leftExtra);
                rightPad = ' '.repeat(this.padding + rightExtra);
            } else { // left
                rightPad = ' '.repeat(this.padding + paddingWidth);
            }
        }

        return leftPad + content + rightPad;
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

    private layoutTable(): void {
        this.columnWidths = this.computeColumnWidths(this.mapPositions());
    }

    private computeColumnWidths(positions: Map<Cell, { x: number; y: number }>): number[] {
        const widths: number[] = [];
        const spans = new Map<number, number>(); // Track column spans

        // First pass: Calculate base widths and track spans
        this.headers.forEach(row => {
            let currentCol = 0;
            row.forEach(cell => {
                if (!cell) return;
                const normalizedCell = this.normalizeCellOption(cell);
                const content = normalizedCell.content?.toString() || '';
                const colSpan = normalizedCell.colSpan || 1;

                if (colSpan === 1) {
                    const width = this.strlen(content);
                    widths[currentCol] = Math.max(widths[currentCol] || 0, width);
                } else {
                    spans.set(currentCol, colSpan);
                }
                currentCol += colSpan;
            });
        });

        // Second pass: Process data rows
        this.rows.forEach(row => {
            let currentCol = 0;
            row.forEach(cell => {
                if (!cell) {
                    currentCol++;
                    return;
                }

                const normalizedCell = this.normalizeCellOption(cell);
                const content = normalizedCell.content?.toString() || '';
                const width = this.strlen(content);
                widths[currentCol] = Math.max(widths[currentCol] || 0, width);
                currentCol++;
            });
        });

        // Third pass: Distribute span widths
        spans.forEach((span, startCol) => {
            let totalWidth = 0;
            for (let i = 0; i < span; i++) {
                totalWidth += widths[startCol + i] || 0;
            }
            
            // Ensure minimum width for spanned content
            const minWidth = Math.ceil(totalWidth / span);
            for (let i = 0; i < span; i++) {
                widths[startCol + i] = Math.max(widths[startCol + i] || 0, minWidth);
            }
        });

        // Add padding
        return widths.map(width => width + (this.padding * 2));
    }

    private mapPositions(): Map<Cell, { x: number; y: number }> {
        const positions = new Map<Cell, { x: number; y: number }>();

        // First pass: Store positions
        this.rows.forEach((row, y) => {
            row.forEach((cell, x) => {
                positions.set(cell, { x, y });
            });
        });

        return positions;
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

        // Render headers with proper border style
        this.headers.forEach((row, index) => {
            // Top border for first header row
            if (index === 0 && this.border.top) {
                result += this.renderBorder(this.border.top);
            }

            // Render the header row
            result += this.renderRow(row, {
                bodyLeft: this.border.bodyLeft || '',
                bodyRight: this.border.bodyRight || '',
                bodyJoin: this.border.bodyJoin || ''
            }, true);

            // Bottom border after headers
            if (this.border.mid) {
                result += this.renderBorder(this.border.mid);
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

        while (currentCol < this.columnWidths.length) {
            const cell = row[currentCol];

            // Skip undefined cells (used for rowSpan/colSpan)
            if (cell === undefined || cell === null) {
                result += ' '.repeat(this.columnWidths[currentCol]);
                currentCol++;
                if (currentCol < this.columnWidths.length) {
                    result += joinBorder;
                }
                continue;
            }

            const normalizedCell = this.normalizeCellOption(cell);
            const colSpan = normalizedCell.colSpan || 1;

            // Calculate total width for spanning cells
            let totalWidth = this.columnWidths[currentCol];
            if (colSpan > 1) {
                for (let i = 1; i < colSpan; i++) {
                    if (currentCol + i < this.columnWidths.length) {
                        totalWidth += this.columnWidths[currentCol + i] + joinBorder.length;
                    }
                }

                // For header cells with colSpan, ensure content is centered
                if (isHeader) {
                    const content = normalizedCell.content?.toString() || '';
                    normalizedCell.hAlign = 'center';
                }
            }

            result += this.padCell(normalizedCell, totalWidth, isHeader);
            currentCol += colSpan;

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

// Convenient factory function
export const createTable = (options?: TableOptions): Table => new Table(options);

// Strip ANSI color codes for width calculation
function stripAnsi(str: string): string {
    return str.replace(/\u001b\[(?:\d*;){0,5}\d*m/g, '');
}
