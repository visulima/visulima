import { describe, expect, it } from "vitest";

import type { GridItem, TableCell } from "../../../src/types";
import calculateCellTotalWidth from "../../../src/utils/calculate-cell-total-width";
import calculateRowHeights from "../../../src/utils/calculate-row-heights";
import computeRowLogicalWidth from "../../../src/utils/compute-row-logical-width";

describe("grid Sizing Calculations", () => {
    describe(calculateCellTotalWidth, () => {
        it("returns width for a single column span", () => {
            expect.assertions(1);
            // Should return the width of the column at index 1
            expect(calculateCellTotalWidth([5, 6, 7], 1, 1)).toBe(6);
        });

        it("returns sum of widths for multiple columns spanned", () => {
            expect.assertions(4);
            expect(calculateCellTotalWidth([5, 6, 7], 0, 3)).toBe(20);
            expect(calculateCellTotalWidth([5, 6], 0, 2)).toBe(12);
            expect(calculateCellTotalWidth([5], 0, 1)).toBe(5);
            expect(calculateCellTotalWidth([3, 4, 5, 6], 1, 2)).toBe(10);
        });

        it("handles colSpan extending beyond available columns (should sum available ones)", () => {
            expect.assertions(2);
            expect(calculateCellTotalWidth([5, 6], 0, 3)).toBe(13);
            expect(calculateCellTotalWidth([5, 6], 1, 2)).toBe(7);
        });

        it("handles zero width columns", () => {
            expect.assertions(3);
            expect(calculateCellTotalWidth([0, 0], 0, 1)).toBe(0);
            expect(calculateCellTotalWidth([0, 0], 0, 2)).toBe(1);
            expect(calculateCellTotalWidth([5, 0, 7], 0, 3)).toBe(14);
        });

        it("handles empty columnWidths array", () => {
            expect.assertions(2);
            expect(calculateCellTotalWidth([], 0, 1)).toBe(0);
            expect(calculateCellTotalWidth([], 0, 2)).toBe(1);
        });
    });

    describe(calculateRowHeights, () => {
        // Helper functions (consider moving to a shared test util if used elsewhere)
        const alignCellContent = (cell: GridItem) =>
            // Simulate content split by newlines
            String(cell.content ?? "").split(/\r?\n/);

        const findFirstOccurrenceRow = (gridLayout: (GridItem | null)[][], startRow: number, startCol: number, cell: GridItem) => {
            let firstRow = startRow;

            while (firstRow > 0 && gridLayout[firstRow - 1]?.[startCol] === cell) {
                firstRow -= 1;
            }

            return firstRow;
        };

        it("returns correct heights for single row", () => {
            expect.assertions(1);

            const cell: GridItem = { content: "A" };
            const grid = [[cell]];

            expect(
                calculateRowHeights(
                    grid,
                    [1],
                    {
                        autoColumns: 1,
                        autoFlow: "row",
                        autoRows: 1,
                        columns: 1,
                        defaultTerminalWidth: 80,
                        gap: 0,
                        paddingLeft: 0,
                        paddingRight: 0,
                        rows: 0,
                        showBorders: false,
                        truncate: false,
                        wordWrap: false,
                    },
                    alignCellContent,
                    findFirstOccurrenceRow,
                ),
            ).toStrictEqual([1]);
        });

        it("returns correct heights for multi-line row", () => {
            expect.assertions(1);

            const cell: GridItem = { content: "A\nB\nC" };
            const grid = [[cell]];

            expect(
                calculateRowHeights(
                    grid,
                    [1],
                    {
                        autoColumns: 1,
                        autoFlow: "row",
                        autoRows: 1,
                        columns: 1,
                        defaultTerminalWidth: 80,
                        gap: 0,
                        paddingLeft: 0,
                        paddingRight: 0,
                        rows: 0,
                        showBorders: false,
                        truncate: false,
                        wordWrap: false,
                    },
                    alignCellContent,
                    findFirstOccurrenceRow,
                ),
            ).toStrictEqual([3]);
        });

        it("returns correct heights with row spans", () => {
            expect.assertions(1);

            const cellA: GridItem = { content: "A", rowSpan: 2 };
            const cellB: GridItem = { content: "B\nB" };
            const cellC: GridItem = { content: "C" };
            const grid = [
                [cellA, cellB],
                [null, cellC],
            ];

            expect(
                calculateRowHeights(
                    grid,
                    [1, 1],
                    {
                        autoColumns: 1,
                        autoFlow: "row",
                        autoRows: 1,
                        columns: 2,
                        defaultTerminalWidth: 80,
                        gap: 0,
                        paddingLeft: 0,
                        paddingRight: 0,
                        rows: 0,
                        showBorders: false,
                        truncate: false,
                        wordWrap: false,
                    },
                    alignCellContent,
                    findFirstOccurrenceRow,
                ),
            ).toStrictEqual([2, 1]); // Row 0 needs height 2 (for cellB), Row 1 needs height 1 (for cellC)
        });

        it("handles null cells and empty rows gracefully", () => {
            expect.assertions(1);

            const cellA: GridItem = { content: "A" };
            const grid = [[cellA, null], [], [null, null]]; // Includes empty row and null cells

            expect(
                calculateRowHeights(
                    grid,
                    [1, 0, 0], // Column widths needed, but row heights are calculated
                    {
                        autoColumns: 1,
                        autoFlow: "row",
                        autoRows: 1,
                        columns: 2,
                        defaultTerminalWidth: 80,
                        gap: 0,
                        paddingLeft: 0,
                        paddingRight: 0,
                        rows: 0,
                        showBorders: false,
                        truncate: false,
                        wordWrap: false,
                    },
                    alignCellContent,
                    findFirstOccurrenceRow,
                ),
            ).toStrictEqual([1, 1, 1]);
        });

        it("respects fixed rowHeights array option", () => {
            expect.assertions(1);

            const cellA: GridItem = { content: "A\nB\nC" };
            const cellB: GridItem = { content: "D" };
            const grid = [[cellA], [cellB]];
            const fixedHeights = [2, 3]; // Fix row 0 height to 2, row 1 to 3

            expect(
                calculateRowHeights(
                    grid,
                    [1],
                    {
                        autoColumns: 1,
                        autoFlow: "row",
                        autoRows: 1,
                        columns: 1,
                        defaultTerminalWidth: 80,
                        fixedRowHeights: fixedHeights, // Use fixed heights
                        gap: 0,
                        paddingLeft: 0,
                        paddingRight: 0,
                        rows: 0,
                        showBorders: false,
                        truncate: false,
                        wordWrap: false,
                    },
                    alignCellContent,
                    findFirstOccurrenceRow,
                ),
            ).toStrictEqual(fixedHeights);
        });

        it("respects fixed rowHeights number option (applies to all rows)", () => {
            expect.assertions(1);

            const cellA: GridItem = { content: "A\nB\nC" };
            const cellB: GridItem = { content: "D" };
            const grid = [[cellA], [cellB]];
            const fixedHeight = 2; // Fix all rows height to 2

            expect(
                calculateRowHeights(
                    grid,
                    [1],
                    {
                        autoColumns: 1,
                        autoFlow: "row",
                        autoRows: 1,
                        columns: 1,
                        defaultTerminalWidth: 80,
                        fixedRowHeights: [fixedHeight, fixedHeight], // Apply to all rows
                        gap: 0,
                        paddingLeft: 0,
                        paddingRight: 0,
                        rows: 0,
                        showBorders: false,
                        truncate: false,
                        wordWrap: false,
                    },
                    alignCellContent,
                    findFirstOccurrenceRow,
                ),
            ).toStrictEqual([fixedHeight, fixedHeight]);
        });

        it("handles fixed rowHeights shorter than actual rows (uses calculated for remainder)", () => {
            expect.assertions(1);

            const cellA: GridItem = { content: "A\nB" };
            const cellB: GridItem = { content: "C\nD\nE" };
            const cellC: GridItem = { content: "F" };
            const grid = [[cellA], [cellB], [cellC]];
            const fixedHeights = [1]; // Only fix row 0 height

            expect(
                calculateRowHeights(
                    grid,
                    [1],
                    {
                        autoColumns: 1,
                        autoFlow: "row",
                        autoRows: 1,
                        columns: 1,
                        defaultTerminalWidth: 80,
                        fixedRowHeights: fixedHeights,
                        gap: 0,
                        paddingLeft: 0,
                        paddingRight: 0,
                        rows: 0,
                        showBorders: false,
                        truncate: false,
                        wordWrap: false,
                    },
                    alignCellContent,
                    findFirstOccurrenceRow,
                ),
            ).toStrictEqual([1, 1, 1]);
        });
    });

    describe(computeRowLogicalWidth, () => {
        it("should handle empty row", () => {
            expect.assertions(1);
            expect(computeRowLogicalWidth([])).toBe(0);
        });

        it("should handle row with null cells", () => {
            expect.assertions(1);

            const row: TableCell[] = [null, null, null];

            expect(computeRowLogicalWidth(row)).toBe(3); // Each null cell counts as width 1
        });

        it("should handle row with string cells", () => {
            expect.assertions(1);

            const row: TableCell[] = ["cell1", "cell2", "cell3"];

            expect(computeRowLogicalWidth(row)).toBe(3); // Each string cell counts as width 1
        });

        it("should handle row with object cells and colSpan", () => {
            expect.assertions(1);

            const row: TableCell[] = [
                { colSpan: 2, content: "wide cell" }, // Width 2
                { content: "normal cell" }, // Width 1
                { colSpan: 3, content: "wider cell" }, // Width 3
            ];

            expect(computeRowLogicalWidth(row)).toBe(6); // 2 + 1 + 3
        });

        it("should handle mixed row with null, string, and object cells", () => {
            expect.assertions(1);

            const row: TableCell[] = [
                null, // Width 1
                "string cell", // Width 1
                { colSpan: 2, content: "wide cell" }, // Width 2
                null, // Width 1
            ];

            expect(computeRowLogicalWidth(row)).toBe(5); // 1 + 1 + 2 + 1
        });

        it("should handle object cells without colSpan", () => {
            expect.assertions(1);

            const row: TableCell[] = [{ content: "cell1" }, { content: "cell2" }, { content: "cell3" }];

            expect(computeRowLogicalWidth(row)).toBe(3); // Each cell defaults to width 1
        });

        it("should handle object cells with invalid colSpan values", () => {
            expect.assertions(3);
            // Test zero colSpan
            expect(computeRowLogicalWidth([{ colSpan: 0, content: "zero" }])).toBe(1);
            // Test negative colSpan
            expect(computeRowLogicalWidth([{ colSpan: -1, content: "negative" }])).toBe(1);
            // Test undefined colSpan
            expect(computeRowLogicalWidth([{ colSpan: undefined, content: "undefined" }])).toBe(1);
        });

        it("should handle array cells as regular content", () => {
            expect.assertions(1);

            const row: TableCell[] = ["array1", "array2", { content: "object" }];

            expect(computeRowLogicalWidth(row)).toBe(3); // Arrays count as width 1
        });

        it("should handle edge cases", () => {
            expect.assertions(3);
            // Empty string
            expect(computeRowLogicalWidth([""])).toBe(1);
            // Very large colSpan
            expect(computeRowLogicalWidth([{ colSpan: 1000, content: "large" }])).toBe(1000);
            // Mix of all types
            expect(computeRowLogicalWidth([null, "", "array", { colSpan: 2, content: "span" }, { content: "no span" }])).toBe(6);
        });

        it("should handle row with bigint cells", () => {
            expect.assertions(1);

            const row: TableCell[] = [123n, { content: 456n }, null];

            expect(computeRowLogicalWidth(row)).toBe(3); // Each cell counts as width 1
        });
    });
});
