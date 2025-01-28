import { Table } from "../src";
import { describe, it, expect } from "vitest";

describe("Table", () => {
    describe("column width consistency", () => {
        it("should maintain consistent column widths across rows", () => {
            const table = new Table();

            // Test case for the coverage report scenario
            table
                .setHeaders([
                    { content: "Component", hAlign: "center" },
                    { content: "Tests", hAlign: "center", colSpan: 2 },
                    { content: "Coverage", hAlign: "center" },
                ])
                .addRow([
                    { content: "Frontend", rowSpan: 2, hAlign: "center" },
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
            console.log(output)
            const lines = output.split("\n");

            // Find the header line and data lines
            const headerLine = lines.find((line) => line.includes("Tests"))!;
            const unitLine = lines.find((line) => line.includes("Unit"))!;
            const integrationLine = lines.find((line) => line.includes("Integration"))!;

            // Extract cells from each line
            const unitCells = unitLine.split("│").map((cell) => cell.replace(/\u001b\[\d+m/g, ""));
            const integrationCells = integrationLine.split("│").map((cell) => cell.replace(/\u001b\[\d+m/g, ""));

            // Verify Unit and Integration cells have same width
            expect(unitCells[2]).toBe(" Unit        ");
            expect(integrationCells[2].trim()).toBe("Integration");
            expect(unitCells[2].length).toBe(integrationCells[2].length);

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
            const table = new Table();

            table
                .addRow([
                    { content: "Short", hAlign: "left" },
                    { content: "Very Long Content", colSpan: 2, hAlign: "center" },
                ])
                .addRow([
                    { content: "Test", hAlign: "left" },
                    { content: "Col1", hAlign: "left" },
                    { content: "Col2", hAlign: "left" },
                ]);

            const output = table.toString();
            const lines = output.split("\n");

            // Get the second row (index 2 after the border)
            const secondRow = lines.find((line) => line.includes("Col1"))!;
            const cells = secondRow.split("│").map((cell) => cell.trim());

            // Both Col1 and Col2 should have the same width
            expect(cells[1].length).toBe(cells[2].length);

            // Verify the exact content with padding
            const expectedWidth = Math.ceil("Very Long Content".length / 2); // Width per column
            const padding = " ".repeat(expectedWidth - "Col1".length);

            expect(cells[2]).toBe(`Col1${padding}`);
            expect(cells[3]).toBe(`Col2${padding}`);
        });
    });
});
