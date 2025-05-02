import { getStringWidth } from "@visulima/string"; // Import directly
import { describe, expect, it } from "vitest";

import { createTable, Table } from "../src";

describe("table core functionality", () => {
    it("should handle empty tables", () => {
        expect.assertions(1);

        const table = new Table({ showHeader: false, style: { paddingLeft: 0, paddingRight: 0 } });

        table.addRow(["", "", ""]);
        table.addRow(["", "", ""]);

        expect(table.toString()).toMatchInlineSnapshot(`
          "┌┬┬┐
          ││││
          ├┼┼┤
          ││││
          └┴┴┘"
        `);
    });

    it("should handle tables with empty headers", () => {
        expect.assertions(1);

        const table = new Table({ style: { paddingLeft: 0, paddingRight: 0 } });

        table.setHeaders(["", "", ""]);
        table.addRow(["", "", ""]);
        table.addRow(["", "", ""]);

        expect(table.toString()).toMatchInlineSnapshot(`
          "┌┬┬┐
          ││││
          ├┼┼┤
          ││││
          ├┼┼┤
          ││││
          └┴┴┘"
        `);
    });

    it("should handle tables with hidden headers", () => {
        expect.assertions(1);

        const table = new Table({ showHeader: false, style: { paddingLeft: 0, paddingRight: 0 } });

        table.setHeaders(["A", "B", "C"]);
        table.addRow(["", "", ""]);
        table.addRow(["", "", ""]);

        expect(table.toString()).toMatchInlineSnapshot(`
          "┌┬┬┐
          ││││
          ├┼┼┤
          ││││
          └┴┴┘"
        `);
    });

    describe("content type handling", () => {
        it("should allow numbers as content in object notation", () => {
            const table = createTable({
                style: {
                    paddingLeft: 1,
                    paddingRight: 1,
                },
            });

            table.addRow([{ content: 12 }]);

            const expected = ["┌────┐", "│ 12 │", "└────┘"].join("\n");

            expect(table.toString()).toBe(expected);
        });

        it("should throw if content is not a string or number", () => {
            const table = createTable();

            expect(() => {
                table.addRow([{ content: { a: "b" } }]);
                table.toString();
            }).toThrow();
        });
    });

    describe("column width consistency", () => {
        it("should maintain consistent column widths across rows", () => {
            expect.assertions(7);

            const table = new Table();

            table
                .setHeaders([
                    { content: "Component", hAlign: "center" },
                    { colSpan: 2, content: "Tests", hAlign: "center" },
                    { content: "Coverage", hAlign: "center" },
                ])
                .addRow([
                    { content: "Frontend", hAlign: "center", rowSpan: 2 },
                    { content: "Unit", hAlign: "left" },
                    { content: "156/156", hAlign: "right" },
                    { content: "100%", hAlign: "right" },
                ])
                .addRow([
                    null, // rowSpan from above
                    { content: "Integration", hAlign: "left" },
                    { content: "23/25", hAlign: "right" },
                    { content: "92%", hAlign: "right" },
                ]);

            const output = table.toString();
            const lines = output.split("\n");

            // Find the header line and data lines
            const headerLine = lines.find((line) => line.includes("Tests"))!;
            const unitLine = lines.find((line) => line.includes("Unit"))!;
            const integrationLine = lines.find((line) => line.includes("Integration"))!;

            // Extract cells from each line
            const unitCells = unitLine.split("│").map((cell) => cell.replaceAll(/\u001B\[\d+m/g, ""));
            const integrationCells = integrationLine.split("│").map((cell) => cell.replaceAll(/\u001B\[\d+m/g, ""));

            // Verify Unit and Integration cells have same width
            expect(unitCells[2].trim()).toBe("Unit");
            expect(integrationCells[2].trim()).toBe("Integration");
            expect(unitCells[2]).toHaveLength(integrationCells[2].length);

            // Verify coverage cells
            expect(unitCells[4].trim()).toBe("100%");
            expect(integrationCells[4].trim()).toBe("92%");

            // Additional verification for the entire table structure
            expect(lines).toEqual(
                expect.arrayContaining([
                    expect.stringContaining("┌───────────┬"),
                    expect.stringContaining("Component"),
                    expect.stringContaining("Tests"),
                    expect.stringContaining("Coverage"),
                    expect.stringContaining("Frontend"),
                    expect.stringContaining("Unit"),
                    expect.stringContaining("Integration"),
                    expect.stringContaining("└───────────┴"),
                ]),
            );

            // Verify the complete header structure
            const headerPattern = /^│\s*Component\s*│\s*Tests\s*│\s*Coverage\s*│/;
            expect(headerLine).toMatch(headerPattern);
        });

        it("should handle column spans while maintaining width consistency", () => {
            expect.assertions(1);

            const table = new Table();

            table
                .addRow([
                    { content: "Short", hAlign: "left" },
                    { colSpan: 2, content: "Very Long Content", hAlign: "center" },
                ])
                .addRow([
                    { content: "Test", hAlign: "left" },
                    { content: "Col1", hAlign: "left" },
                    { content: "Col2", hAlign: "left" },
                ]);

            const output = table.toString();
            const lines = output.split("\n");

            // Verify the table contains the expected content
            expect(lines).toEqual(
                expect.arrayContaining([
                    expect.stringContaining("Short"),
                    expect.stringContaining("Very Long Content"),
                    expect.stringContaining("Test"),
                    expect.stringContaining("Col1"),
                    expect.stringContaining("Col2"),
                ]),
            );
        });
    });

    describe("columnWidths functionality", () => {
        it("should respect global columnWidths", () => {
            expect.assertions(1);

            const table = new Table({ columnWidths: 5, style: { paddingLeft: 0, paddingRight: 0 } });
            table.addRow(["Short", "This is a very long text", "Another long text"]);

            expect(table.toString()).toMatchInlineSnapshot(`
              "┌─────┬─────┬─────┐
              │Short│This…│Anot…│
              └─────┴─────┴─────┘"
            `);
        });

        it("should allow cell-specific columnWidths to override global columnWidths", () => {
            expect.assertions(1);

            const table = new Table({ columnWidths: [10, 5, 10], style: { paddingLeft: 0, paddingRight: 0 } });
            table.addRow(["Short text", { content: "This is a very long text" }, "Medium length"]);

            expect(table.toString()).toMatchInlineSnapshot(`
              "┌──────────┬─────┬──────────┐
              │Short text│This…│Medium le…│
              └──────────┴─────┴──────────┘"
            `);
        });

        it("should handle columnWidths on cell with word wrapping", () => {
            expect.assertions(1);

            const table = new Table({ columnWidths: [5, 10, 5], style: { paddingLeft: 0, paddingRight: 0 }, wordWrap: true });
            table.addRow(["Short", { content: "This is a very long text that should wrap" }, "Test"]);

            expect(table.toString()).toMatchInlineSnapshot(`
              "┌─────┬──────────┬─────┐
              │Short│This is a │Test │
              │     │very long │     │
              │     │text that │     │
              │     │should    │     │
              │     │wrap      │     │
              └─────┴──────────┴─────┘"
            `);
        });

        it("should handle columnWidths on cell with multi-byte characters", () => {
            expect.assertions(1);

            const table = new Table({ columnWidths: 7, style: { paddingLeft: 0, paddingRight: 0 } });
            table.addRow(["Test", { content: "こんにちは" }, { content: "🌟🌟🌟🌟🌟" }]);

            expect(table.toString()).toMatchInlineSnapshot(`
              "┌───────┬───────┬───────┐
              │Test   │こんに…│🌟🌟🌟…│
              └───────┴───────┴───────┘"
            `);
        });

        it("should handle columnWidths on cell with ANSI escape codes", () => {
            expect.assertions(1);

            const table = new Table({ columnWidths: 5, style: { paddingLeft: 0, paddingRight: 0 } });
            table.addRow([{ content: "Test" }, { content: "\u001B[31mThis is red text\u001B[0m" }, { content: "\u001B[32mGreen\u001B[0m" }]);

            expect(table.toString()).toMatchInlineSnapshot(`
              "┌─────┬─────┬─────┐
              │Test │[31mThis[0m…│[32mGreen[0m│
              └─────┴─────┴─────┘"
            `);
        });

        it("should handle columnWidths on cell with mixed content types", () => {
            expect.assertions(1);

            const table = new Table({ columnWidths: [5, 6, 7], style: { paddingLeft: 0, paddingRight: 0 } });
            table.addRow([{ content: 12_345_678_901 }, { content: "Mixed 🌟 Text" }, { content: "\u001B[31mColored\u001B[0m Text" }]);

            expect(table.toString()).toMatchInlineSnapshot(`
              "┌─────┬──────┬───────┐
              │1234…│Mixed…│[31mColore[0m…│
              └─────┴──────┴───────┘"
            `);
        });

        it("should handle columnWidths on cell with empty and whitespace content", () => {
            expect.assertions(1);

            const table = new Table({ columnWidths: 5, style: { paddingLeft: 0, paddingRight: 0 } });
            table.addRow(["", { content: "   " }, { content: "\t" }]);

            expect(table.toString()).toMatchInlineSnapshot(`
              "┌─────┬─────┬─────┐
              │     │     │	…│
              └─────┴─────┴─────┘"
            `);
        });

        it("should handle columnWidths on cell with empty and whitespace content and new line", () => {
            expect.assertions(1);

            const table = new Table({ columnWidths: 5, style: { paddingLeft: 0, paddingRight: 0 } });
            table.addRow(["", { content: "   " }, { content: "\t\n" }]);

            expect(table.toString()).toMatchInlineSnapshot(`
              "┌─────┬─────┬─────┐
              │     │     │	…│
              │     │     │     │
              └─────┴─────┴─────┘"
            `);
        });

        it("should handle columnWidths on cell with headers and word wrapping", () => {
            expect.assertions(1);

            const table = new Table({ columnWidths: 5, style: { paddingLeft: 0, paddingRight: 0 }, wordWrap: true });
            table.setHeaders(["H1", "Header2", "H3"]);
            table.addRow(["Data", "Long Data", "End"]);

            expect(table.toString()).toMatchInlineSnapshot(`
              "┌─────┬─────┬─────┐
              │H1   │Head…│H3   │
              ├─────┼─────┼─────┤
              │Data │Long │End  │
              │     │Data │     │
              └─────┴─────┴─────┘"
            `);
        });
    });

    describe("maxWidth", () => {
        it("should maintain column alignment with maxWidth", () => {
            expect.assertions(1);

            const table = new Table({ style: { paddingLeft: 0, paddingRight: 0 } });
            table.addRow([
                { content: "Left", hAlign: "left", maxWidth: 6 },
                { content: "Center", hAlign: "center", maxWidth: 6 },
                { content: "Right", hAlign: "right", maxWidth: 6 },
            ]);

            expect(table.toString()).toMatchInlineSnapshot(`
                "┌────┬──────┬─────┐
                │Left│Center│Right│
                └────┴──────┴─────┘"
            `);
        });
    });

    it("should automatically apply colSpan to single-cell headers", () => {
        // Test case inspired by emojiTable in examples/test.js
        const table = createTable();

        table.setHeaders(["Single Header"]); // Header has fewer columns than body
        table.addRow(["Body Cell 1", "Body Cell 2"]);
        table.addRow(["Another 1", "Another 2"]);

        // Expect the header "Single Header" to span both columns
        expect(table.toString()).toMatchInlineSnapshot(`
          "┌───────────────────────────┐
          │ Single Header             │
          ├─────────────┬─────────────┤
          │ Body Cell 1 │ Body Cell 2 │
          ├─────────────┼─────────────┤
          │ Another 1   │ Another 2   │
          └─────────────┴─────────────┘"
        `);
    });
});
