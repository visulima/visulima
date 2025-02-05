import { describe, expect, it } from "vitest";

import type { LayoutCell } from "../../../src/types";
import { areCellsEquivalent } from "../../../src/utils/are-cells-equivalent";

describe("areCellsEquivalent", () => {
    it("should return true for identical cells", () => {
        expect.assertions(1);

        const cell: LayoutCell = {
            content: "test",
            height: 1,
            width: 1,
            x: 0,
            y: 0,
        };

        expect(areCellsEquivalent(cell, cell)).toBeTruthy();
    });

    it("should return true for span cells with same parent", () => {
        expect.assertions(1);

        const parentCell: LayoutCell = {
            content: "parent",
            height: 2,
            width: 2,
            x: 0,
            y: 0,
        };

        const spanCell1: LayoutCell = {
            content: "span1",
            height: 1,
            isSpanCell: true,
            parentCell,
            width: 1,
            x: 0,
            y: 1,
        };

        const spanCell2: LayoutCell = {
            content: "span2",
            height: 1,
            isSpanCell: true,
            parentCell,
            width: 1,
            x: 1,
            y: 1,
        };

        expect(areCellsEquivalent(spanCell1, spanCell2)).toBeTruthy();
    });

    it("should return false for different cells", () => {
        expect.assertions(1);

        const cell1: LayoutCell = {
            content: "cell1",
            height: 1,
            width: 1,
            x: 0,
            y: 0,
        };

        const cell2: LayoutCell = {
            content: "cell2",
            height: 1,
            width: 1,
            x: 1,
            y: 0,
        };

        expect(areCellsEquivalent(cell1, cell2)).toBeFalsy();
    });

    it("should handle null cells", () => {
        expect.assertions(3);

        const cell: LayoutCell = {
            content: "test",
            height: 1,
            width: 1,
            x: 0,
            y: 0,
        };

        expect(areCellsEquivalent(null, null)).toBeTruthy();
        expect(areCellsEquivalent(cell, null)).toBeFalsy();
        expect(areCellsEquivalent(null, cell)).toBeFalsy();
    });
});
