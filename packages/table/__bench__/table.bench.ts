import { describe, bench } from "vitest";
import { default as Table3 } from "cli-table3";
import { createTable } from "../src/index.js";
import { generateBasicTable, generateComplexTable } from "./utils.js";

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

    // bench("@visulima/table - complex table (100x10)", () => {
    //     const table = createTable();
    //
    //     // Generate complex table with rowspans and colspans
    //     const rows = [];
    //     for (let y = 0; y < 100; y++) {
    //         const row = [];
    //         for (let x = 0; x < 10; x++) {
    //             const colSpan = Math.random() > 0.8 ? 2 : 1;
    //             const rowSpan = Math.random() > 0.8 ? 2 : 1;
    //             if (colSpan > 1 || rowSpan > 1) {
    //                 row.push({ content: `${y}-${x} (${rowSpan}x${colSpan})`, colSpan, rowSpan });
    //                 x += colSpan - 1;
    //             } else {
    //                 row.push(`${y}-${x} (1x1)`);
    //             }
    //         }
    //         rows.push(row);
    //     }
    //
    //     // Add rows that don't conflict with rowspans
    //     for (const row of rows) {
    //         table.addRow(row);
    //     }
    //
    //     table.toString();
    // });
    //
    // bench("cli-table3 - complex table (100x10)", () => {
    //     generateComplexTable(100, 10, Table3).toString();
    // });
});
