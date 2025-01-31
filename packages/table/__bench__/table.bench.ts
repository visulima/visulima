import { describe, bench } from "vitest";
import { default as Table3 } from "cli-table3";
import { table } from "table";
import { createTable } from "../src/index.js";

interface CellOptions {
    x: number;
    y: number;
    colSpan?: number;
    rowSpan?: number;
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

describe("Table Rendering 1763 rows (5 columns)", () => {
    bench("@visulima/table", () => {
        const table = createTable({
            padding: 1,
        });

        // Generate headers
        table.setHeaders([
            { content: "ID", hAlign: "left" },
            { content: "Name", hAlign: "left" },
            { content: "Email", hAlign: "left" },
            { content: "Status", hAlign: "center" },
            { content: "Created At", hAlign: "right" },
        ]);

        // Generate 1763 rows of mock data
        for (let i = 1; i <= 1763; i++) {
            table.addRow([
                i.toString(),
                `User ${i}`,
                `user${i}@example.com`,
                i % 2 === 0 ? "Active" : "Inactive",
                new Date(2024, 0, 1, 0, i).toISOString(),
            ]);
        }

        // Render the table
        table.toString();
    });

    bench("cli-table3", () => {
        const table = new Table3({
            head: ["ID", "Name", "Email", "Status", "Created At"],
            style: {
                head: [],
                border: [],
            },
        });

        // Generate 1763 rows of mock data
        for (let i = 1; i <= 1763; i++) {
            table.push([
                i.toString(),
                `User ${i}`,
                `user${i}@example.com`,
                i % 2 === 0 ? "Active" : "Inactive",
                new Date(2024, 0, 1, 0, i).toISOString(),
            ]);
        }

        // Render the table
        table.toString();
    });

    bench("table", () => {
        const data = [
            ["ID", "Name", "Email", "Status", "Created At"],
        ];

        // Generate 1763 rows of mock data
        for (let i = 1; i <= 1763; i++) {
            data.push([
                i.toString(),
                `User ${i}`,
                `user${i}@example.com`,
                i % 2 === 0 ? "Active" : "Inactive",
                new Date(2024, 0, 1, 0, i).toISOString(),
            ]);
        }

        // Render the table
        table(data);
    });
});

describe("Table Rendering basic table (100x10)", () => {
    bench("@visulima/table", () => {
        const table = createTable();

        // Generate 100x10 table
        for (let y = 0; y < 100; y++) {
            const row = [];
            for (let x = 0; x < 10; x++) {
                row.push(`${y}-${x} (1x1)`);
            }
            table.addRow(row);
        }

        table.toString();
    });

    bench("cli-table3", () => {
        generateBasicTable(100, 10, Table3).toString();
    });

    bench("table", () => {
        const data = [];
        // Generate 100x10 table
        for (let y = 0; y < 100; y++) {
            const row = [];
            for (let x = 0; x < 10; x++) {
                row.push(`${y}-${x} (1x1)`);
            }
            data.push(row);
        }
        table(data);
    });
});

describe("Table Rendering with word wrap", () => {
    const wrapHeaders = ["Description", "Status", "Notes"];
    const wrapRows = [
        [
            { content: "This is a very long description that should be automatically wrapped to fit within the cell width", wordWrap: true },
            { content: "Active and pending review from the team", wordWrap: true },
            { content: "Multiple notes need to be added here for context", wordWrap: true },
        ],
        [
            { content: "A shorter description", wordWrap: true },
            { content: "Completed", wordWrap: true },
            { content: "This is a very long note that will be wrapped automatically to demonstrate the word wrap feature", wordWrap: true },
        ],
    ];

    bench("@visulima/table", () => {
        const table = createTable();
        table.setHeaders(wrapHeaders);
        table.addRows(wrapRows);
        table.toString();
    });

    bench("cli-table3", () => {
        const table = new Table3({
            head: wrapHeaders,
            wordWrap: true,
            colWidths: [40, 30, 40],
            style: {
                head: [],
                border: [],
            },
        });
        table.push(...wrapRows.map(row => row.map(cell => cell.content)));
        table.toString();
    });

    bench("table", () => {
        const data = [wrapHeaders];
        data.push(...wrapRows.map(row => row.map(cell => cell.content)));
        table(data, {
            columns: [
                { width: 40, wrapWord: true },
                { width: 30, wrapWord: true },
                { width: 40, wrapWord: true },
            ],
        });
    });
});

describe("Table Rendering with spanning cells", () => {
    bench("@visulima/table", () => {
        const table = createTable();

        // Add header with colspan
        table.setHeaders([
            { content: "Span All", colSpan: 3 },
        ]);

        // Add rows with various spans
        table.addRows([
            [{ content: "Span Two", colSpan: 2 }, "C"],
            ["A", { content: "Span Two", colSpan: 2 }],
            ["A", "B", "C"],
            [{ content: "Span All", colSpan: 3 }],
        ]);

        table.toString();
    });

    bench("cli-table3", () => {
        const table = new Table3({
            style: {
                head: [],
                border: [],
            },
        });

        // cli-table3 uses a different approach for spans
        table.push(
            [{ content: "Span All", colSpan: 3 }],
            [{ content: "Span Two", colSpan: 2 }, "C"],
            ["A", { content: "Span Two", colSpan: 2 }],
            ["A", "B", "C"],
            [{ content: "Span All", colSpan: 3 }],
        );

        table.toString();
    });

    bench("table", () => {
        // Note: table package doesn't support column spans directly
        // We'll simulate it by using spaces to achieve similar visual effect
        const data = [
            ["Span All", "", ""],
            ["Span Two", "", "C"],
            ["A", "Span Two", ""],
            ["A", "B", "C"],
            ["Span All", "", ""],
        ];
        table(data, {
            spanningCells: [
                { col: 0, row: 0, colSpan: 3 },
                { col: 0, row: 1, colSpan: 2 },
                { col: 1, row: 2, colSpan: 2 },
                { col: 0, row: 4, colSpan: 3 },
            ],
        });
    });
});

describe("Table Rendering with truncation", () => {
    const longText = "This is a very long text that should be truncated at some point to fit within the cell";

    bench("@visulima/table", () => {
        const table = createTable();
        table.setHeaders([
            { content: longText, maxWidth: 20 },
            { content: "Normal" },
        ]);
        table.addRow([
            { content: longText, maxWidth: 20 },
            "Short"
        ]);
        table.toString();
    });

    bench("cli-table3", () => {
        const table = new Table3({
            head: [longText, "Normal"],
            colWidths: [20, 10],
            truncate: "…",
            style: {
                head: [],
                border: [],
            },
        });
        table.push([longText, "Short"]);
        table.toString();
    });

    bench("table", () => {
        const data = [
            [longText, "Normal"],
            [longText, "Short"],
        ];
        table(data, {
            columns: [
                { width: 20, truncate: 20 },
                { width: 10 },
            ],
        });
    });
});
