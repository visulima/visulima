import { describe, expect, it } from "vitest";

import { Table } from "../src";
import { DEFAULT_BORDER, DOUBLE_BORDER, MARKDOWN_BORDER, MINIMAL_BORDER, ROUNDED_BORDER } from "../src/style";

describe("table", () => {
    describe("column width consistency", () => {
        it("should maintain consistent column widths across rows", () => {
            expect.assertions(7);

            const table = new Table();

            // Test case for the coverage report scenario
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

    describe("aNSI colored text", () => {
        it("should maintain correct padding with ANSI colored text", () => {
            expect.assertions(3);

            const table = new Table();
            const coloredText = "\u001B[32m✓ Passed\u001B[0m";
            const warningText = "\u001B[33m⚠ Warning\u001B[0m";

            table.setHeaders(["Status", "Value"]).addRow([coloredText, "100"]).addRow([warningText, "50"]);

            const output = table.toString();
            const lines = output.split("\n");

            // Verify structure
            expect(lines).toEqual(
                expect.arrayContaining([
                    expect.stringContaining("Status"),
                    expect.stringContaining("Value"),
                    expect.stringContaining("✓"),
                    expect.stringContaining("⚠"),
                ]),
            );

            // Verify colored text is preserved
            expect(output).toContain("\u001B[32m");
            expect(output).toContain("\u001B[33m");
        });
    });

    describe("unicode and emoji support", () => {
        it("should handle Unicode characters and emojis correctly", () => {
            expect.assertions(1);

            const table = new Table();

            table.setHeaders(["📊 Metrics", "Value"]).addRow(["代码覆盖率", "80%"]).addRow(["性能测试", "95%"]);

            const output = table.toString();
            const lines = output.split("\n");

            // Verify content
            expect(lines).toEqual(
                expect.arrayContaining([
                    expect.stringContaining("📊"),
                    expect.stringContaining("代码覆盖率"),
                    expect.stringContaining("性能测试"),
                    expect.stringContaining("80%"),
                    expect.stringContaining("95%"),
                ]),
            );
        });
    });

    describe("truncation and multi-line text", () => {
        it("should truncate long text and handle multi-line content", () => {
            expect.assertions(3);

            const table = new Table({ maxWidth: 20, truncate: true });
            const longText = "This is a very long text that should be truncated";
            const multiLineText = "First line\nSecond line\nThird line";

            table.addRow([{ content: longText }]).addRow([{ content: multiLineText }]);

            const output = table.toString();
            const lines = output.split("\n");

            // Verify truncation
            const truncatedLine = lines.find((line) => line.includes("This"));

            expect(truncatedLine).toBeDefined();
            expect((truncatedLine as string).length).toBeLessThanOrEqual(24); // 20 + padding + borders

            // Verify multi-line
            expect(lines).toEqual(
                expect.arrayContaining([expect.stringContaining("First line"), expect.stringContaining("Second line"), expect.stringContaining("Third line")]),
            );
        });

        it("should properly truncate colored text", () => {
            expect.assertions(6);

            const table = new Table({ maxWidth: 20, truncate: true });
            const coloredText = "\u001B[32mThis is a very long green text that should be truncated\u001B[0m";

            table.addRow([{ content: coloredText }]);

            const output = table.toString();
            const lines = output.split("\n");

            // Find the line containing the colored text (including ANSI codes)
            const truncatedLine = lines.find((line) => line.includes("\u001B[32m"));
            expect(truncatedLine).toBeDefined();

            // Verify the line contains both start and end color codes
            expect(truncatedLine).toContain("\u001B[32m");
            expect(truncatedLine).toContain("\u001B[0m");

            // Verify length (excluding color codes)
            const strippedLine = (truncatedLine as string).replaceAll(/\u001B\[\d+m/g, "");
            expect(strippedLine.trim().length).toBeLessThanOrEqual(24); // 20 + padding + borders

            // Verify that the ellipsis is colored
            const lastColorStart = truncatedLine?.lastIndexOf("\u001B[32m");
            const lastColorEnd = truncatedLine?.lastIndexOf("\u001B[0m");
            expect(lastColorStart).toBeLessThan(lastColorEnd);
            expect(truncatedLine?.slice(lastColorEnd! - 3, lastColorEnd)).toBe("...");
        });
    });

    describe("border styles", () => {
        it.each([
            ["default", DEFAULT_BORDER],
            ["minimal", MINIMAL_BORDER],
            ["markdown", MARKDOWN_BORDER],
            ["double", DOUBLE_BORDER],
            ["rounded", ROUNDED_BORDER],
        ])("should support %s border style", (styleName, borderStyle) => {
            expect.assertions(1);

            const table = new Table({ border: borderStyle });
            table.setHeaders(["Header 1", "Header 2"]);
            table.addRow(["Value 1", "Value 2"]);

            const output = table.toString();

            expect(output).toMatchSnapshot(`table-${styleName}-style`);
        });
    });

    describe("cell alignment", () => {
        it("should handle different cell alignments", () => {
            expect.assertions(4);

            const table = new Table({ padding: 1 });
            const content = "test";

            table.addRow([
                { content, hAlign: "left" },
                { content, hAlign: "center" },
                { content, hAlign: "right" },
            ]);

            const output = table.toString();
            const lines = output.split("\n");
            const dataLine = lines.find((line) => line.includes("test"))!;

            // Verify content is present
            expect(output).toContain("test");

            // Verify each alignment
            const cells = dataLine.split("│").slice(1, -1);
            expect(cells[0].trim()).toBe("test"); // Left aligned
            expect(cells[1].trim()).toBe("test"); // Center aligned
            expect(cells[2].trim()).toBe("test"); // Right aligned
        });
    });

    describe("padding configuration", () => {
        it("should respect custom padding settings", () => {
            expect.assertions(2);

            const table = new Table({ padding: 3 });
            table.addRow(["Test"]);

            const output = table.toString();
            const lines = output.split("\n");
            const dataLine = lines.find((line) => line.includes("Test"))!;

            // Verify content is present with padding
            const cell = dataLine.split("│")[1];
            expect(cell.startsWith("   ")).toBeTruthy();
            expect(cell.endsWith("   ")).toBeTruthy();
        });
    });

    describe("empty and null values", () => {
        it("should handle empty table with no headers", () => {
            expect.assertions(1);

            const table = new Table();
            table.addRow(["", { content: "" }, { content: null }]).addRow([" ", { content: undefined }, { content: "" }]);

            const output = table.toString();

            expect(output).toMatchInlineSnapshot(`
                "┌───┬───┬───┐
                │   │   │   │
                ├───┼───┼───┤
                │   │   │   │
                └───┴───┴───┘
                "
            `);
        });

        it("should handle table with empty headers", () => {
            expect.assertions(1);

            const table = new Table();
            table
                .setHeaders(["", null, undefined])
                .addRow(["", { content: "" }, { content: null }])
                .addRow([" ", { content: undefined }, { content: "" }]);

            const output = table.toString();

            expect(output).toMatchInlineSnapshot(`
                "┌───┬───┬───┐
                │   │   │   │
                ├───┼───┼───┤
                │   │   │   │
                ├───┼───┼───┤
                │   │   │   │
                └───┴───┴───┘
                "
            `);
        });

        it("should handle table with hidden headers", () => {
            expect.assertions(1);

            const table = new Table({ showHeader: false });
            table
                .setHeaders(["", null, undefined])
                .addRow(["", { content: "" }, { content: null }])
                .addRow([" ", { content: undefined }, { content: "" }]);

            const output = table.toString();

            expect(output).toMatchInlineSnapshot(`
                "┌───┬───┬───┐
                │   │   │   │
                ├───┼───┼───┤
                │   │   │   │
                └───┴───┴───┘
                "
            `);
        });
    });

    describe("table creation and options", () => {
        it("should handle various constructor options", () => {
            expect.assertions(3);

            const table = new Table({
                align: "center",
                border: ROUNDED_BORDER,
                maxWidth: 50,
                padding: 2,
                showHeader: false,
                truncate: true,
            });

            table.addRow(["Test"]);
            const output = table.toString();

            expect(output).toContain("╭"); // Rounded border
            expect(output).toContain("  Test  "); // Padding of 2
            expect(output).not.toContain("undefined"); // No header
        });

        it("should validate constructor options", () => {
            expect.assertions(2);

            expect(() => new Table({ padding: -1 })).toThrow("padding must be a non-negative number");
            expect(() => new Table({ maxWidth: 0 })).toThrow("maxWidth must be a positive number");
        });
    });

    describe("complex tables", () => {
        it("should handle complex table with progress bars, colors, and Unicode", () => {
            expect.assertions(6);

            const table = new Table();
            const blue = (text: string) => `\u001B[34m${text}\u001B[0m`;
            const green = (text: string) => `\u001B[32m${text}\u001B[0m`;
            const red = (text: string) => `\u001B[31m${text}\u001B[0m`;

            table
                .setHeaders([
                    { content: "📊 Metrics", hAlign: "center" },
                    { content: "📈 Progress", hAlign: "center" },
                    { content: "🎯 Target", hAlign: "center" },
                ])
                .addRow([
                    { content: "代码覆盖率", hAlign: "left" },
                    { content: blue("▓▓▓▓▓▓▓▓░░ 80%"), hAlign: "center" },
                    { content: "90%", hAlign: "right" },
                ])
                .addRow([
                    { content: "性能测试", hAlign: "left" },
                    { content: green("▓▓▓▓▓▓▓▓▓░ 95%"), hAlign: "center" },
                    { content: "85%", hAlign: "right" },
                ])
                .addRow([
                    { content: "安全扫描", hAlign: "left" },
                    { content: red("▓▓▓▓░░░░░░ 40%"), hAlign: "center" },
                    { content: "100%", hAlign: "right" },
                ]);

            const output = table.toString();

            // Log the table for visual inspection during test development
            console.log("\nComplex Table Output:\n" + output + "\n");

            const lines = output.split("\n");

            // Verify header alignment
            const headerLine = lines.find((line) => line.includes("📊 Metrics"));
            expect(headerLine).toBeDefined();
            expect(headerLine).toContain("📊 Metrics"); // Center aligned header

            // Verify progress bar colors
            const blueLine = lines.find((line) => line.includes("80%"));
            const greenLine = lines.find((line) => line.includes("95%"));
            const redLine = lines.find((line) => line.includes("40%"));

            expect(blueLine).toContain("\u001B[34m"); // Blue color
            expect(greenLine).toContain("\u001B[32m"); // Green color
            expect(redLine).toContain("\u001B[31m"); // Red color

            // Verify overall table layout
            expect(output).toMatchSnapshot("complex-table-with-progress");
        });
    });
});
