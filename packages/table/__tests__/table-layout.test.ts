import { describe, expect, it } from "vitest";

import { createTable, Table } from "../src";

describe("table layout", () => {
    describe("basic layouts", () => {
        it("should create single-cell table", () => {
            expect.assertions(1);

            const table = createTable();
            table.addRow(["Single"]);

            const expected = ["┌────────┐", "│ Single │", "└────────┘"].join("\n");

            expect(table.toString()).toBe(expected);
        });

        it("should create simple grid layout", () => {
            expect.assertions(1);

            const table = createTable();
            table.addRows(["A1", "B1", "C1"], ["A2", "B2", "C2"], ["A3", "B3", "C3"]);

            const expected = [
                "┌────┬────┬────┐",
                "│ A1 │ B1 │ C1 │",
                "├────┼────┼────┤",
                "│ A2 │ B2 │ C2 │",
                "├────┼────┼────┤",
                "│ A3 │ B3 │ C3 │",
                "└────┴────┴────┘",
            ].join("\n");

            expect(table.toString()).toBe(expected);
        });
    });

    describe("column spans", () => {
        it("should handle single column span", () => {
            expect.assertions(1);

            const table = createTable();
            table.addRow([{ colSpan: 2, content: "Spanning Two Columns" }, "Normal"]).addRow(["A", "B", "C"]);

            expect(table.toString()).toMatchInlineSnapshot(`
              "┌───────────────────────┬────────┐
              │ Spanning Two Columns  │ Normal │
              ├───────────┬───────────┼────────┤
              │ A         │ B         │ C      │
              └───────────┴───────────┴────────┘"
            `);
        });

        it("should handle multiple column spans", () => {
            expect.assertions(1);

            const table = createTable();
            table
                .addRow([{ colSpan: 3, content: "Span All" }])
                .addRow([{ colSpan: 2, content: "Span Two" }, "C"])
                .addRow(["A", "B", "C"]);

            const expected = [
                "┌─────────────────┐",
                "│ Span All        │",
                "├─────────────┬───┤",
                "│ Span Two    │ C │",
                "├───────┬─────┼───┤",
                "│ A     │ B   │ C │",
                "└───────┴─────┴───┘",
            ].join("\n");

            expect(table.toString()).toBe(expected);
        });
    });

    describe("row spans", () => {
        it("should handle single row span", () => {
            expect.assertions(1);

            const table = createTable();
            table.addRow([{ content: "Span", rowSpan: 2 }, "B1", "C1"]).addRow([null, "B2", "C2"]);

            const expected = ["┌──────┬────┬────┐", "│ Span │ B1 │ C1 │", "│      ├────┼────┤", "│      │ B2 │ C2 │", "└──────┴────┴────┘"].join("\n");

            expect(table.toString()).toBe(expected);
        });

        it("should handle multiple row spans", () => {
            expect.assertions(1);

            const table = createTable();
            table
                .addRow([{ content: "Span 3", rowSpan: 3 }, "B1", { content: "Span 2", rowSpan: 2 }])
                .addRow([null, "B2", null])
                .addRow([null, "B3", "C3"]);

            const expected = [
                "┌────────┬────┬────────┐",
                "│ Span 3 │ B1 │ Span 2 │",
                "│        ├────┤        │",
                "│        │ B2 │        │",
                "│        ├────┼────────┤",
                "│        │ B3 │ C3     │",
                "└────────┴────┴────────┘",
            ].join("\n");

            expect(table.toString()).toBe(expected);
        });
    });

    describe("complex layouts", () => {
        it("should handle mixed row and column spans", () => {
            expect.assertions(1);

            const table = createTable();
            table
                .addRow([{ colSpan: 3, content: "Header", hAlign: "center" }])
                .addRow([
                    { content: "Side", rowSpan: 2, vAlign: "middle" },
                    { colSpan: 2, content: "Top", hAlign: "center" },
                ])
                .addRow([null, "Bottom Left", "Bottom Right"]);

            expect(table.toString()).toMatchInlineSnapshot(`
              "┌───────────────────────────────────┐
              │              Header               │
              ├──────┬────────────────────────────┤
              │ Side │            Top             │
              │      ├─────────────┬──────────────┤
              │      │ Bottom Left │ Bottom Right │
              └──────┴─────────────┴──────────────┘"
            `);
        });

        it("should support complex nested spans", () => {
            expect.assertions(1);

            const table = createTable();

            table.addRow([{ colSpan: 9, content: "TOP", hAlign: "center" }]);
            table.addRow([
                { content: "TL", rowSpan: 4, vAlign: "middle" },
                { content: "A1", rowSpan: 3 },
                "B1",
                "C1",
                { content: "D1", rowSpan: 3, vAlign: "middle" },
                "E1",
                "F1",
                { content: "G1", rowSpan: 3 },
                { content: "TR", rowSpan: 4, vAlign: "middle" },
            ]);
            table.addRow([{ content: "B2", rowSpan: 2 }, "C2", { colSpan: 2, content: "E2", rowSpan: 2 }]);
            table.addRow(["C3"]);
            table.addRow([{ colSpan: 7, content: "A2", hAlign: "center" }]);
            table.addRow([{ colSpan: 9, content: "CLEAR", hAlign: "center" }]);
            table.addRow([
                { content: "BL", rowSpan: 4, vAlign: "middle" },
                { colSpan: 7, content: "A3", hAlign: "center" },
                { content: "BR", rowSpan: 4, vAlign: "middle" },
            ]);
            table.addRow([
                { colSpan: 3, content: "A4", hAlign: "center" },
                { content: "D2", rowSpan: 2, vAlign: "middle" },
                { colSpan: 2, content: "E3", hAlign: "center" },
                { content: "G2", rowSpan: 3, vAlign: "middle" },
            ]);
            table.addRow([
                { content: "A5", rowSpan: 2, vAlign: "middle" },
                { colSpan: 2, content: "B3", hAlign: "center" },
                { content: "E4", rowSpan: 2, vAlign: "middle" },
                { content: "F3", rowSpan: 2, vAlign: "middle" },
            ]);
            table.addRow(["B4", { colSpan: 2, content: "C4", hAlign: "center" }]);
            table.addRow([{ colSpan: 9, content: "BOTTOM", hAlign: "center" }]);

            const expected = [
                "┌────────────────────────────────────────────┐",
                "│                    TOP                     │",
                "├────┬────┬────┬────┬────┬────┬────┬────┬────┤",
                "│    │ A1 │ B1 │ C1 │    │ E1 │ F1 │ G1 │    │",
                "│    │    ├────┼────┤    ├────┴────┤    │    │",
                "│    │    │ B2 │ C2 │ D1 │ E2      │    │    │",
                "│ TL │    │    ├────┤    │         │    │ TR │",
                "│    │    │    │ C3 │    │         │    │    │",
                "│    ├────┴────┴────┴────┴─────────┴────┤    │",
                "│    │                A2                │    │",
                "├────┴──────────────────────────────────┴────┤",
                "│                   CLEAR                    │",
                "├────┬──────────────────────────────────┬────┤",
                "│    │                A3                │    │",
                "│    ├──────────────┬────┬─────────┬────┤    │",
                "│    │      A4      │    │   E3    │    │    │",
                "│ BL ├────┬─────────┤ D2 ├────┬────┤    │ BR │",
                "│    │    │   B3    │    │    │    │ G2 │    │",
                "│    │ A5 ├────┬────┴────┤ E4 │ F3 │    │    │",
                "│    │    │ B4 │   C4    │    │    │    │    │",
                "├────┴────┴────┴─────────┴────┴────┴────┴────┤",
                "│                   BOTTOM                   │",
                "└────────────────────────────────────────────┘",
            ].join("\n");

            expect(table.toString()).toBe(expected);
        });
    });

    describe("empty and special values", () => {
        it("should handle empty table with no headers", () => {
            expect.assertions(1);

            const table = new Table({ showHeader: false });

            table.addRow(["", "", ""]);
            table.addRow(["", "", ""]);

            const output = table.toString();

            expect(output).toMatchInlineSnapshot(`
              "┌┬┬┐
              ││││
              ├┼┼┤
              ││││
              └┴┴┘"
            `);
        });

        it("should handle table with empty headers", () => {
            expect.assertions(1);

            const table = new Table();

            table.setHeaders(["", "", ""]);
            table.addRow(["", "", ""]);
            table.addRow(["", "", ""]);

            const output = table.toString();

            expect(output).toMatchInlineSnapshot(`
              "┌┬┬┐
              ││││
              ├┼┼┤
              ││││
              ├┼┼┤
              ││││
              └┴┴┘"
            `);
        });

        it("should handle null values in spans", () => {
            expect.assertions(1);

            const table = createTable();
            table
                .addRow([{ content: "Span", rowSpan: 2 }, "B1"])
                .addRow([null, "B2"]) // null for rowSpan
                .addRow([{ colSpan: 2, content: "Regular" }]); // Regular cell after span

            const expected = ["┌──────┬────┐", "│ Span │ B1 │", "│      ├────┤", "│      │ B2 │", "├──────┴────┤", "│ Regular   │", "└───────────┘"].join("\n");

            expect(table.toString()).toBe(expected);
        });
    });
});
