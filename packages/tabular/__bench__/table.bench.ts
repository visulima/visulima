import Table3 from "cli-table3";
import { table } from "table";
import { bench, describe } from "vitest";

import { createTable } from "../src";

interface CellOptions {
    colSpan?: number;
    rowSpan?: number;
    x: number;
    y: number;
}

const cellContent = ({ colSpan = 1, rowSpan = 1, x, y }: CellOptions): string => `${y}-${x} (${rowSpan}x${colSpan})`;

const generateBasicTable = (rows: number, cols: number, Table: any, options = {}) => {
    const table = new Table(options);

    for (let y = 0; y < rows; y++) {
        const row = [];

        for (let x = 0; x < cols; x++) {
            row.push(cellContent({ x, y }));
        }

        table.push(row);
    }

    return table;
};

describe("Table Rendering 1763 rows (5 columns)", () => {
    bench("@visulima/tabular", () => {
        const table = createTable({
            style: {
                paddingLeft: 1,
                paddingRight: 1,
            },
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
        for (let index = 1; index <= 1763; index++) {
            table.addRow([index.toString(), `User ${index}`, `user${index}@example.com`, index % 2 === 0 ? "Active" : "Inactive", new Date(2024, 0, 1, 0, index).toISOString()]);
        }

        // Render the table
        table.toString();
    });

    bench("cli-table3", () => {
        const table = new Table3({
            head: ["ID", "Name", "Email", "Status", "Created At"],
            style: {
                border: [],
                head: [],
            },
        });

        // Generate 1763 rows of mock data
        for (let index = 1; index <= 1763; index++) {
            table.push([index.toString(), `User ${index}`, `user${index}@example.com`, index % 2 === 0 ? "Active" : "Inactive", new Date(2024, 0, 1, 0, index).toISOString()]);
        }

        // Render the table
        table.toString();
    });

    bench("table", () => {
        const data = [["ID", "Name", "Email", "Status", "Created At"]];

        // Generate 1763 rows of mock data
        for (let index = 1; index <= 1763; index++) {
            data.push([index.toString(), `User ${index}`, `user${index}@example.com`, index % 2 === 0 ? "Active" : "Inactive", new Date(2024, 0, 1, 0, index).toISOString()]);
        }

        // Render the table
        table(data);
    });
});

describe("Table Rendering basic table (100x10)", () => {
    bench("@visulima/tabular", () => {
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
            { content: "This is a very long description that should be automatically wrapped to fit within the cell width", maxWidth: 40, wordWrap: true },
            { content: "Active and pending review from the team", maxWidth: 30, wordWrap: true },
            { content: "Multiple notes need to be added here for context", maxWidth: 40, wordWrap: true },
        ],
        [
            { content: "A shorter description", maxWidth: 40, wordWrap: true },
            { content: "Completed", maxWidth: 30, wordWrap: true },
            { content: "This is a very long note that will be wrapped automatically to demonstrate the word wrap feature", maxWidth: 40, wordWrap: true },
        ],
    ];

    bench("@visulima/tabular", () => {
        const table = createTable();

        table.setHeaders(wrapHeaders);
        table.addRows(...wrapRows);
        table.toString();
    });

    bench("cli-table3", () => {
        const table = new Table3({
            colWidths: [40, 30, 40],
            head: wrapHeaders,
            style: {
                border: [],
                head: [],
            },
            wordWrap: true,
        });

        table.push(...wrapRows.map((row) => row.map((cell) => cell.content)));
        table.toString();
    });

    bench("table", () => {
        const data = [wrapHeaders];

        data.push(...wrapRows.map((row) => row.map((cell) => cell.content)));
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
    bench("@visulima/tabular", () => {
        const table = createTable();

        // Add header with colspan
        table.setHeaders([{ colSpan: 3, content: "Span All" }]);

        // Add rows with various spans
        table.addRows(
            [{ colSpan: 2, content: "Span Two" }, "C"],
            ["A", { colSpan: 2, content: "Span Two" }],
            ["A", "B", "C"],
            [{ colSpan: 3, content: "Span All" }],
        );

        table.toString();
    });

    bench("cli-table3", () => {
        const table = new Table3({
            style: {
                border: [],
                head: [],
            },
        });

        // cli-table3 uses a different approach for spans
        table.push(
            [{ colSpan: 3, content: "Span All" }],
            [{ colSpan: 2, content: "Span Two" }, "C"],
            ["A", { colSpan: 2, content: "Span Two" }],
            ["A", "B", "C"],
            [{ colSpan: 3, content: "Span All" }],
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
                { col: 0, colSpan: 3, row: 0 },
                { col: 0, colSpan: 2, row: 1 },
                { col: 1, colSpan: 2, row: 2 },
                { col: 0, colSpan: 3, row: 4 },
            ],
        });
    });
});

describe("Table Rendering with truncation", () => {
    const longText = "This is a very long text that should be truncated at some point to fit within the cell";

    bench("@visulima/tabular", () => {
        const table = createTable();

        table.setHeaders([{ content: longText, maxWidth: 20 }, { content: "Normal" }]);
        table.addRow([{ content: longText, maxWidth: 20 }, "Short"]);
        table.toString();
    });

    bench("cli-table3", () => {
        const table = new Table3({
            colWidths: [20, 10],
            head: [longText, "Normal"],
            style: {
                border: [],
                head: [],
            },
            truncate: "…",
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
            columns: [{ truncate: 20, width: 20 }, { width: 10 }],
        });
    });
});
