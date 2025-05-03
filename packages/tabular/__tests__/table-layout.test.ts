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

            expect(table.toString()).toMatchInlineSnapshot(`
              "┌───────────────┐
              │ Span All      │
              ├───────────┬───┤
              │ Span Two  │ C │
              ├─────┬─────┼───┤
              │ A   │ B   │ C │
              └─────┴─────┴───┘"
            `);
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
              │      │            Top             │
              │ Side ├─────────────┬──────────────┤
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

    describe("alignment options", () => {
        it("should handle horizontal alignment center", () => {
            expect.assertions(1);

            const table = createTable();
            table
                .addRow([{ content: "Centered", hAlign: "center" }, "Normal"])
                .addRow([{ content: "This is a longer centered text", hAlign: "center" }, "Second row"]);

            expect(table.toString()).toMatchInlineSnapshot(`
              "┌────────────────────────────────┬────────────┐
              │            Centered            │ Normal     │
              ├────────────────────────────────┼────────────┤
              │ This is a longer centered text │ Second row │
              └────────────────────────────────┴────────────┘"
            `);
        });

        it("should handle horizontal alignment left", () => {
            expect.assertions(1);

            const table = createTable();
            table
                .addRow([{ content: "Left Aligned", hAlign: "left" }, "Normal"])
                .addRow([{ content: "This is a longer left aligned text", hAlign: "left" }, "Second row"]);

            expect(table.toString()).toMatchInlineSnapshot(`
              "┌────────────────────────────────────┬────────────┐
              │ Left Aligned                       │ Normal     │
              ├────────────────────────────────────┼────────────┤
              │ This is a longer left aligned text │ Second row │
              └────────────────────────────────────┴────────────┘"
            `);
        });

        it("should handle horizontal alignment right", () => {
            expect.assertions(1);

            const table = createTable();
            table
                .addRow([{ content: "Right Aligned", hAlign: "right" }, "Normal"])
                .addRow([{ content: "This is a longer right aligned text", hAlign: "right" }, "Second row"]);

            expect(table.toString()).toMatchInlineSnapshot(`
              "┌─────────────────────────────────────┬────────────┐
              │                       Right Aligned │ Normal     │
              ├─────────────────────────────────────┼────────────┤
              │ This is a longer right aligned text │ Second row │
              └─────────────────────────────────────┴────────────┘"
            `);
        });
    });

    describe("empty and special values", () => {
        it("should handle empty table with no headers", () => {
            expect.assertions(1);

            const table = new Table({ showHeader: false, style: { paddingLeft: 0, paddingRight: 0 } });

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
              "┌──┬──┬──┐
              │  │  │  │
              ├──┼──┼──┤
              │  │  │  │
              ├──┼──┼──┤
              │  │  │  │
              └──┴──┴──┘"
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

    // Simple test for rowSpan with vAlign="middle" to diagnose the issue
    it("should correctly render cells with rowSpan and vAlign middle", () => {
        expect.assertions(1);

        const table = createTable();

        table.addRow([{ content: "A1", rowSpan: 3, vAlign: "middle" }, "B1", "C1"]);
        table.addRow(["B2", "C2"]);
        table.addRow(["B3", "C3"]);

        // This will print row heights during rendering for debugging
        const result = table.toString();

        const expected = [
            "┌────┬────┬────┐",
            "│    │ B1 │ C1 │",
            "│    ├────┼────┤",
            "│ A1 │ B2 │ C2 │",
            "│    ├────┼────┤",
            "│    │ B3 │ C3 │",
            "└────┴────┴────┘",
        ].join("\n");

        expect(result).toBe(expected);
    });

    describe("advanced table construction with spans and alignment", () => {
        describe("column spanning scenarios", () => {
            it("should render a table with colSpan cells above standard cells (top to bottom structure)", () => {
                expect.assertions(1);

                const table = createTable();
                table
                    .addRow([{ colSpan: 2, content: "greetings" }])
                    .addRow([{ colSpan: 2, content: "greetings" }])
                    .addRow(["hello", "howdy"]);

                const expected = [
                    "┌───────────────┐",
                    "│ greetings     │",
                    "├───────────────┤",
                    "│ greetings     │",
                    "├───────┬───────┤",
                    "│ hello │ howdy │",
                    "└───────┴───────┘",
                ].join("\n");

                expect(table.toString()).toBe(expected);
            });

            it("should render a table with colSpan cells below standard cells (bottom to top structure)", () => {
                expect.assertions(1);

                const table = createTable();
                table
                    .addRow(["hello", "howdy"])
                    .addRow([{ colSpan: 2, content: "greetings" }])
                    .addRow([{ colSpan: 2, content: "greetings" }]);

                const expected = [
                    "┌───────┬───────┐",
                    "│ hello │ howdy │",
                    "├───────┴───────┤",
                    "│ greetings     │",
                    "├───────────────┤",
                    "│ greetings     │",
                    "└───────────────┘",
                ].join("\n");

                expect(table.toString()).toBe(expected);
            });
        });

        describe("row spanning scenarios", () => {
            it("should render a table with rowSpan cells positioned on the left side with correct alignment", () => {
                expect.assertions(1);

                const table = createTable();
                table.addRow([{ content: "greetings", rowSpan: 2 }, { content: "greetings", rowSpan: 2, vAlign: "middle" }, "hello"]).addRow(["howdy"]);

                const expected = [
                    "┌───────────┬───────────┬───────┐",
                    "│ greetings │           │ hello │",
                    "│           │ greetings ├───────┤",
                    "│           │           │ howdy │",
                    "└───────────┴───────────┴───────┘",
                ].join("\n");

                expect(table.toString()).toBe(expected);
            });

            it("should render a table with rowSpan cells positioned on the right side with bottom alignment", () => {
                expect.assertions(1);

                const table = createTable();
                table.addRow(["hello", { content: "greetings", rowSpan: 2 }, { content: "greetings", rowSpan: 2, vAlign: "bottom" }]).addRow(["howdy"]);

                const expected = [
                    "┌───────┬───────────┬───────────┐",
                    "│ hello │ greetings │           │",
                    "├───────┤           │           │",
                    "│ howdy │           │ greetings │",
                    "└───────┴───────────┴───────────┘",
                ].join("\n");

                expect(table.toString()).toBe(expected);
            });
        });

        describe("complex mixed span layouts", () => {
            it("should render a complex table mixing both rowSpan and colSpan for sophisticated layouts", () => {
                expect.assertions(1);

                const table = createTable();
                table
                    .addRow([
                        { colSpan: 2, content: "hello" },
                        { colSpan: 2, content: "sup", rowSpan: 2 },
                        { content: "hi", rowSpan: 3 },
                    ])
                    .addRow([{ colSpan: 2, content: "howdy" }])
                    .addRow(["o", "k", "", ""]);

                const expected = [
                    "┌───────┬─────┬────┐",
                    "│ hello │ sup │ hi │",
                    "├───────┤     │    │",
                    "│ howdy │     │    │",
                    "├───┬───┼──┬──┤    │",
                    "│ o │ k │  │  │    │",
                    "└───┴───┴──┴──┴────┘",
                ].join("\n");

                expect(table.toString()).toBe(expected);
            });

            it("should correctly flow multi-line content across rows when contained in rowSpan cells", () => {
                expect.assertions(1);

                const table = createTable();
                table.addRow(["hello", { content: "greetings\nfriends", rowSpan: 2 }, { content: "greetings\nfriends", rowSpan: 2 }]).addRow(["howdy"]);

                const expected = [
                    "┌───────┬───────────┬───────────┐",
                    "│ hello │ greetings │ greetings │",
                    "├───────┤ friends   │ friends   │",
                    "│ howdy │           │           │",
                    "└───────┴───────────┴───────────┘",
                ].join("\n");

                expect(table.toString()).toBe(expected);
            });

            it("should properly display multi-line content in complex tables with mixed spans", () => {
                expect.assertions(1);

                const table = createTable();
                table
                    .addRow([
                        { colSpan: 2, content: "hello" },
                        { colSpan: 2, content: "sup\nman\nhey", rowSpan: 2 },
                        { content: "hi\nyo", rowSpan: 3 },
                    ])
                    .addRow([{ colSpan: 2, content: "howdy" }])
                    .addRow(["o", "k", "", ""]);

                const expected = [
                    "┌───────┬─────┬────┐",
                    "│ hello │ sup │ hi │",
                    "├───────┤ man │ yo │",
                    "│ howdy │ hey │    │",
                    "├───┬───┼──┬──┤    │",
                    "│ o │ k │  │  │    │",
                    "└───┴───┴──┴──┴────┘",
                ].join("\n");

                expect(table.toString()).toBe(expected);
            });

            it("should correctly render staggered rowSpan cells that overlap in non-uniform patterns", () => {
                expect.assertions(1);

                const table = createTable();
                table
                    .addRow([{ content: "a", rowSpan: 2 }, "b"])
                    .addRow([{ content: "c", rowSpan: 2 }])
                    .addRow(["d"]);

                const expected = ["┌───┬───┐", "│ a │ b │", "│   ├───┤", "│   │ c │", "├───┤   │", "│ d │   │", "└───┴───┘"].join("\n");

                expect(table.toString()).toBe(expected);
            });
        });

        describe("content handling in spanned cells", () => {
            it("should automatically generate and position empty cells to fill gaps in complex table structures", () => {
                expect.assertions(1);

                const table = createTable();
                table
                    .addRow([{ content: "a", rowSpan: 3 }, "b", { content: "", rowSpan: 2 }])
                    .addRow([])
                    .addRow([{ colSpan: 2, content: "c", rowSpan: 2 }])
                    .addRow([""]);

                expect(table.toString()).toMatchInlineSnapshot(`
                  "┌───┬───┬──┐
                  │ a │ b │  │
                  │   ├───┤  │
                  │   │   │  │
                  │   ├───┴──┤
                  │   │ c    │
                  ├───┤      │
                  │   │      │
                  └───┴──────┘"
                `);
            });
        });

        describe("row height behavior", () => {
            it("should respect rowHeights option and display truncation symbol for overflowing content", () => {
                expect.assertions(1);

                const table = createTable({ rowHeights: [2] });
                table.addRow(["hello\nhi\nsup"]);

                expect(table.toString()).toMatchInlineSnapshot(`
                  "┌───────┐
                  │ hello │
                  │ hi    │
                  └───────┘"
                `);
            });

            it("should handle rowHeights as a single number for all rows", () => {
                expect.assertions(1);

                const table = createTable({ rowHeights: 1 });
                table.addRow(["first\nsecond"]).addRow(["another\nmultiline\ntext"]);

                expect(table.toString()).toMatchInlineSnapshot(`
                  "┌───────────┐
                  │ first     │
                  ├───────────┤
                  │ another   │
                  └───────────┘"
                `);
            });

            it("should handle rowHeights as an array with different heights per row", () => {
                expect.assertions(1);

                const table = createTable({ rowHeights: [1, 2] });
                table.addRow(["first\nsecond"]).addRow(["another\nmultiline\ntext"]);

                expect(table.toString()).toMatchInlineSnapshot(`
                  "┌───────────┐
                  │ first     │
                  ├───────────┤
                  │ another   │
                  │ multiline │
                  └───────────┘"
                `);
            });

            it("should properly handle rowHeights with rowSpan cells", () => {
                expect.assertions(1);

                const table = createTable({ rowHeights: [2, 1] });
                table.addRow([{ content: "spanning\ncell\nwith\nmore\nlines", rowSpan: 2 }, "regular"]).addRow(["second"]);

                expect(table.toString()).toMatchInlineSnapshot(`
                  "┌──────────┬─────────┐
                  │ spanning │ regular │
                  │ cell     │         │
                  │ with     ├─────────┤
                  │ more     │ second  │
                  └──────────┴─────────┘"
                `);
            });

            it("should handle columnWidths as a single number for all columns", () => {
                expect.assertions(1);

                const table = createTable({ columnWidths: 6 });
                table.addRow(["Column 1", "Column 2", "Column 3"]);

                const expected = ["┌──────┬──────┬──────┐", "│ Col… │ Col… │ Col… │", "└──────┴──────┴──────┘"].join("\n");

                expect(table.toString()).toBe(expected);
            });

            it("should handle columnWidths as an array with different widths per column", () => {
                expect.assertions(1);

                const table = createTable({ columnWidths: [6, 10, 6] });
                table.addRow(["Col1", "Column 2", "Col 3"]);

                expect(table.toString()).toMatchInlineSnapshot(`
                  "┌──────┬──────────┬──────┐
                  │ Col1 │ Column 2 │ Col… │
                  └──────┴──────────┴──────┘"
                `);
            });

            it("should respect columnWidths option and truncate content that exceeds the width", () => {
                expect.assertions(1);

                const table = createTable({ columnWidths: [5] });
                table.addRow(["This is a very long text that should be truncated"]);

                const expected = ["┌─────┐", "│ Th… │", "└─────┘"].join("\n");

                expect(table.toString()).toBe(expected);
            });

            it("should handle columnWidths with spanning cells correctly", () => {
                expect.assertions(1);

                const table = createTable({ columnWidths: 5 });
                table.addRow([{ colSpan: 2, content: "This is a wide cell spanning two columns" }]);

                expect(table.toString()).toMatchInlineSnapshot(`
                  "┌───────────┐
                  │ This is … │
                  └───────────┘"
                `);
            });

            it("should work correctly when both rowHeights and columnWidths are specified", () => {
                expect.assertions(1);

                const table = createTable({ columnWidths: 10, rowHeights: 1 });
                table.addRow(["This is a\nmultiline\ntext with\nvery long content"]);

                const expected = ["┌──────────┐", "│ This is… │", "└──────────┘"].join("\n");

                expect(table.toString()).toBe(expected);
            });

            it("should dynamically adjust column widths to accommodate content length when width not specified", () => {
                expect.assertions(1);

                const table = createTable();
                table.addRow([{ colSpan: 2, content: "hello there" }]).addRow(["hi", "hi"]);

                expect(table.toString()).toMatchInlineSnapshot(`
                  "┌─────────────┐
                  │ hello there │
                  ├──────┬──────┤
                  │ hi   │ hi   │
                  └──────┴──────┘"
                `);
            });
        });
    });

    describe("maxWidth and width constraints", () => {
        it("should return columns of width 1 when fixed border/gap width exceeds maxWidth", () => {
            expect.assertions(1);
            const table = createTable({
                gap: 1, // Gap adds width
                maxWidth: 5, // Max width less than potential border+gap
                style: {
                    // Use a border style that adds width
                    border: {
                        bodyJoin: { char: "|", width: 1 },
                        bodyLeft: { char: "|", width: 1 },
                        bodyRight: { char: "|", width: 1 },
                        bottomBody: { char: "-", width: 1 },
                        bottomJoin: { char: "+", width: 1 },
                        bottomLeft: { char: "+", width: 1 },
                        bottomRight: { char: "+", width: 1 },
                        joinBody: { char: "-", width: 1 },
                        joinJoin: { char: "+", width: 1 },
                        joinLeft: { char: "+", width: 1 },
                        joinRight: { char: "+", width: 1 },
                        topBody: { char: "-", width: 1 },
                        topJoin: { char: "+", width: 1 },
                        topLeft: { char: "+", width: 1 },
                        topRight: { char: "+", width: 1 },
                    },
                    paddingLeft: 0,
                    paddingRight: 0,
                },
            });
            table.addRow(["a", "b"]); // 2 columns

            expect(table.toString()).toMatchInlineSnapshot(`
              "+--+--+
              |a | b|
              +--+--+"
            `);
        });
    });
});
