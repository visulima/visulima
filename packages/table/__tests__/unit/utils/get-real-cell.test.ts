import { describe, expect, it } from "vitest";

import type { LayoutCell } from "../../../src/types";
import getRealCell from "../../../src/utils/get-real-cell";

describe("getRealCell", () => {
    it("should return null for null input", () => {
        expect.assertions(1);

        expect(getRealCell(null)).toBeNull();
    });

    it("should return the same cell if not a span cell", () => {
        expect.assertions(1);

        const cell: LayoutCell = {
            content: "test",
            height: 1,
            width: 1,
            x: 0,
            y: 0,
        };
        expect(getRealCell(cell)).toBe(cell);
    });

    it("should return parent cell for span cell with parent", () => {
        expect.assertions(1);

        const parentCell: LayoutCell = {
            content: "parent",
            height: 2,
            width: 2,
            x: 0,
            y: 0,
        };

        const spanCell: LayoutCell = {
            content: "span",
            height: 1,
            isSpanCell: true,
            parentCell,
            width: 1,
            x: 1,
            y: 1,
        };

        expect(getRealCell(spanCell)).toBe(parentCell);
    });

    it("should return span cell if no parent cell is set", () => {
        expect.assertions(1);

        const spanCell: LayoutCell = {
            content: "span",
            height: 1,
            isSpanCell: true,
            width: 1,
            x: 0,
            y: 0,
        };
        expect(getRealCell(spanCell)).toBe(spanCell);
    });

    it("should handle deeply nested span cells", () => {
        expect.assertions(1);

        const rootCell: LayoutCell = {
            content: "root",
            height: 3,
            width: 3,
            x: 0,
            y: 0,
        };

        const middleCell: LayoutCell = {
            content: "middle",
            height: 2,
            isSpanCell: true,
            parentCell: rootCell,
            width: 2,
            x: 1,
            y: 1,
        };

        const leafCell: LayoutCell = {
            content: "leaf",
            height: 1,
            isSpanCell: true,
            parentCell: middleCell,
            width: 1,
            x: 2,
            y: 2,
        };

        expect(getRealCell(leafCell)).toBe(rootCell);
    });
});
