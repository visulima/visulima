import { describe, expect, it } from "vitest";

import { createTable } from "../src/table"; // Assuming Table uses Grid internally

describe("table Cell Spanning", () => {
    describe("colSpan", () => {
        it("should render borders correctly around cells with colSpan", () => {
            const colspanTable = createTable();

            colspanTable.setHeaders([{ colSpan: 3, content: "Header Span All (cs=3)" }]);
            colspanTable.addRow([{ colSpan: 2, content: "Row 1 Span (cs=2)" }, "R1C3"]);
            colspanTable.addRow(["R2C1", { colSpan: 2, content: "Row 2 Span (cs=2)" }]);
            colspanTable.addRow(["R3C1", "R3C2", "R3C3"]);
            colspanTable.addRow([{ colSpan: 3, content: "Row 4 Span All (cs=3)" }]);

            expect(colspanTable.toString()).toMatchInlineSnapshot(`
              "┌──────────────────────────────┐
              │ Header Span All (cs=3)       │
              ├────────────────────┬─────────┤
              │ Row 1 Span (cs=2)  │ R1C3    │
              ├─────────┬──────────┴─────────┤
              │ R2C1    │ Row 2 Span (cs=2)  │
              ├─────────┼──────────┬─────────┤
              │ R3C1    │ R3C2     │ R3C3    │
              ├─────────┴──────────┴─────────┤
              │ Row 4 Span All (cs=3)        │
              └──────────────────────────────┘"
            `);
        });

        it("should render borders correctly with multiple colSpans in one row", () => {
            const table = createTable();
            table.addRow([{ colSpan: 2, content: "CS2" }, "C3"]);
            table.addRow(["C1", { colSpan: 2, content: "CS2" }]);
            table.addRow(["A", "B", "C"]);

            expect(table.toString()).toMatchInlineSnapshot(`
              "┌────────┬────┐
              │ CS2    │ C3 │
              ├────┬───┴────┤
              │ C1 │ CS2    │
              ├────┼───┬────┤
              │ A  │ B │ C  │
              └────┴───┴────┘"
            `);
        });

        // This test was originally in colspan, keep it here but note overlap with rowspan tests
        it("should render borders correctly at colSpan and rowSpan intersections", () => {
            const table = createTable();
            table.addRow(["A1", { colSpan: 2, content: "CS=2" }]);
            table.addRow([
                { content: "RS=2", rowSpan: 2 },
                { colSpan: 2, content: "CS=2, RS=2", rowSpan: 2 },
            ]);

            expect(table.toString()).toMatchInlineSnapshot(`
              "┌──────┬─────────────┐
              │ A1   │ CS=2        │
              ├──────┼─────────────┤
              │ RS=2 │ CS=2, RS=2  │
              │      │             │
              └──────┴─────────────┘"
            `);
        });
    });

    describe("rowSpan", () => {
        it("should correctly render a table with row spans", () => {
            expect.assertions(9);

            const table = createTable();
            table
                .addRow([{ content: "Span 3", rowSpan: 3 }, "B1", { content: "Span 2", rowSpan: 2 }])
                .addRow([null, "B2", null])
                .addRow([null, "B3", "C3"]);

            const output = table.toString();
            const expectedOutput = [
                "┌────────┬────┬────────┐",
                "│ Span 3 │ B1 │ Span 2 │",
                "│        ├────┤        │",
                "│        │ B2 │        │",
                "│        ├────┼────────┤",
                "│        │ B3 │ C3     │",
                "└────────┴────┴────────┘",
            ].join("\n");

            expect(output).toBe(expectedOutput);

            // Additional test to check individual lines
            const lines = output.split("\n");
            expect(lines).toHaveLength(7);
            expect(lines[0]).toBe("┌────────┬────┬────────┐"); // Top border
            expect(lines[1]).toBe("│ Span 3 │ B1 │ Span 2 │"); // First row
            expect(lines[2]).toBe("│        ├────┤        │"); // First separator
            expect(lines[3]).toBe("│        │ B2 │        │"); // Second row
            expect(lines[4]).toBe("│        ├────┼────────┤"); // Second separator
            expect(lines[5]).toBe("│        │ B3 │ C3     │"); // Third row
            expect(lines[6]).toBe("└────────┴────┴────────┘"); // Bottom border
        });

        it("should handle multiple row spans in different columns", () => {
            expect.assertions(1);

            const table = createTable();
            table
                .addRow([{ content: "A1", rowSpan: 2 }, "B1", { content: "C1", rowSpan: 3 }])
                .addRow([null, "B2", null])
                .addRow(["A3", "B3", null]);

            const output = table.toString();
            const expectedOutput = [
                "┌────┬────┬────┐",
                "│ A1 │ B1 │ C1 │",
                "│    ├────┤    │",
                "│    │ B2 │    │",
                "├────┼────┤    │",
                "│ A3 │ B3 │    │",
                "└────┴────┴────┘",
            ].join("\n");

            expect(output).toBe(expectedOutput);
        });

        it("should handle row spans with varying column widths", () => {
            expect.assertions(1);

            const table = createTable();
            table
                .addRow([{ content: "Long Span", rowSpan: 2 }, "Short"])
                .addRow([null, "B2"])
                .addRow(["A3", "B3"]);

            const output = table.toString();
            const expectedOutput = [
                "┌───────────┬───────┐",
                "│ Long Span │ Short │",
                "│           ├───────┤",
                "│           │ B2    │",
                "├───────────┼───────┤",
                "│ A3        │ B3    │",
                "└───────────┴───────┘",
            ].join("\n");

            expect(output).toBe(expectedOutput);
        });

        it("should handle row spans that reach the bottom of the table", () => {
            expect.assertions(1);

            const table = createTable();
            table
                .addRow(["A1", { content: "Span to Bottom", rowSpan: 3 }])
                .addRow(["A2", null])
                .addRow(["A3", null]);

            const output = table.toString();
            const expectedOutput = [
                "┌────┬────────────────┐",
                "│ A1 │ Span to Bottom │",
                "├────┤                │",
                "│ A2 │                │",
                "├────┤                │",
                "│ A3 │                │",
                "└────┴────────────────┘",
            ].join("\n");

            expect(output).toBe(expectedOutput);
        });
    });

    it("should render a complex layout with multiple overlapping spans and alignments", () => {
        // Based on examples/complex-layout.js
        const table = createTable();
        table.addRows(
            [{ colSpan: 9, content: "TOP", hAlign: "center" }],
            [
                { content: "TL", rowSpan: 4, vAlign: "middle" },
                { content: "A1", rowSpan: 3 },
                "B1",
                "C1",
                { content: "D1", rowSpan: 3, vAlign: "middle" },
                "E1",
                "F1",
                { content: "G1", rowSpan: 3 },
                { content: "TR", rowSpan: 4, vAlign: "middle" },
            ],
            [{ content: "B2", rowSpan: 2 }, "C2", { colSpan: 2, content: "E2", rowSpan: 2 }],
            ["C3"],
            [{ colSpan: 7, content: "A2", hAlign: "center" }],
            [{ colSpan: 9, content: "CLEAR", hAlign: "center" }],
            [
                { content: "BL", rowSpan: 4, vAlign: "middle" },
                { colSpan: 7, content: "A3", hAlign: "center" },
                { content: "BR", rowSpan: 4, vAlign: "middle" },
            ],
            [
                { colSpan: 3, content: "A4", hAlign: "center" },
                { content: "D2", rowSpan: 2, vAlign: "middle" },
                { colSpan: 2, content: "E3", hAlign: "center" },
                { content: "G2", rowSpan: 3, vAlign: "middle" },
            ],
            [
                { content: "A5", rowSpan: 2, vAlign: "middle" },
                { colSpan: 2, content: "B3", hAlign: "center" },
                { content: "E4", rowSpan: 2, vAlign: "middle" },
                { content: "F3", rowSpan: 2, vAlign: "middle" },
            ],
            ["B4", { colSpan: 2, content: "C4", hAlign: "center" }],
            [{ colSpan: 9, content: "BOTTOM", hAlign: "center" }],
        );

        expect(table.toString()).toMatchInlineSnapshot(`
          "┌────────────────────────────────────────────┐
          │                    TOP                     │
          ├────┬────┬────┬────┬────┬────┬────┬────┬────┤
          │    │ A1 │ B1 │ C1 │    │ E1 │ F1 │ G1 │    │
          │    │    ├────┼────┤    ├────┴────┤    │    │
          │    │    │ B2 │ C2 │ D1 │ E2      │    │    │
          │ TL │    │    ├────┤    │         │    │ TR │
          │    │    │    │ C3 │    │         │    │    │
          │    ├────┴────┴────┴────┴─────────┴────┤    │
          │    │                A2                │    │
          ├────┴──────────────────────────────────┴────┤
          │                   CLEAR                    │
          ├────┬──────────────────────────────────┬────┤
          │    │                A3                │    │
          │    ├──────────────┬────┬─────────┬────┤    │
          │    │      A4      │    │   E3    │    │    │
          │ BL ├────┬─────────┤ D2 ├────┬────┤    │ BR │
          │    │    │   B3    │    │    │    │ G2 │    │
          │    │ A5 ├────┬────┴────┤ E4 │ F3 │    │    │
          │    │    │ B4 │   C4    │    │    │    │    │
          ├────┴────┴────┴─────────┴────┴────┴────┴────┤
          │                   BOTTOM                   │
          └────────────────────────────────────────────┘"
        `);
    });
});
