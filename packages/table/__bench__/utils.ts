interface CellOptions {
    x: number;
    y: number;
    colSpan?: number;
    rowSpan?: number;
}

interface TableOptions {
    colSpans?: Record<number, number>;
    maxCols?: number;
    tableOptions?: any;
}

const cellContent = ({ x, y, colSpan = 1, rowSpan = 1 }: CellOptions): string => {
    return `${y}-${x} (${rowSpan}x${colSpan})`;
};

const generateBasicTable = (rows: number, cols: number, Table: any, options = {}) => {
    const table = new Table(options);

    for (let y = 0; y < rows; y++) {
        const row = [];
        for (let x = 0; x < cols; x++) {
            row.push(cellContent({ y, x }));
        }
        table.push(row);
    }

    return table;
};

const randomNumber = (min: number, max: number, op = "round"): number => {
    return Math[op](Math.random() * (max - min) + min);
};

const next = (alloc: Record<number, number>, idx: number, dir = 1): number => {
    if (alloc[idx]) {
        return next(alloc, idx + 1 * dir);
    }
    return idx;
};

const generateComplexRow = (y: number, spanX: number, cols: number, alloc: Record<number, number>, options: TableOptions = {}) => {
    let x = next(alloc, 0);
    const row = [];
    while (x < cols) {
        const { colSpans = {} } = options;
        const opt = {
            colSpan: colSpans[x] || next(alloc, randomNumber(x + 1, options.maxCols || cols, "ceil"), -1) - x,
            rowSpan: randomNumber(1, spanX),
        };
        row.push({ content: cellContent({ y, x, ...opt }), ...opt });
        if (opt.rowSpan > 1) {
            for (let i = 0; i < opt.colSpan; i++) {
                alloc[x + i] = opt.rowSpan;
            }
        }

        x = next(alloc, x + opt.colSpan);
    }
    return row;
};

const generateComplexRows = (y: number, rows: number, cols: number, alloc: Record<number, number> = {}, options: TableOptions = {}) => {
    const remaining = rows - y;
    let spanX = remaining > 1 ? randomNumber(1, remaining) : 1;
    const lines = [];
    while (spanX > 0) {
        lines.push(generateComplexRow(y, spanX, cols, alloc, options));
        y++;
        spanX--;
        Object.keys(alloc).forEach((idx) => {
            alloc[idx]--;
            if (alloc[idx] <= 0) delete alloc[idx];
        });
    }
    return lines;
};

const generateComplexTable = (rows: number, cols: number, Table: any, options: TableOptions = {}) => {
    const table = new Table(options.tableOptions);
    while (table.length < rows) {
        const y = table.length || (table.options?.head && 1) || 0;
        generateComplexRows(y, rows, cols, {}, options).forEach((row) => table.push(row));
    }
    return table;
};

export { generateBasicTable, generateComplexTable, generateComplexRow };
