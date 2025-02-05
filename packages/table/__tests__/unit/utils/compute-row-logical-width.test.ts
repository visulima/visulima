import { describe, expect, it } from "vitest";

import type { Cell as CellType } from "../../../src/types";
import { computeRowLogicalWidth } from "../../../src/utils/compute-row-logical-width";

describe("computeRowLogicalWidth", () => {
    it("should handle empty row", () => {
        expect.assertions(1);

        expect(computeRowLogicalWidth([])).toBe(0);
    });

    it("should handle row with null cells", () => {
        expect.assertions(1);

        const row: CellType[] = [null, null, null];
        expect(computeRowLogicalWidth(row)).toBe(3);
    });

    it("should handle row with string cells", () => {
        expect.assertions(1);

        const row: CellType[] = ["cell1", "cell2", "cell3"];
        expect(computeRowLogicalWidth(row)).toBe(3);
    });

    it("should handle row with object cells and colSpan", () => {
        expect.assertions(1);

        const row: CellType[] = [{ colSpan: 2, content: "wide cell" }, { content: "normal cell" }, { colSpan: 3, content: "wider cell" }];
        expect(computeRowLogicalWidth(row)).toBe(6); // 2 + 1 + 3
    });

    it("should handle mixed row with null, string, and object cells", () => {
        expect.assertions(1);

        const row: CellType[] = [null, "string cell", { colSpan: 2, content: "wide cell" }, null];
        expect(computeRowLogicalWidth(row)).toBe(5); // 1 + 1 + 2 + 1
    });

    it("should handle object cells without colSpan", () => {
        expect.assertions(1);

        const row: CellType[] = [{ content: "cell1" }, { content: "cell2" }, { content: "cell3" }];
        expect(computeRowLogicalWidth(row)).toBe(3);
    });

    it("should handle object cells with zero or negative colSpan", () => {
        expect.assertions(1);

        const row: CellType[] = [{ colSpan: 0, content: "zero" }, { colSpan: -1, content: "negative" }, { content: "normal" }];
        expect(computeRowLogicalWidth(row)).toBe(3); // Defaults to 1 for invalid colSpan
    });
});
