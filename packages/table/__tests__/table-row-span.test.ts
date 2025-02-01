import { describe, expect, it } from "vitest";
import { createTable } from "../src";

describe("Table Row Span Tests", () => {
    it("should correctly render a table with row spans", () => {
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
            "└────────┴────┴────────┘"
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
            "└────┴────┴────┘"
        ].join("\n");

        expect(output).toBe(expectedOutput);
    });

    it("should handle row spans with varying column widths", () => {
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
            "└───────────┴───────┘"
        ].join("\n");

        expect(output).toBe(expectedOutput);
    });

    it("should handle row spans that reach the bottom of the table", () => {
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
            "└────┴────────────────┘"
        ].join("\n");

        expect(output).toBe(expectedOutput);
    });
});
