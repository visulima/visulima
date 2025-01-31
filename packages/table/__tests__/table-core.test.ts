import { describe, expect, it } from "vitest";

import { createTable, Table } from "../src";

describe("table core functionality", () => {
    it("should handle empty tables", () => {
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

    it("should handle tables with empty headers", () => {
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

    it("should handle tables with hidden headers", () => {
        expect.assertions(1);

        const table = new Table({ showHeader: false });

        table.setHeaders(["A", "B", "C"]);
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

    describe("maxWidth functionality", () => {
        it("should respect global maxWidth", () => {
            expect.assertions(1);

            const table = new Table({ maxWidth: 5, style: { paddingLeft: 0, paddingRight: 0 } });
            table.addRow(["Short", "This is a very long text", "Another long text"]);

            const output = table.toString();

            expect(output).toMatchInlineSnapshot(`
              "┌─────┬─────┬─────┐
              │Short│This…│Anot…│
              └─────┴─────┴─────┘"
            `);
        });

        it("should allow cell-specific maxWidth to override global maxWidth", () => {
            expect.assertions(1);

            const table = new Table({ maxWidth: 10, style: { paddingLeft: 0, paddingRight: 0 } });
            table.addRow(["Short text", { content: "This is a very long text", maxWidth: 5 }, "Medium length"]);

            const output = table.toString();

            expect(output).toMatchInlineSnapshot(`
              "┌──────────┬─────┬──────────┐
              │Short text│This…│Medium le…│
              └──────────┴─────┴──────────┘"
            `);
        });

        it("should handle maxWidth with word wrapping", () => {
            expect.assertions(1);

            const table = new Table({ maxWidth: 10, style: { paddingLeft: 0, paddingRight: 0 }, wordWrap: true });
            table.addRow(["Short", "This is a very long text that should wrap", "Test"]);

            const output = table.toString();

            expect(output).toMatchInlineSnapshot(`
                "┌─────┬──────────┬────┐
                │Short│This is a │Test│
                │     │very long │    │
                │     │text that │    │
                │     │should    │    │
                │     │wrap      │    │
                └─────┴──────────┴────┘"
            `);
        });

        it("should handle maxWidth with multi-byte characters", () => {
            expect.assertions(1);

            const table = new Table({ maxWidth: 6, style: { paddingLeft: 0, paddingRight: 0 } });
            table.addRow(["Test", "こんにちは", "🌟🌟🌟🌟🌟"]);

            const output = table.toString();

            expect(output).toMatchInlineSnapshot(`
              "┌────┬──────┬──────┐
              │Test│こん… │🌟🌟… │
              └────┴──────┴──────┘"
            `);
        });

        it("should handle maxWidth with ANSI escape codes", () => {
            expect.assertions(1);

            const table = new Table({ maxWidth: 5, style: { paddingLeft: 0, paddingRight: 0 } });
            table.addRow(["Test", "\u001B[31mThis is red text\u001B[0m", "\u001B[32mGreen\u001B[0m"]);

            const output = table.toString();

            expect(output).toMatchInlineSnapshot(`
              "┌────┬─────┬─────┐
              │Test│[31mThis…[0m│[32mGreen[0m│
              └────┴─────┴─────┘"
            `);
        });

        it("should handle maxWidth with mixed content types", () => {
            expect.assertions(1);

            const table = new Table({ maxWidth: 8, style: { paddingLeft: 0, paddingRight: 0 } });
            table.addRow([
                { content: 12345678901, maxWidth: 5 },
                { content: "Mixed 🌟 Text", maxWidth: 6 },
                { content: "\u001B[31mColored\u001B[0m Text", maxWidth: 7 }
            ]);

            const output = table.toString();

            expect(output).toMatchInlineSnapshot(`
              "┌─────┬──────┬───────┐
              │1234…│Mixed…│[31mColore…[0m│
              └─────┴──────┴───────┘"
            `);
        });

        it("should handle maxWidth with empty and whitespace content", () => {
            expect.assertions(1);

            const table = new Table({ maxWidth: 5, style: { paddingLeft: 0, paddingRight: 0 } });
            table.addRow(["", "   ", "\t\n"]);

            const output = table.toString();

            expect(output).toMatchInlineSnapshot(`
                "┌─┬───┬─┐
                │ │   │ │
                └─┴───┴─┘"
            `);
        });

        it("should maintain column alignment with maxWidth", () => {
            expect.assertions(1);

            const table = new Table({ maxWidth: 6, style: { paddingLeft: 0, paddingRight: 0 } });
            table.addRow([
                { content: "Left", hAlign: "left", maxWidth: 6 },
                { content: "Center", hAlign: "center", maxWidth: 6 },
                { content: "Right", hAlign: "right", maxWidth: 6 }
            ]);

            const output = table.toString();

            expect(output).toMatchInlineSnapshot(`
                "┌────┬──────┬─────┐
                │Left│Center│Right│
                └────┴──────┴─────┘"
            `);
        });

        it("should handle maxWidth with headers and word wrapping", () => {
            expect.assertions(1);

            const table = new Table({ maxWidth: 5, style: { paddingLeft: 0, paddingRight: 0 }, wordWrap: true });
            table.setHeaders(["H1", "Header2", "H3"]);
            table.addRow(["Data", "Long Data", "End"]);

            const output = table.toString();

            expect(output).toMatchInlineSnapshot(`
              "┌────┬─────┬───┐
              │H1  │Head…│H3 │
              ├────┼─────┼───┤
              │Data│Long │End│
              │    │Data │   │
              └────┴─────┴───┘"
            `);
        });
    });
});
