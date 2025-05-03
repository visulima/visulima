import { describe, expect, it } from "vitest";

import type { GridItem } from "../../../src/types";
import determineCellVerticalPosition from "../../../src/utils/determine-cell-vertical-position";
import findFirstOccurrenceRow from "../../../src/utils/find-first-occurrence-row";
import padAndAlignContent from "../../../src/utils/pad-and-align-content";

describe("grid Cell Positioning and Content", () => {
    describe("padAndAlignContent", () => {
        it("left aligns with padding", () => {
            expect.assertions(1);
            // Width = 1 + 7 + 2 = 10
            expect(padAndAlignContent("foo", 7, "left", 1, 2)).toBe(" foo      ");
        });

        it("right aligns with padding", () => {
            expect.assertions(1);
            // Width = 1 + 7 + 2 = 10
            expect(padAndAlignContent("foo", 7, "right", 1, 2)).toBe("     foo  ");
        });

        it("center aligns with padding", () => {
            expect.assertions(1);
            // Width = 1 + 7 + 2 = 10
            expect(padAndAlignContent("foo", 7, "center", 1, 2)).toBe("   foo    ");
        });

        it("returns full padded width for empty content", () => {
            expect.assertions(1);
            // Width = 3 + 7 + 2 = 12
            expect(padAndAlignContent("", 7, "left", 3, 2)).toBe("            ");
        });

        it("handles zero available width", () => {
            expect.assertions(2);
            expect(padAndAlignContent("foo", 0, "left", 1, 1)).toBe(" foo "); // Content overflows, but padding remains
            expect(padAndAlignContent("", 0, "left", 1, 1)).toBe("  "); // Empty content, only padding
        });

        it("handles zero padding", () => {
            expect.assertions(1);
            expect(padAndAlignContent("bar", 5, "center", 0, 0)).toBe(" bar ");
        });
    });

    describe("determineCellVerticalPosition", () => {
        it("returns showContent true for single row", () => {
            expect.assertions(1);
            const cell: GridItem = { content: "A" };
            const grid = [[cell]];
            expect(determineCellVerticalPosition(grid, 0, 0, cell)).toStrictEqual({ firstRow: 0, lastRow: 0, showContent: true });
        });

        it("returns correct for top alignment", () => {
            expect.assertions(3);
            const cell: GridItem = { content: "A", vAlign: "top" };
            const grid = [[cell], [cell], [cell]];
            expect(determineCellVerticalPosition(grid, 0, 0, cell).showContent).toBeTruthy();
            expect(determineCellVerticalPosition(grid, 1, 0, cell).showContent).toBeFalsy();
            expect(determineCellVerticalPosition(grid, 2, 0, cell).showContent).toBeFalsy();
        });

        it("returns correct for bottom alignment", () => {
            expect.assertions(3);
            const cell: GridItem = { content: "A", vAlign: "bottom" };
            const grid = [[cell], [cell], [cell]];
            expect(determineCellVerticalPosition(grid, 0, 0, cell).showContent).toBeFalsy();
            expect(determineCellVerticalPosition(grid, 1, 0, cell).showContent).toBeFalsy();
            expect(determineCellVerticalPosition(grid, 2, 0, cell).showContent).toBeTruthy();
        });

        it("returns correct for middle alignment", () => {
            expect.assertions(3);
            const cell: GridItem = { content: "A", vAlign: "middle" };
            const grid = [[cell], [cell], [cell]];
            expect(determineCellVerticalPosition(grid, 1, 0, cell).showContent).toBeTruthy();
            expect(determineCellVerticalPosition(grid, 0, 0, cell).showContent).toBeFalsy();
            expect(determineCellVerticalPosition(grid, 2, 0, cell).showContent).toBeFalsy();
        });

        it("defaults to top alignment if vAlign is not set", () => {
            expect.assertions(3);
            const cell: GridItem = { content: "A" };
            const grid = [[cell], [cell], [cell]];
            expect(determineCellVerticalPosition(grid, 0, 0, cell).showContent).toBeTruthy();
            expect(determineCellVerticalPosition(grid, 1, 0, cell).showContent).toBeFalsy();
            expect(determineCellVerticalPosition(grid, 2, 0, cell).showContent).toBeFalsy();
        });
    });

    describe("findFirstOccurrenceRow", () => {
        it("returns the same row if cell does not span upwards", () => {
            expect.assertions(1);
            const cell: GridItem = { content: "A" };
            const grid = [[cell], [{ content: "B" }], [{ content: "C" }]];
            // Use a non-null assertion as grid[1][0] is guaranteed to exist here
            expect(findFirstOccurrenceRow(grid, 1, 0, (grid[1] as GridItem[])[0] as GridItem)).toBe(1);
        });

        it("returns the first row of a vertical span", () => {
            expect.assertions(3);
            const cell: GridItem = { content: "A", rowSpan: 3 };
            const grid = [[cell], [cell], [cell]];
            expect(findFirstOccurrenceRow(grid, 2, 0, cell)).toBe(0);
            expect(findFirstOccurrenceRow(grid, 1, 0, cell)).toBe(0);
            expect(findFirstOccurrenceRow(grid, 0, 0, cell)).toBe(0);
        });

        it("handles mixed cells", () => {
            expect.assertions(2);
            const cellA: GridItem = { content: "A", rowSpan: 2 };
            const cellB: GridItem = { content: "B" };
            const grid: GridItem[][] = [
                [cellA, cellB],
                [cellA, cellB],
                [{ content: "C" }, cellB],
            ];
            expect(findFirstOccurrenceRow(grid, 1, 0, cellA)).toBe(0);
            // Test finding the cell in the last row
            expect(findFirstOccurrenceRow(grid, 2, 1, (grid[2] as GridItem[])[1] as GridItem)).toBe(0);
        });
    });
});
